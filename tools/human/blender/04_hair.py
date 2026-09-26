# Step 4: low-poly eyes, one eyebrow mesh, and the two hair shells (short01, afro01) fitted to the body.
# Blender -b --python-exit-code 1 --python tools/human/blender/04_hair.py
import bpy, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import mpfb, config, fail, save_stage, open_stage, render_grid
from bl_ext.blender_org.mpfb.services.assetservice import AssetService
HumanService, TargetService, RigService, LocationService = mpfb()
cfg = config()

open_stage('03_skin')
body = bpy.data.objects['Body']
rig = bpy.data.objects['Rig']


def add(kind, name, asset_type):
    path = AssetService.find_asset_absolute_path(f'{name}/{name}.mhclo', kind) or fail(f'asset {kind}/{name}')
    before = set(bpy.data.objects)
    HumanService.add_mhclo_asset(path, body, asset_type=asset_type, subdiv_levels=0, material_type='MAKESKIN')
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    if not new:
        fail('nothing added for ' + name)
    obj = new[0]
    for m in obj.modifiers:
        if m.type == 'SUBSURF':
            obj.modifiers.remove(m)
    if not any(m.type == 'ARMATURE' for m in obj.modifiers):
        fail(name + ' has no armature modifier')
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print('ASSET', kind, name, 'triangles', tris, 'weights', len(obj.vertex_groups))
    return obj


eyes = add('eyes', 'low-poly', 'Eyes')
eyes.name = 'Eyes'
brows = add('eyebrows', 'eyebrow001', 'Eyebrows')
brows.name = 'Eyebrows'
hair = {}
for name in cfg['hair']['short']:
    hair[name] = add('hair', name, 'Hair')
    hair[name].name = 'Hair_' + name
save_stage('04_hair')

# Report: each hair style on its intended skin tone, head close-up and full body.
skin = {m.name: m for m in bpy.data.materials if m.name.startswith('Skin_')}
items = []
for name, tone in (('short01', 'light'), ('afro01', 'dark')):
    b = body.copy()
    b.data = body.data.copy()
    bpy.context.scene.collection.objects.link(b)
    b.data.materials[0] = skin['Skin_' + tone]
    items.append((name, [b, eyes, brows, hair[name]]))
body.hide_render = True
for h in hair.values():
    h.hide_render = False
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg)
me = ev.to_mesh()
top = max((body.matrix_world @ v.co).z for v in me.vertices)
ev.to_mesh_clear()
render_grid(items, '04-hair-head', res=(420, 480), frame_height=0.42, center_z=top - 0.13)
render_grid(items, '04-hair-body', res=(520, 900))
print('DONE 04_hair')
