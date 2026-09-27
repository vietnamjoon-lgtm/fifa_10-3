# Rocketbox football player -> game GLB. Keeps the 22 body bones and the 30 finger bones (face and eye
# weights go to Head), renames them to the Mixamo names the game map uses, puts the model in metres facing -Y (glTF +Z),
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
# The '_facial' export is the same mesh with ARKit/FACS blendshapes; the plain export is the fallback.
fbx = os.path.join(SRC, 'Assets', 'Avatars', 'Professions', AVATAR, 'Export', AVATAR + '_facial.fbx')
if not os.path.exists(fbx):
    fbx = fbx.replace('_facial.fbx', '.fbx')

# Expression morphs kept for the game (sums of the source ARKit shapes; pairs merged where the game never
# needs the sides apart).
EXPRESSIONS = {
 'expr_blinkL': ['AK_09_EyeBlinkLeft'], 'expr_blinkR': ['AK_10_EyeBlinkRight'],
 'expr_squint': ['AK_19_EyeSquintLeft', 'AK_20_EyeSquintRight'], 'expr_wide': ['AK_21_EyeWideLeft', 'AK_22_EyeWideRight'],
 'expr_jawOpen': ['AK_25_JawOpen'], 'expr_funnel': ['AK_32_MouthFunnel'],
 'expr_smile': ['AK_44_MouthSmileLeft', 'AK_45_MouthSmileRight'], 'expr_stretch': ['AK_46_MouthStretchLeft', 'AK_47_MouthStretchRight'],
 'expr_browUp': ['AK_03_BrowInnerUp'], 'expr_browDown': ['AK_01_BrowDownLeft', 'AK_02_BrowDownRight'],
 'expr_cheekPuff': ['AK_06_CheekPuff'], 'expr_press': ['AK_36_MouthPressLeft', 'AK_37_MouthPressRight'],
 # Eyes: 'left'/'right' are the player's own left and right.
 'expr_eyesLeft': ['AK_15_EyeLookOutLeft', 'AK_14_EyeLookInRight'], 'expr_eyesRight': ['AK_16_EyeLookOutRight', 'AK_13_EyeLookInLeft'],
 'expr_eyesUp': ['AK_17_EyeLookUpLeft', 'AK_18_EyeLookUpRight'], 'expr_eyesDown': ['AK_11_EyeLookDownLeft', 'AK_12_EyeLookDownRight'],
 # A full grin (camera celebration): smile with raised cheeks, upper lip lifted off the teeth, dimples.
 'expr_grin': ['AK_44_MouthSmileLeft', 'AK_45_MouthSmileRight', 'AK_07_CheekSquintLeft', 'AK_08_CheekSquintRight', ('AK_48_MouthUpperUpLeft', .6),
               ('AK_49_MouthUpperUpRight', .6), ('AK_34_MouthLowerDownLeft', .45), ('AK_35_MouthLowerDownRight', .45), ('AK_28_MouthDimpleLeft', .5),
               ('AK_29_MouthDimpleRight', .5)],
}

KEEP = {
 'Bip01 Pelvis': 'Hips', 'Bip01 Spine': 'Spine', 'Bip01 Spine1': 'Spine1', 'Bip01 Spine2': 'Spine2',
 'Bip01 Neck': 'Neck', 'Bip01 Head': 'Head',
 'Bip01 L Clavicle': 'LeftShoulder', 'Bip01 L UpperArm': 'LeftArm', 'Bip01 L Forearm': 'LeftForeArm', 'Bip01 L Hand': 'LeftHand',
 'Bip01 R Clavicle': 'RightShoulder', 'Bip01 R UpperArm': 'RightArm', 'Bip01 R Forearm': 'RightForeArm', 'Bip01 R Hand': 'RightHand',
 'Bip01 L Thigh': 'LeftUpLeg', 'Bip01 L Calf': 'LeftLeg', 'Bip01 L Foot': 'LeftFoot', 'Bip01 L Toe0': 'LeftToeBase',
 'Bip01 R Thigh': 'RightUpLeg', 'Bip01 R Calf': 'RightLeg', 'Bip01 R Foot': 'RightFoot', 'Bip01 R Toe0': 'RightToeBase',
}
# Fingers (Biped Finger0 = thumb ... Finger4 = little finger, three segments each): the game poses them
# (relaxed, fists, the camera frame), src/human-body.js poseHands.
for side, S in (('L', 'Left'), ('R', 'Right')):
    for f, finger in enumerate(('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')):
        for seg in range(3):
            KEEP[f'Bip01 {side} Finger{f}{seg or ""}'] = f'{S}Hand{finger}{seg + 1}'

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

# Face landmarks from the face bones (metres, before they are merged away).
def bone_pos(name):
    return arm.matrix_world @ arm.data.bones[name].head_local
eye = (bone_pos('Bip01 REye') + bone_pos('Bip01 LEye')) / 2
head_co = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
FACE = {'eyes': eye.z, 'nose': bone_pos('Bip01 MNose').z - 0.02, 'nose_y': min(c.y for c in head_co if abs(c.x) < .01 and abs(c.z - eye.z + .04) < .02),
        'mouth': bone_pos('Bip01 MUpperLip').z - 0.008, 'chin': bone_pos('Bip01 MUpperLip').z - 0.058, 'brow': eye.z + 0.03,
        'ear_y': eye.y + 0.07, 'head_y': bone_pos('Bip01 Head').y}
