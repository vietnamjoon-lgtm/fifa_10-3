# Game textures for the Rocketbox football players (1024 px):
#  - <avatar>-body.jpg   skin and boot soles as painted; kit pixels replaced by a neutral fabric shade
#                        (grey 128 = 1.0) so the game can colour any club kit and keep the folds.
#  - kit-mask.png        shared by every avatar (same UV layout). R part id x 40 (0 keep, 1 shirt, 2 sleeve,
#                        3 shorts, 4 socks, 5 boots, 6 hands for keeper gloves), G trim (collar, cuffs, hems), B skin (tinted by skin tone),
#                        A shininess from the specular map.
#  - <avatar>-head.jpg, <avatar>-body-normal.jpg, <avatar>-head-normal.jpg, <avatar>-hair.png (if any)
#  - rocketbox.json      decal rectangles (glTF UV, 0-1, origin top-left) and file list.
# Baked Rocketbox logos, sponsor, crest and numbers are removed; the game draws club ones in the same places.
#   python tools/human/rocketbox/02_textures.py <Rocketbox checkout> Sports_Male_02 Sports_Male_03
import sys, os, json, glob
import numpy as np
from PIL import Image, ImageDraw

SRC, AVATARS = sys.argv[1], sys.argv[2:]
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
CACHE = os.path.join(HERE, '.cache')
OUT = os.path.join(REPO, 'assets', 'human', 'rocketbox')
os.makedirs(OUT, exist_ok=True)
N = 1024

# Pixel rectangles (x0, y0, x1, y1) in the 1024 texture, y down. Back text is painted upside down.
RECTS = {
 'backNumber': (450, 208, 577, 372), 'backName': (444, 368, 581, 420),
 'crest': (524, 569, 570, 617), 'sponsor': (438, 618, 587, 690), 'brand': (454, 579, 500, 599),
 'shortsNumber': (150, 144, 202, 197), 'shortsBrand': (824, 179, 878, 201), 'sideText': (283, 432, 302, 498),
}
DECALS = ['backNumber', 'backName', 'crest', 'sponsor', 'shortsNumber']
SOLES = [(244, 740, 312, 882), (710, 740, 780, 882)]
EYES = (0, 600, 372, 1024)  # eyeball, teeth and tongue corner of the head texture


def tex(avatar, kind, mode='RGB'):
    path = glob.glob(os.path.join(SRC, 'Assets', 'Avatars', 'Professions', avatar, 'Textures', f'*_{kind}.tga'))
    return Image.open(path[0]).convert(mode).resize((N, N), Image.LANCZOS) if path else None


def blur(a, sigma):
    """Separable Gaussian blur (numpy only)."""
    r = int(3 * sigma)
    k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * sigma * sigma))
    k /= k.sum()
    a = np.apply_along_axis(lambda m: np.convolve(np.pad(m, r, mode='edge'), k, 'valid'), 0, a)
    return np.apply_along_axis(lambda m: np.convolve(np.pad(m, r, mode='edge'), k, 'valid'), 1, a)


def fill(values, valid, sigmas=(2, 6, 18, 48)):
    """Replace invalid pixels with a normalised-convolution average of nearby valid ones."""
    out = values.copy()
    for s in sigmas:
        w = blur(valid.astype(float), s)
        v = blur(np.where(valid, out, 0.0), s)
        est = np.divide(v, w, out=np.ones_like(v), where=w > 1e-4)
        take = ~valid & (w > 1e-3)
        out[take] = est[take]
        valid = valid | take
    return out


def hsv(rgb):
    img = Image.fromarray((rgb * 255).astype(np.uint8)).convert('HSV')
    a = np.asarray(img).astype(float) / 255
    return a[..., 0] * 360, a[..., 1], a[..., 2]


