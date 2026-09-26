# Rocketbox football player -> game GLB. Keeps the 20 body bones (face, eye and finger weights go to Head /
# Hand), renames them to the Mixamo names the game map uses, puts the model in metres facing -Y (glTF +Z),
# and writes a UV/region table for the kit mask (02_textures.py).
# python -m bpy is not needed: run with a Python that has the `bpy` module (pip bpy==5.0.1) or Blender:
#   python tools/human/rocketbox/01_convert.py <Rocketbox checkout> <avatar id, e.g. Sports_Male_02>
import bpy, bmesh, sys, os, json
from mathutils import Vector

args = [a for a in sys.argv if not a.startswith('-')][-2:]
SRC, AVATAR = args
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
CACHE = os.path.join(HERE, '.cache')
os.makedirs(CACHE, exist_ok=True)
fbx = os.path.join(SRC, 'Assets', 'Avatars', 'Professions', AVATAR, 'Export', AVATAR + '.fbx')

KEEP = {
 'Bip01 Pelvis': 'Hips', 'Bip01 Spine': 'Spine', 'Bip01 Spine1': 'Spine1', 'Bip01 Spine2': 'Spine2',
 'Bip01 Neck': 'Neck', 'Bip01 Head': 'Head',
 'Bip01 L Clavicle': 'LeftShoulder', 'Bip01 L UpperArm': 'LeftArm', 'Bip01 L Forearm': 'LeftForeArm', 'Bip01 L Hand': 'LeftHand',
 'Bip01 R Clavicle': 'RightShoulder', 'Bip01 R UpperArm': 'RightArm', 'Bip01 R Forearm': 'RightForeArm', 'Bip01 R Hand': 'RightHand',
 'Bip01 L Thigh': 'LeftUpLeg', 'Bip01 L Calf': 'LeftLeg', 'Bip01 L Foot': 'LeftFoot', 'Bip01 L Toe0': 'LeftToeBase',
 'Bip01 R Thigh': 'RightUpLeg', 'Bip01 R Calf': 'RightLeg', 'Bip01 R Foot': 'RightFoot', 'Bip01 R Toe0': 'RightToeBase',
}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx, automatic_bone_orientation=True)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')

# Only the rig and the skinned mesh (the FBX also brings a 'Bip01 Footsteps' helper).
for o in list(bpy.data.objects):
    if o not in (arm, mesh):
        bpy.data.objects.remove(o, do_unlink=True)
# The FBX brings a one-frame action that would put the object transform back.
for o in (arm, mesh):
    o.animation_data_clear()
    o.delta_location, o.delta_rotation_euler, o.delta_scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
# Metres, no object transform (the FBX armature carries 0.01 scale, a -90 degree turn and the pelvis height).
bpy.ops.object.select_all(action='DESELECT')
for o in (arm, mesh):
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh.select_set(False)
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.context.view_layer.update()
from mathutils import Matrix
assert all(abs(a - b) < 1e-5 for r1, r2 in zip(arm.matrix_world, Matrix.Identity(4)) for a, b in zip(r1, r2)), arm.matrix_world
arm.name = 'Rig'
arm.data.name = 'Rig'
mesh.name = 'Player'

# Weights of dropped bones go to the nearest kept ancestor.
def kept(bone):
    while bone and bone.name not in KEEP:
        bone = bone.parent
    return bone.name if bone else 'Bip01 Pelvis'

target = {b.name: kept(b) for b in arm.data.bones}
groups = {g.name: g for g in mesh.vertex_groups}
merged = {}
for v in mesh.data.vertices:
    acc = {}
    for g in v.groups:
        name = mesh.vertex_groups[g.group].name
        t = target.get(name, name)
        acc[t] = acc.get(t, 0) + g.weight
    merged[v.index] = acc
for g in list(mesh.vertex_groups):
    mesh.vertex_groups.remove(g)
for old in KEEP:
    mesh.vertex_groups.new(name=old)
for i, acc in merged.items():
    total = sum(w for n, w in acc.items() if n in KEEP) or 1
    for n, w in acc.items():
        if n in KEEP and w > 0:
            mesh.vertex_groups[n].add([i], w / total, 'REPLACE')

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for eb in list(arm.data.edit_bones):
    if eb.name not in KEEP:
        arm.data.edit_bones.remove(eb)