print('FACE', {k: round(v, 3) for k, v in FACE.items()})

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
# Expressions first: sums of source shapes relative to the basis; every other source shape is dropped.
source = {k.name: k for k in me0.shape_keys.key_blocks} if me0.shape_keys else {}
if source:
    basis = me0.shape_keys.key_blocks[0]
    base = [d.co.copy() for d in basis.data]
    deltas = {}
    for key, parts in EXPRESSIONS.items():
        parts = [p if isinstance(p, tuple) else (p, 1.0) for p in parts]  # (shape, amount)
        missing = [p for p, _ in parts if p not in source]
        if missing:
            print('MISSING', key, missing)
            continue
        deltas[key] = [sum(((source[p].data[i].co - base[i]) * f for p, f in parts), Vector()) for i in range(len(base))]
    for k in list(me0.shape_keys.key_blocks)[1:]:
        mesh.shape_key_remove(k)
    for key, d in deltas.items():
        sk = mesh.shape_key_add(name=key, from_mix=False)
        for i, v in enumerate(d):
            sk.data[i].co = base[i] + v
    print('EXPRESSIONS', len(deltas))
else:
    basis = mesh.shape_key_add(name='Basis', from_mix=False)
for key, amounts in MORPHS.items():
    sk = mesh.shape_key_add(name=key, from_mix=False)
    for v in me0.vertices:
        w = sum(amounts.get(names_by_index[g.group], 0) * g.weight for g in v.groups)
        if w:
            sk.data[v.index].co = v.co + v.normal * w

# Face-shape morphs on the head (the game's face sliders, src/face-settings.js FACE_SHAPE). Displacements
# are smooth functions of position around the face landmarks (metres, model faces -Y), so lids, eyeballs and
# teeth move together. Landmarks are read from the face bones before they were merged.
import math
def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)
def band(v, a, b, soft=0.012):
    return smooth((v - a) / soft + 0.5) * smooth((b - v) / soft + 0.5)
F = FACE
def front(y):  # 0 behind the ears, 1 on the face
    return smooth((F['ear_y'] - y) / 0.05)
def face_morph(name, c):
    x, y, z = c.x, c.y, c.z
    ax, fw = abs(x), front(y)
    sx = 1 if x >= 0 else -1
    if name == 'face_width':   return Vector((x * 0.14 * fw * band(z, F['chin'], F['brow'] + .02, .03), 0, 0))
    if name == 'face_jaw':     return Vector((sx * 0.014 * smooth(ax / 0.045) * band(z, F['chin'] - .01, F['mouth'] + .012, .02) * smooth((F['ear_y'] + .03 - y) / .04), 0, 0))
    if name == 'face_chin':    w = band(z, F['chin'] - .03, F['mouth'] - .008, .02) * fw * smooth((0.04 - ax) / 0.03); return Vector((0, -0.006 * w, -0.014 * w))
    if name == 'face_cheek':   w = band(z, F['nose'] - .01, F['eyes'] - .004, .018) * band(ax, .035, .085, .02) * fw; return Vector((sx * 0.008 * w, -0.005 * w, 0))
    if name == 'face_nose':    w = band(z, F['nose'] - .012, F['eyes'] - .006, .014) * smooth((0.022 - ax) / 0.012) * smooth((F['nose_y'] + .035 - y) / .02); return Vector((0, -0.012 * w, 0))
    if name == 'face_noseWidth': w = band(z, F['nose'] - .014, F['nose'] + .02, .012) * smooth((0.03 - ax) / 0.012) * smooth((F['nose_y'] + .04 - y) / .02); return Vector((x * 0.35 * w, 0, 0))
    if name == 'face_mouth':   w = band(z, F['mouth'] - .016, F['mouth'] + .012, .01) * smooth((0.04 - ax) / 0.015) * fw; return Vector((x * 0.25 * w, 0, 0))
    if name == 'face_lips':    w = band(z, F['mouth'] - .012, F['mouth'] + .01, .008) * smooth((0.028 - ax) / 0.012) * smooth((F['nose_y'] + .03 - y) / .015); return Vector((0, -0.005 * w, 0))
    if name == 'face_brow':    w = band(z, F['eyes'] + .008, F['brow'], .012) * smooth((0.07 - ax) / 0.02) * fw; return Vector((0, -0.005 * w, 0.004 * w))
    if name == 'face_depth':   return Vector((0, (y - F['head_y']) * 0.1 * band(z, F['chin'] - .03, 2.5, .03), 0))
    return Vector()
head_index = [i for i, m in enumerate(me0.materials) if m.name.endswith('_head') or m.name == 'head']
head_verts = {v for p in me0.polygons if p.material_index in head_index for v in p.vertices}
hair_index = [i for i, m in enumerate(me0.materials) if m.name.endswith('_opacity') or m.name == 'hair']
head_verts |= {v for p in me0.polygons if p.material_index in hair_index for v in p.vertices}
for key in ('face_width', 'face_jaw', 'face_chin', 'face_cheek', 'face_nose', 'face_noseWidth', 'face_mouth', 'face_lips', 'face_brow', 'face_depth'):
    sk = mesh.shape_key_add(name=key, from_mix=False)
    for i in head_verts:
        co = me0.vertices[i].co
        sk.data[i].co = co + face_morph(key, co)

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
    if not len(gs):
        return 'Hips'
    n = names[max(gs, key=lambda g: g.weight).group]
    return n[:n.index('Hand') + 4] if 'Hand' in n else n  # fingers count as the hand for the kit mask
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