# --- Part map from the UV triangles (all avatars share the layout) ---------------------------------------
PART = {'Spine': 1, 'Spine1': 1, 'Spine2': 1, 'Neck': 1, 'Shoulder': 1, 'Arm': 2, 'ForeArm': 0, 'Hand': 0,
        'Hips': 3, 'UpLeg': 3, 'Leg': 4, 'Foot': 5, 'ToeBase': 5, 'Head': 0}
# Union of every avatar's UV faces: the layouts match, but some avatars have extra pieces (a waistband).
tris = [t for a in AVATARS for t in json.load(open(os.path.join(CACHE, a + '-uv.json')))]
region = Image.new('L', (N, N), 255)
d = ImageDraw.Draw(region)
def polys(t):
    # Faces continued past u = 1 (waist seam) are drawn at both ends of the texture.
    pts = [(u * N, (1 - v) * N) for u, v in t['uv']]
    return [pts, [(x - N, y) for x, y in pts]] if max(x for x, _ in pts) > N else [pts]
for t in tris:
    b = t['bone'].replace('Left', '').replace('Right', '')
    for pts in polys(t):
        d.polygon(pts, fill=PART[b])
region = np.asarray(region).astype(int)
# Grow parts into the empty gutters so texture filtering never reads "none" at seams.
for _ in range(6):
    empty = region == 255
    grown = region.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        shifted = np.roll(region, (dy, dx), (0, 1))
        grown = np.where(empty & (grown == 255) & (shifted != 255), shifted, grown)
    region = grown
region[region == 255] = 0

ref = np.asarray(tex(AVATARS[0], 'body_color')).astype(float) / 255
h, s, v = hsv(ref)
lum = ref @ [0.2126, 0.7152, 0.0722]
skin = (h < 50) & (s > 0.12) & (s < 0.66) & (v > 0.28)
# Orange trims (also their dark red shadow side); shadowed skin is orange-brown too, so only strongly
# saturated red-orange counts, and never deep inside a skin area.
trim = ((h < 22) | (h > 345)) & (s >= 0.62) & (v > 0.12)
logo = np.zeros((N, N), bool)
for x0, y0, x1, y1 in RECTS.values():
    logo[y0:y1, x0:x1] = True
skin &= ~logo
# Trims are continuous bands: close pinholes and gaps (also where a logo box overlaps the hem).
trim = blur(blur(trim.astype(float), 1.2) > 0.25, 1.2) > 0.75
trim &= ~logo & np.isin(region, (1, 2, 3)) & ~(blur(skin.astype(float), 3) > 0.7)
sole = np.zeros((N, N), bool)
for x0, y0, x1, y1 in SOLES:
    sole[y0:y1, x0:x1] = True
# Islands whose edge vertices follow a neighbouring bone (shorts waistband on the spine, sock cuff on the
# foot) take the part of the island they sit in.
covered = Image.new('L', (N, N), 0)
dc = ImageDraw.Draw(covered)
for t in tris:
    for pts in polys(t):
        dc.polygon(pts, fill=255)
covered = np.asarray(covered) > 0
# The torso island is all shirt, including the longer untucked hem of some avatars (weighted to the hips).
for part_id, boxes in ((3, [(0, 0, 292, 206), (732, 0, 1024, 206)]), (4, [(0, 330, 278, 562), (746, 330, 1024, 562)]), (1, [(362, 40, 664, 900)]),
                        # The arm islands at the bottom carry the upper arm below the sleeve too (weighted to the arm).
                        (0, [(0, 590, 280, 1024), (744, 590, 1024, 1024)])):
    for x0, y0, x1, y1 in boxes:
        region[y0:y1, x0:x1] = np.where(covered[y0:y1, x0:x1], part_id, region[y0:y1, x0:x1])
