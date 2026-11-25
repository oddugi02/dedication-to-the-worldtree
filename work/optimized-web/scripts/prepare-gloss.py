from pathlib import Path
from PIL import Image, ImageChops
import unicodedata

root = Path(__file__).resolve().parents[2]
folder = next(p for p in root.glob('*/*') if unicodedata.normalize('NFC',p.name)=='광택이 추가된 질감')
axes = ('감싸다','내밀다','버티다','받아들이다','뻗다','쌓다')
for index, axis in enumerate(axes):
    source = next(p for p in folder.glob('*.png') if unicodedata.normalize('NFC',p.stem).startswith(axis))
    image = Image.open(source).convert('RGB')
    red, green, blue = image.split()
    mask = ImageChops.lighter(red,ImageChops.lighter(green,blue)).point(lambda x: max(0,min(255,(x-14)*10)))
    image.putalpha(mask)
    image = image.crop(mask.getbbox())
    if image.height > image.width:
        image = image.transpose(Image.Transpose.ROTATE_90)
    image.thumbnail((640,640))
    image.save(root / f'web/public/assets/gloss-{index}.webp', quality=94)
