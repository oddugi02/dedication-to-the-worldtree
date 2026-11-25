"""Extract the original six registered shapes for each growth stage."""
from pathlib import Path
import json
import math
import xml.etree.ElementTree as ET
from PIL import Image
import pymupdf

root = Path(__file__).resolve().parents[2]
sources = {int(p.stem.split()[-1]): p for p in (root / 'SVG').glob('*.svg')}
density = 6
stages = []
for number in (9, 8, 7):
    svg = ET.parse(sources[number]).getroot()
    width, height = map(float, svg.attrib['viewBox'].split()[2:])
    center = float(next(e.get('x1') for e in svg.iter() if e.tag.endswith('}line')))
    stage = dict(center=center, paths=[])
    # The Illustrator exports keep the same order as the six life axes.
    for element in svg.iter():
        d = element.get('d', '')
        if len(d) <= 500:
            continue
        source = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}"><path d="{d}"/></svg>'
        with pymupdf.open(stream=source.encode(), filetype='svg') as doc:
            with pymupdf.open(stream=doc.convert_to_pdf(), filetype='pdf') as pdf:
                pix = pdf[0].get_pixmap(matrix=pymupdf.Matrix(density,density), alpha=True)
        alpha = Image.frombytes('RGBA',(pix.width,pix.height),pix.samples).getchannel('A')
        left, top, right, bottom = (v/density for v in alpha.getbbox())
        dx = (left+right)/2-center
        dy = (top+bottom)/2-92.775
        angle = math.atan2(dy,dx)
        vx,vy = math.cos(angle),math.sin(angle)
        pixels = alpha.load()
        positions = [
            ((x+.5)/density-center)*vx+((y+.5)/density-92.775)*vy
            for y in range(round(top*density),round(bottom*density))
            for x in range(round(left*density),round(right*density))
            if pixels[x,y]>20
        ]
        stage['paths'].append(dict(d=d,box=[left,top,right-left,bottom-top],
            angle=round(math.degrees(angle),4), start=round(min(positions),4), end=round(max(positions),4)))
    assert len(stage['paths']) == 6
    stages.append(stage)
(root/'web/src/ornament-stages.js').write_text(
    '// Generated from SVG assets 9, 8 and 7.\nexport const stages = '+json.dumps(stages,separators=(',',':'))+';\n'
)