# Skin only where skin is modelled (arms below the sleeves, hands, the thigh band under the shorts), never as the thin
# antialiased fringe of a coloured trim.
skin &= np.isin(region, (0, 2, 3, 4)) & (blur(skin.astype(float), 1.5) > 0.6) & ~(((h < 28) | (h > 345)) & (s >= 0.5))
# Fill pinholes inside skin areas (dark shadowed skin at the back of the arms reads as fabric by colour).
skin |= (blur(skin.astype(float), 2.5) > 0.45) & np.isin(region, (0, 2, 3, 4)) & ~(((h < 22) | (h > 345)) & (s >= 0.62))
# Forearm and hand islands are all skin (their dark borders would otherwise keep the painted black).
skin |= covered & (region == 0)
# Below the shorts hem the thigh island is all skin (its shadowed inner side is too saturated to tell
# from fabric by colour): per column, everything under the lowest hem-trim texel is skin.
for x0, x1 in ((0, 292), (732, 1024)):
    for x in range(x0, x1):
        rows = np.nonzero(trim[180:260, x])[0]
        hem = 180 + (rows.max() + 1 if len(rows) else 32)
        skin[hem:330, x] |= covered[hem:330, x]
part = np.where(skin | (sole & (region == 5)), 0, region)
part[~covered] = 0
hands = Image.new('L', (N, N), 0)
dh = ImageDraw.Draw(hands)
for t in tris:
    if t['bone'].endswith('Hand'):
        for pts in polys(t):
            dh.polygon(pts, fill=255)
part = np.where((np.asarray(hands) > 0) & skin, 6, part)

def pad(a, inside, steps=24):
    # Spread the nearest covered texel into the gutters so filtering and mipmaps never pick up
    # unrelated colours at UV seams.
    a = a.copy()
    inside = inside.copy()
    for _ in range(steps):
        acc = np.zeros(a.shape, float)
        cnt = np.zeros(inside.shape, float)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            m = np.roll(inside, (dy, dx), (0, 1))
            acc += np.where((m if a.ndim == 2 else m[..., None]), np.roll(a, (dy, dx), (0, 1)), 0)
            cnt += m
        grow = ~inside & (cnt > 0)
        a[grow] = (acc[grow].T / cnt[grow]).T if a.ndim > 2 else acc[grow] / cnt[grow]
        inside |= grow
    return a


def pad_nearest(a, inside, steps=24):
    # Same for ids: copy a neighbour, never average.
    a = a.copy()
    inside = inside.copy()
    for _ in range(steps):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            m = np.roll(inside, (dy, dx), (0, 1))
            take = ~inside & m
            a[take] = np.roll(a, (dy, dx), (0, 1))[take]
            inside = inside | take
    return a


spec = tex(AVATARS[0], 'body_specular', 'L')
mask = np.stack([part * 40, np.where(trim & (part > 0), 255, 0), np.where(skin, 255, 0),
                 np.asarray(spec) if spec else np.full((N, N), 60)], -1).astype(np.uint8)
mask = pad_nearest(mask, covered)
Image.fromarray(mask, 'RGBA').save(os.path.join(OUT, 'kit-mask.png'), optimize=True)