bpy.ops.object.mode_set(mode='OBJECT')
for old, new in KEEP.items():
    arm.data.bones[old].name = new  # Blender renames the matching vertex group too
    if old in mesh.vertex_groups:
        mesh.vertex_groups[old].name = new

# Body-shape morph targets (the kit is part of the same mesh and follows): each pushes vertices along their
# normal by (metres x skin weight of the listed bones). The game drives them from the saved body sliders.
MORPHS = {
 'body_heavy': {'Hips': .018, 'Spine': .024, 'Spine1': .022, 'Spine2': .014, 'Neck': .006, 'LeftShoulder': .006, 'RightShoulder': .006,
                'LeftArm': .008, 'RightArm': .008, 'LeftForeArm': .005, 'RightForeArm': .005, 'LeftUpLeg': .014, 'RightUpLeg': .014,
                'LeftLeg': .007, 'RightLeg': .007},
 'body_muscle': {'Spine2': .012, 'LeftShoulder': .012, 'RightShoulder': .012, 'LeftArm': .010, 'RightArm': .010, 'LeftForeArm': .006,
                 'RightForeArm': .006, 'LeftUpLeg': .012, 'RightUpLeg': .012, 'LeftLeg': .010, 'RightLeg': .010, 'Neck': .008},
 'body_chest': {'Spine2': .02},
 'body_waist': {'Spine': .024, 'Spine1': .02, 'Hips': .01},
 'body_thigh': {'LeftUpLeg': .02, 'RightUpLeg': .02},
 'body_calf': {'LeftLeg': .016, 'RightLeg': .016},
 'body_arms': {'LeftArm': .013, 'RightArm': .013, 'LeftForeArm': .009, 'RightForeArm': .009},
}
names_by_index = {g.index: KEEP.get(g.name, g.name) for g in mesh.vertex_groups}
me0 = mesh.data
basis = mesh.shape_key_add(name='Basis', from_mix=False)
for key, amounts in MORPHS.items():
    sk = mesh.shape_key_add(name=key, from_mix=False)
    for v in me0.vertices:
        w = sum(amounts.get(names_by_index[g.group], 0) * g.weight for g in v.groups)
        if w:
            sk.data[v.index].co = v.co + v.normal * w

# Material names the game looks for.
for m in mesh.data.materials:
    m.name = 'body' if m.name.endswith('_body') else 'head' if m.name.endswith('_head') else 'hair'

# A few waist faces join the left and right edges of the texture (u ~0.05 and ~0.95); interpolating
# across the whole atlas smears the shirt into the waistband. Continue them past u = 1 instead (the game
# samples these textures with repeat wrapping).
me = mesh.data
uv = me.uv_layers.active.data
wrapped = 0
for p in me.polygons:
    us = [uv[l].uv.x for l in p.loop_indices]
    if max(us) - min(us) > 0.5:
        wrapped += 1
        for l in p.loop_indices:
            if uv[l].uv.x < 0.5:
                uv[l].uv.x += 1.0
print('WRAPPED', wrapped)

# UV triangles of the body material with the bone that drives them, for the kit mask.
names = {g.index: g.name for g in mesh.vertex_groups}
def strongest(vi):
    gs = me.vertices[vi].groups
    return names[max(gs, key=lambda g: g.weight).group] if len(gs) else 'Hips'
body_index = [i for i, m in enumerate(me.materials) if m.name == 'body'][0]
tris = []
me.calc_loop_triangles()
for t in me.loop_triangles:
    if t.material_index != body_index:
        continue
    bones = [strongest(me.loops[l].vertex_index) for l in t.loops]
    z = sum(me.vertices[me.loops[l].vertex_index].co.z for l in t.loops) / 3
    tris.append({'uv': [list(uv[l].uv) for l in t.loops], 'bone': max(set(bones), key=bones.count), 'z': round(z, 4)})
with open(os.path.join(CACHE, AVATAR + '-uv.json'), 'w') as f:
    json.dump(tris, f)

tri_count = sum(len(p.vertices) - 2 for p in me.polygons)
height = max(v.co.z for v in me.vertices) - min(v.co.z for v in me.vertices)
out = os.path.join(CACHE, AVATAR + '.glb')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_skins=True, export_morph=True,
                          export_animations=False, export_yup=True, export_image_format='NONE', export_apply=False, export_extras=False)
print(json.dumps({'avatar': AVATAR, 'glb': out, 'triangles': tri_count, 'bones': len(arm.data.bones), 'height': round(height, 3)}))
