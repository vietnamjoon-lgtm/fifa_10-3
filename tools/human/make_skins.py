# Step 3a (system python3 + Pillow): the three skin tones as 1024 px textures in the MakeHuman UV
# layout. light and dark are the CC0 young male diffuse maps; brown is a 50/50 mix of the two.
import json, os
from PIL import Image
ROOT = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(ROOT, 'config', 'humans.json')))
data = os.path.expanduser('~/Library/Application Support/Blender/5.1/extensions/.user/blender_org/mpfb/data/skins')
out = os.path.join(ROOT, '.cache', 'textures')
os.makedirs(out, exist_ok=True)

def diffuse(name):
    folder = os.path.join(data, name)
    for line in open(os.path.join(folder, name + '.mhmat')):
        if line.startswith('diffuseTexture'):
            return Image.open(os.path.join(folder, os.path.basename(line.split()[1]))).convert('RGB')
    return Image.open(next(os.path.join(folder, f) for f in os.listdir(folder) if f.endswith('_diffuse.png'))).convert('RGB')

for tone in cfg['skinTones']:
    img = diffuse(tone['base'])
    if 'mix' in tone:
        img = Image.blend(img, diffuse(tone['mix']['with']), tone['mix']['factor'])
    img = img.resize((1024, 1024), Image.LANCZOS)
    path = os.path.join(out, f"skin_{tone['id']}.png")
    img.save(path)
    print('SKIN', tone['id'], img.size, [round(c) for c in img.resize((1, 1), Image.BOX).getpixel((0, 0))])