# --- Per avatar ----------------------------------------------------------------------------------------------
files = {}
for avatar in AVATARS:
    rgb = np.asarray(tex(avatar, 'body_color')).astype(float) / 255
    L = rgb @ [0.2126, 0.7152, 0.0722]
    kit = (part > 0) & (part < 6)
    shade = np.ones((N, N))
    # Fabric shade = luminance over the local mean of the same colour class, so stripes, panels and
    # printing disappear but folds stay.
    ah, asat, av = hsv(rgb)
    orange = kit & ((ah < 28) | (ah > 345)) & (asat >= 0.45)
    dark = kit & ~orange & (L < 0.3)
    light = kit & ~orange & ~dark
    # Each colour class is brought to the same mean and fold contrast (local mean and standard deviation over
    # that class only), then mapped to one shared relative contrast.
    CONTRAST = 0.13
    for cls in (dark, light, orange):
        w = np.maximum(blur(cls.astype(float), 9), 1e-4)
        mean = blur(np.where(cls, L, 0), 9) / w
        std = np.sqrt(np.maximum(blur(np.where(cls, L * L, 0), 9) / w - mean * mean, 0))
        z = (L - mean) / np.maximum(std, 0.01 + 0.08 * mean)
        shade = np.where(cls, 1 + np.clip(z, -3, 3) * CONTRAST, shade)
    edge = np.hypot(*np.gradient(blur(L, 0.8))) > 0.03
    edge = blur(edge.astype(float), 1.2) > 0.05  # a 2-3 px band around every colour boundary
    valid = kit & ~edge & ~logo & (shade > 0.35) & (shade < 1.8)
    # Boots keep their panel contrast (normalised by the boot mean, not per class).
    boots = part == 5
    shade = np.where(boots, L / max(L[boots].mean(), 0.05), shade)
    valid |= boots
    shade = fill(shade, valid | ~kit)
    # Printed areas are flat: neutral inside the removed logos, feathered into the fabric around them.
    flat = np.zeros((N, N))
    for x0, y0, x1, y1 in RECTS.values():
        flat[y0:y1, x0:x1] = 1
    flat = np.clip(blur(flat, 7) * 1.6, 0, 1)
    around = valid & (flat < 0.05)
    # The fill follows the surrounding fabric's light level (large-scale), so no lighter box shows.
    smooth = blur(fill(np.where(around, shade, 1.0), around, sigmas=(4, 12, 30, 60)), 10)
    shade = shade * (1 - flat) + np.clip(smooth, 0.8, 1.2) * flat
    shade = np.clip(shade, 0.6, 1.35)
    grey = np.clip(shade * 0.5, 0, 1)
    out = np.where(kit[..., None], grey[..., None].repeat(3, -1), rgb)
    out = pad(out, covered)
    name = avatar.lower().replace('sports_', '')
    Image.fromarray((out * 255).astype(np.uint8)).save(os.path.join(OUT, f'{name}-body.jpg'), quality=88)
    head = tex(avatar, 'head_color')
    # Dark brown irises (most of the league's players); the painted iris keeps its brightness pattern.
    ha = np.asarray(head).astype(float) / 255
    box = ha[880:1010, 190:370]
    bl = box @ [0.2126, 0.7152, 0.0722]
    sclera = bl > 0.55
    ys, xs = np.nonzero(sclera)
    if len(ys):
        cy, cx = ys.mean(), xs.mean()
        yy, xx = np.mgrid[0:box.shape[0], 0:box.shape[1]]
        near = np.hypot(yy - cy, xx - cx) < 26
        iris = near & (bl < 0.5)
        iy, ix = np.nonzero(iris)
        r = np.sqrt(iris.sum() / np.pi) * 0.98
        mean_iris = max(bl[iris].mean(), 0.05)
        cy, cx = iy.mean(), ix.mean()
        disk = np.clip((r + 1 - np.hypot(yy - cy, xx - cx)) / 2, 0, 1) * np.clip((0.62 - bl) / 0.14, 0, 1)  # never the white
        brown = np.array([0.30, 0.19, 0.11])  # mean colour of the new iris
        recol = (bl[..., None] / mean_iris) * brown
        box[:] = box * (1 - disk[..., None]) + np.clip(recol, 0, 1) * disk[..., None]
        head = Image.fromarray((np.clip(ha, 0, 1) * 255).astype(np.uint8))
    head.save(os.path.join(OUT, f'{name}-head.jpg'), quality=90)
    # Hair on the scalp texture (tinted by the profile hair colour); the eye and mouth corner stays out.
    hrgb = np.asarray(head).astype(float) / 255
    hh, hs, hv = hsv(hrgb)
    # Relative to this head's own skin (cheeks), so dark skin and its shadows are not read as hair.
    cheek = np.median(hv[int(N * .30):int(N * .40), int(N * .40):int(N * .60)])
    hair = (hv < 0.55 * cheek) & (hv > 0.02)
    ey = np.arange(N)[:, None]
    hair &= (ey < N * 0.47)
    hair[int(N * .31):, int(N * .34):int(N * .66)] = False  # mouth, chin and throat shadows
    hair[int(EYES[1]):, :int(EYES[2])] = False
    hair = blur(hair.astype(float), 1.5) > 0.5
    # G: eyes, gums, teeth and tongue keep their colours (no skin tint): the non-skin texels of that corner.
    hh2, hs2, hv2 = hsv(np.asarray(head).astype(float) / 255)
    skinlike = (hh2 < 45) & (hs2 > 0.15) & (hs2 < 0.62) & (hv2 > 0.3)
    keep = np.zeros((N, N), bool)
    keep[int(EYES[1]):, :int(EYES[2])] = True
    keep &= ~(blur(skinlike.astype(float), 2) > 0.6)
    keep[int(N * .82):, int(N * .18):int(EYES[2])] = True  # the eyeball itself (whites read as skin-like)
    corner = np.zeros((N, N), bool)
    corner[int(EYES[1]) + 20:, :int(EYES[2])] = True
    keep |= corner & (hv2 > 0.5) & (hs2 < 0.38)  # teeth
    # B: where a beard grows (jaw, chin, upper lip, under the chin), soft-edged; lips stay clear.
    bimg = Image.new('L', (N, N), 0)
    bd = ImageDraw.Draw(bimg)
    P = lambda u, v: (u * N, v * N)
    bd.ellipse([P(.33, .38), P(.67, .52)], fill=255)                 # jaw and chin
    bd.rectangle([P(.31, .40), P(.36, .46)], fill=200)                # sideburn to jaw corners
    bd.rectangle([P(.64, .40), P(.69, .46)], fill=200)
    bd.ellipse([P(.445, .368), P(.555, .392)], fill=255)              # moustache
    bd.rectangle([P(.30, .30), P(.70, .368)], fill=0)                 # nothing above the upper lip
    bd.ellipse([P(.462, .388), P(.538, .418)], fill=0)                # lips
    beard = blur(np.asarray(bimg).astype(float) / 255, 9) * (~keep)
    mask2 = np.stack([blur(hair.astype(float), 1.0), blur(keep.astype(float), 1.0), np.clip(beard, 0, 1)], -1)
    Image.fromarray((mask2 * 255).astype(np.uint8)).save(os.path.join(OUT, f'{name}-hairmask.png'), optimize=True)
    for kind in ('body', 'head'):
        nm = tex(avatar, kind + '_normal')
        if nm:
            nm.save(os.path.join(OUT, f'{name}-{kind}-normal.jpg'), quality=90)
    entry = {'body': f'{name}-body.jpg', 'head': f'{name}-head.jpg', 'bodyNormal': f'{name}-body-normal.jpg', 'headNormal': f'{name}-head-normal.jpg', 'model': f'{name}.glb', 'hairMask': f'{name}-hairmask.png'}
    entry['hairColor'] = '#%02x%02x%02x' % tuple(int(c * 255) for c in np.median(hrgb[hair], 0))
    op = tex(avatar, 'opacity_color', 'RGBA')
    if op:
        op.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, f'{name}-hair.png'), optimize=True)
        entry['hair'] = f'{name}-hair.png'
    # Skin reference colour (median of the forearm skin) for the game's skin-tone tint.
    sk = rgb[skin & (region == 0) & (part == 0)]
    entry['skin'] = '#%02x%02x%02x' % tuple(int(c * 255) for c in np.median(sk, 0))
    files[name] = entry

uvrect = lambda r: [r[0] / N, r[1] / N, r[2] / N, r[3] / N]  # glTF UV: origin top-left
json.dump({'source': 'Microsoft Rocketbox (MIT)', 'size': N, 'eyes': uvrect(EYES),
           'decals': {k: uvrect(RECTS[k]) for k in DECALS}, 'flipped': ['backNumber', 'backName'],
           'parts': ['keep', 'shirt', 'sleeve', 'shorts', 'socks', 'boots', 'hands'], 'avatars': files},
          open(os.path.join(OUT, 'rocketbox.json'), 'w'), indent=1)
print(json.dumps(files))
