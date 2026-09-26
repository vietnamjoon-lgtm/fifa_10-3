# Composes report tiles into one labelled grid (rows = views, columns = items).
# Runs with the system python3 (Pillow), called from common.render_grid.
import json, sys
from PIL import Image, ImageDraw, ImageFont

spec = json.load(open(sys.argv[1]))
w, h = spec['size']
tiles = spec['tiles']
rows = max(t['row'] for t in tiles) + 1
cols = max(t['col'] for t in tiles) + 1
top, left = 40, 110
sheet = Image.new('RGB', (left + cols * w, top + rows * h), (30, 32, 36))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 22)
except OSError:
    font = ImageFont.load_default()
labels = {t['col']: t['label'] for t in tiles}
views = {t['row']: t['view'] for t in tiles}
for c, label in labels.items():
    draw.text((left + c * w + 12, 8), label, fill=(235, 235, 235), font=font)
for r, view in views.items():
    draw.text((10, top + r * h + h // 2 - 12), view, fill=(200, 200, 200), font=font)
for t in tiles:
    sheet.paste(Image.open(t['path']).convert('RGB').resize((w, h)), (left + t['col'] * w, top + t['row'] * h))
sheet.save(spec['out'])
print('GRID', spec['out'])
