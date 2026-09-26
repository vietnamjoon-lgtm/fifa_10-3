# Step 7: export the game LOD to glTF (.cache/player.glb) with textures kept outside the file,
# plus assets/human/player.json that tells the viewer which texture goes on which material.
# Blender -b --python-exit-code 1 --python tools/human/blender/07_export.py
import bpy, os, sys, json, shutil
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import CACHE, OUT, config, fail, open_stage
cfg = config()
open_stage('06_reduce')
rig = bpy.data.objects['Rig']
MESHES = ['Body', 'Eyes', 'Eyebrows', 'Hair_short01', 'Hair_afro01', 'Kit_shirt', 'Kit_shorts', 'Kit_socks', 'Kit_boots']
tex_dir = os.path.join(CACHE, 'textures')
textures = {}


def first_image(mat):
    if not (mat and mat.use_nodes):
        return None
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image and n.image.filepath:
            return bpy.path.abspath(n.image.filepath)
    return None


for name in MESHES:
    o = bpy.data.objects[name]
    for a in ('_REGION', '_SRC'):
        if a in o.data.attributes:
            o.data.attributes.remove(o.data.attributes[a])
    if o.data.shape_keys:
        for k in o.data.shape_keys.key_blocks:
            k.value = 0.0
    src = first_image(o.active_material)
    material = 'Skin' if name == 'Body' else name
    if src and name != 'Body':
        dst = os.path.join(tex_dir, material.lower() + '.png')
        shutil.copyfile(src, dst)
        textures[material] = os.path.basename(dst)
    mat = bpy.data.materials.new(material)
    mat.use_nodes = True
    o.data.materials.clear()
    o.data.materials.append(mat)
textures['Skin'] = {t['id']: f"skin_{t['id']}.png" for t in cfg['skinTones']}

for o in bpy.context.selected_objects:
    o.select_set(False)
for name in MESHES + ['Rig']:
    bpy.data.objects[name].select_set(True)
bpy.context.view_layer.objects.active = rig
path = os.path.join(CACHE, 'player.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_skins=True, export_morph=True,
                          export_morph_normal=False, export_animations=False, export_yup=True, export_image_format='NONE',
                          export_apply=False, export_extras=False)
if not os.path.exists(path):
    fail('export failed')

tris = {n: sum(len(p.vertices) - 2 for p in bpy.data.objects[n].data.polygons) for n in MESHES}
manifest = {
    'model': 'player.glb', 'bones': len(rig.data.bones), 'triangles': tris,
    'budget': cfg['lod']['player'],
    'faces': [f['id'] for f in cfg['faces']], 'morphs': [k.name for k in bpy.data.objects['Body'].data.shape_keys.key_blocks[1:]],
    'skinTones': [t['id'] for t in cfg['skinTones']], 'hair': cfg['hair']['short'],
    'textures': textures, 'kit': {'parts': ['Kit_shirt', 'Kit_shorts', 'Kit_socks', 'Kit_boots'], 'decalUV': 'TEXCOORD_1 on Kit_shirt: back in u 0-0.5, front in u 0.5-1, -1 outside'},
    'referenceHeight': cfg['referenceHeight'], 'heightScale': [0.93, 1.07]}
with open(os.path.join(OUT, 'player.json'), 'w') as f:
    json.dump(manifest, f, indent=1, ensure_ascii=False)
print('EXPORT', path, os.path.getsize(path), 'bytes', 'textures', textures)
