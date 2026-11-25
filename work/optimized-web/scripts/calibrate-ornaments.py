from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageOps, ImageFilter
import pymupdf

stages=json.loads(Path('src/ornament-stages.js').read_text().split('export const stages = ')[1].rstrip().rstrip(';'))
zoom=2
def target(stage,axis):
    d=stage['paths'][axis]['d']
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="216" height="204" viewBox="-108 -102 216 204"><path transform="translate(-{stage["center"]} -92.775)" d="{d}"/></svg>'
    doc=pymupdf.open(stream=svg.encode(),filetype='svg')
    pdf=pymupdf.open('pdf',doc.convert_to_pdf())
    pix=pdf[0].get_pixmap(matrix=pymupdf.Matrix(zoom,zoom),alpha=True)
    return Image.frombytes('RGBA',(pix.width,pix.height),pix.samples).getchannel('A')

def align(photo, base):
    bw,bh=base.size
    if max(bw,bh)>140:
        base=base.copy();base.thumbnail((140,140));bw,bh=base.size
    reference=np.asarray(base.filter(ImageFilter.GaussianBlur(1.35)),dtype=float)/255
    small=photo.copy();small.thumbnail((190,190))
    best=(-1,None)
    for flip in (False,True):
        sprite=ImageOps.mirror(small) if flip else small
        for angle in range(0,360,5):
            rotated=sprite.rotate(angle,Image.Resampling.BICUBIC,expand=True)
            rect=rotated.getbbox()
            crop=rotated.crop(rect)
            a=np.asarray(crop.resize((bw,bh)).filter(ImageFilter.GaussianBlur(1.35)),dtype=float)/255
            overlap=np.sum(np.minimum(a,reference))/np.sum(np.maximum(a,reference))
            penalty=.06*abs(math.log((bw/bh)/(crop.width/crop.height)))
            if overlap-penalty>best[0]:
                best=(overlap-penalty,(angle,flip))
    angle,flip=best[1]
    sprite=ImageOps.mirror(photo) if flip else photo
    rotated=sprite.rotate(angle,Image.Resampling.BICUBIC,expand=True)
    l,t,r,b=rotated.getbbox()
    return dict(angle=-angle,flip=flip,width=photo.width,height=photo.height,
                crop=[l-rotated.width/2,t-rotated.height/2,r-l,b-t],score=round(best[0],3))

def find_copies(base, reference, count):
    x0,y0,x1,y1=reference.getbbox()
    # Work in a padded bounding box. FFT correlation finds each copy's position.
    pad=9
    crop=reference.crop((x0-pad,y0-pad,x1+pad,y1+pad))
    target=np.asarray(crop,dtype=np.float32)/255
    h,w=target.shape
    fft_shape=tuple(2**math.ceil(math.log2(max(2,s*2))) for s in (h,w))
    desired=np.clip(target*1.2,0,1)
    outside=1-np.asarray(crop.filter(ImageFilter.MaxFilter(5)),dtype=np.float32)/255
    candidates=[]
    max_scale=max(w/base.width,h/base.height)*1.10
    for scale in np.linspace(max_scale*.30,max_scale,21):
        for angle in (-25,-15,-8,0,8,15,25):
            resized=base.resize((max(1,round(base.width*scale)),max(1,round(base.height*scale)))).rotate(angle,Image.Resampling.BICUBIC,expand=True)
            l,t,r,b=resized.getbbox()
            tmpl=np.asarray(resized.crop((l,t,r,b)),dtype=np.float32)/255
            th,tw=tmpl.shape
            if th>h or tw>w:continue
            # Keep placement centered on the full rotated rectangle for SVG transforms.
            offset=(l-resized.width/2,t-resized.height/2)
            freq=np.fft.rfft2(tmpl,fft_shape,axes=(0,1)).conj()
            candidates.append((tmpl,freq,offset,scale,angle))
    copies=[]
    for i in range(count):
        field=np.fft.rfft2(desired-outside*.79,fft_shape,axes=(0,1))
        best=None
        for tmpl,freq,offset,scale,angle in candidates:
            if i:
                ratio=scale/copies[0][2]
                if not ((.47<=ratio<=.81) if i==1 else (.26<=ratio<=.46)):
                    continue
            th,tw=tmpl.shape
            score=np.fft.irfft2(field*freq,fft_shape,axes=(0,1))[:h-th+1,:w-tw+1]
            yy,xx=np.unravel_index(np.argmax(score),score.shape)
            value=float(score[yy,xx])
            if best is None or value>best[0]:best=(value,xx,yy,tmpl,offset,scale,angle)
        value,x,y,tmpl,offset,scale,angle=best
        th,tw=tmpl.shape
        desired[y:y+th,x:x+tw]*=1-tmpl*.94
        cx=(x+x0-pad-offset[0])/zoom-108
        cy=(y+y0-pad-offset[1])/zoom-102
        copies.append([round(cx,3),round(cy,3),round(scale,4),-angle])
    return copies

def growth_bounds(alpha, sprite, size, pose, angle):
    # Apply the same transform as the SVG and measure its nontransparent pixels
    # along the outward direction. The crop then uses the visible motif's length.
    y,x = np.nonzero(np.asarray(alpha)>18)
    x = x+.5-sprite['width']/2
    y = y+.5-sprite['height']/2
    if sprite['flip']:
        x = -x
    tilt = math.radians(sprite['angle'])
    left,top,crop_width,crop_height = sprite['crop']
    width,height = size
    local_x = (x*math.cos(tilt)-y*math.sin(tilt)-left)*width/crop_width-width/2
    local_y = (x*math.sin(tilt)+y*math.cos(tilt)-top)*height/crop_height-height/2
    px,py,scale,rotation = pose
    axis = math.radians(angle)
    relative = math.radians(angle-rotation)
    projection = (px*math.cos(axis)+py*math.sin(axis)
                  +scale*(local_x*math.cos(relative)+local_y*math.sin(relative)))
    return [round(float(projection.min()),4),round(float(projection.max()),4)]

results=[]
for axis in range(6):
    basic=target(stages[0],axis)
    l,t,r,b=basic.getbbox()
    base=basic.crop((l,t,r,b))
    photo=Image.open(f'public/assets/gloss-{axis}.webp').getchannel('A')
    sprite=align(photo,base)
    first=[[(l+r)/(2*zoom)-108,(t+b)/(2*zoom)-102,1,0]]
    copies=[first]+[find_copies(base,target(stages[level],axis),level+1) for level in (1,2)]
    size = [base.width/zoom,base.height/zoom]
    angle = stages[0]['paths'][axis]['angle']
    bounds = [growth_bounds(photo,sprite,size,level[-1],angle) for level in copies]
    results.append(dict(sprite=sprite,size=size,levels=copies,angle=angle,growthBounds=bounds))
    print(axis,sprite['score'],sprite['angle'],sprite['flip'],copies,flush=True)
for placement in results:
    placement['sprite'].pop('score')
Path('src/ornament-placements.js').write_text(
    '// Image registration fitted against the six motifs in SVG assets 9, 8 and 7.\nexport const placements = '+json.dumps(results,separators=(',',':'))+';\n'
)
