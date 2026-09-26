# Step 3b: a glTF-ready skin material (one base-colour texture, constant roughness) on the body.
# Tones are swapped at runtime by texture; the .blend keeps 'light'. Run make_skins.py first.
# Blender -b --python-exit-code 1 --python tools/human/blender/03_skin.py
import bpy, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import CACHE, config, fail, save_stage, open_stage, render_grid
cfg = config()
tex = os.path.join(CACHE, 'textures')


def skin_material(tone):
    path = os.path.join(tex, f'skin_{tone}.png')
    if not os.path.exists(path):
        fail('run tools/human/make_skins.py first: missing ' + path)
    mat = bpy.data.materials.new(f'Skin_{tone}')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    img = nt.nodes.new('ShaderNodeTexImage')
    img.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(img.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.55
    bsdf.inputs['Specular IOR Level'].default_value = 0.35
    mat.use_fake_user = True  # keep unused tones in the saved .blend
    return mat


open_stage('02_faces')
body = bpy.data.objects['Body']
mats = {t['id']: skin_material(t['id']) for t in cfg['skinTones']}
body.data.materials.clear()
body.data.materials.append(mats['light'])
body.active_material_index = 0
for poly in body.data.polygons:
    poly.material_index = 0
save_stage('03_skin')

items = []
for tone in cfg['skinTones']:
    o = body.copy()
    o.data = body.data.copy()
    bpy.context.scene.collection.objects.link(o)
    o.data.materials[0] = mats[tone['id']]
    items.append((tone['id'], [o]))
body.hide_render = True
render_grid(items, '03-skin', res=(520, 900))
print('DONE 03_skin')
