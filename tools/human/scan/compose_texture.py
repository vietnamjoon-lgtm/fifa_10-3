# The face pack's head texture: the scan colour baked into the game head's UVs (scan_blender.py fit), laid over
# the head's own texture where the blend mask says so. The scan's lighting and camera exposure differ from the
# painted head, so it is scaled per channel (0.6-1.6) to match the painted skin just around the mask's edge, the
# way src/human-kit.js matches photo faces; the game then tints the whole head by the player's skin colour.
# Writes texture.jpg (1024 px, <= the pack limit as base64) and online.jpg (256 px) and prints the face's median colour.
#   python3 compose_texture.py <head.jpg> <bake.png> <mask.png> <out dir> <texture max chars> <online max chars>
import sys, os, io, json
import numpy as np
from PIL import Image, ImageFilter

HEAD, BAKE, MASK, OUT, TEX_MAX, ONLINE_MAX = sys.argv[1:7]
N = 1024
head = np.asarray(Image.open(HEAD).convert('RGB').resize((N, N), Image.LANCZOS)).astype(float) / 255
bake_rgba = np.asarray(Image.open(BAKE).convert('RGBA').resize((N, N), Image.LANCZOS)).astype(float) / 255
bake, hit = bake_rgba[..., :3], bake_rgba[..., 3] > .5
mask = np.asarray(Image.open(MASK).convert('L').resize((N, N), Image.LANCZOS)).astype(float) / 255
mask = np.where(hit, mask, 0)
# Soften the edge a little more (the vertex weights are already smooth; texel seams are not).
mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(float) / 255 * hit
ring = (mask > .15) & (mask < .6)
gain = np.clip(head[ring].mean(0) / np.maximum(bake[ring].mean(0), 1e-3), .6, 1.6) if ring.sum() > 200 else np.ones(3)
out = head * (1 - mask[..., None]) + np.clip(bake * gain, 0, 1) * mask[..., None]
face = bake[mask > .8]
skin = '#%02x%02x%02x' % tuple(int(c * 255) for c in (np.median(face, 0) if len(face) else head[mask >= 0].mean(0)))


def bounded(img, limit, name):
    for q in range(90, 20, -6):
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=q)
        if (len(buf.getvalue()) + 2) // 3 * 4 + 23 <= limit:  # as a data: URL
            open(os.path.join(OUT, name), 'wb').write(buf.getvalue())
            return q
    raise SystemExit(f'{name} does not fit in {limit} characters')


img = Image.fromarray((out * 255).astype(np.uint8))
qt = bounded(img, int(TEX_MAX), 'texture.jpg')
qo = bounded(img.resize((256, 256), Image.LANCZOS), int(ONLINE_MAX), 'online.jpg')
print(json.dumps({'skin': skin, 'gain': [round(g, 3) for g in gain], 'masked': round(float(mask.mean()), 4), 'quality': [qt, qo]}))
