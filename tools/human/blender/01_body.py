# Step 1: the standard footballer body at 1.83 m with the MPFB Mixamo rig.
# Writes .cache/01_body.blend, assets/human/rest-skeleton.json and reports/human-v2/01-body.jpg.
# Blender -b --python-exit-code 1 --python tools/human/blender/01_body.py
import bpy, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import ROOT, OUT, mpfb, config, fail, save_stage, clear_scene, render_grid
from bl_ext.blender_org.mpfb.entities.objectproperties import HumanObjectProperties
HumanService, TargetService, RigService, LocationService = mpfb()
cfg = config()
H = cfg['referenceHeight']
TARGETS = LocationService.get_mpfb_data('targets')
BODY22 = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm',
          'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg',
          'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']


def body_height(obj):
    """Height of the visible body (vertex group 'body'), with shape keys evaluated."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    g = obj.vertex_groups['body'].index
    zs = [(obj.matrix_world @ v.co).z for v in me.vertices if any(x.group == g for x in v.groups)]
    ev.to_mesh_clear()
    return max(zs) - min(zs)


clear_scene()
spec = cfg['bodies']['standard']
macro = TargetService.get_default_macro_info_dict()
macro.update(spec['macro'])
body = HumanService.create_human(macro_detail_dict=macro, scale=0.1)
body.name = 'Body'
for t, w in spec['targets'].items():
    path = os.path.join(TARGETS, t + '.target.gz')
    if not os.path.exists(path):
        fail('missing target ' + t)
    TargetService.load_target(body, path, weight=w)

# The height macro also changes proportions, so search it for the reference height.
lo, hi = 0.0, 1.0
for _ in range(14):
    mid = (lo + hi) / 2
    HumanObjectProperties.set_value('height', mid, entity_reference=body)
    TargetService.reapply_macro_details(body)
    if body_height(body) < H:
        lo = mid
    else:
        hi = mid
height = body_height(body)
print('HEIGHT', round(height, 4), 'macro', round(mid, 4))
if abs(height - H) > 0.005:
    fail(f'height {height:.3f} != {H}')

before = {o.name for o in bpy.data.objects if o.type == 'ARMATURE'}
HumanService.add_builtin_rig(body, 'mixamo')
rig = [o for o in bpy.data.objects if o.type == 'ARMATURE' and o.name not in before][0]
rig.name = 'Rig'
for b in rig.data.bones:
    b.name = b.name.replace('mixamorig:', '')
for g in body.vertex_groups:
    g.name = g.name.replace('mixamorig:', '')
missing = [b for b in BODY22 if b not in rig.data.bones]
if missing:
    fail('missing bones ' + ', '.join(missing))


def gltf(v):  # Blender Z up, -Y forward  ->  glTF Y up, +Z forward
    return [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]


bones = {b.name: {'parent': b.parent.name if b.parent else None, 'head': gltf(rig.matrix_world @ b.head_local), 'tail': gltf(rig.matrix_world @ b.tail_local)}
         for b in rig.data.bones if b.name in BODY22}

# Side check for game13.json: facing +z in glTF, the player's left is +x.
left_x, right_x = bones['LeftUpLeg']['head'][0], bones['RightUpLeg']['head'][0]
print('SIDES LeftUpLeg x', left_x, 'RightUpLeg x', right_x)
if not (left_x > 0 > right_x):
    fail('LeftUpLeg is not on +x after export axes')

# Body regions used later to hide skin under the kit. Assigned from the strongest bone weight.
REGIONS = {'head': 0, 'neck': 1, 'torso': 2, 'upperarm_hi': 3, 'upperarm_lo': 4, 'forearm': 5, 'hand': 6,
           'pelvis': 7, 'thigh_hi': 8, 'thigh_lo': 9, 'knee': 10, 'shin': 11, 'foot': 12}
attr = body.data.attributes.get('_REGION') or body.data.attributes.new('_REGION', 'INT', 'POINT')
names = {g.index: g.name for g in body.vertex_groups}


def strongest(v):
    best = max(((names[x.group], x.weight) for x in v.groups if names.get(x.group) in rig.data.bones), key=lambda t: t[1], default=(None, 0))
    return best[0] or 'Hips'


def mid_z(bone):
    b = rig.data.bones[bone]
    return (rig.matrix_world @ b.head_local).z * 0.5 + (rig.matrix_world @ b.tail_local).z * 0.5


counts = {}
for v in body.data.vertices:
    b, z = strongest(v), (body.matrix_world @ v.co).z
    if b == 'Head':
        r = 'head'
    elif b == 'Neck':
        r = 'neck'
    elif b in ('Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder'):
        r = 'torso'
    elif b.endswith('ForeArm'):
        r = 'forearm'
    elif b.endswith('Arm'):
        r = 'upperarm_hi' if z > mid_z(b) else 'upperarm_lo'
    elif 'Hand' in b:
        r = 'hand'
    elif b == 'Hips':
        r = 'pelvis'
    elif b.endswith('UpLeg'):
        r = 'thigh_hi' if z > mid_z(b) else 'thigh_lo'
    elif b.endswith('Leg'):
        r = 'knee' if z > (rig.matrix_world @ rig.data.bones[b].head_local).z - 0.08 else 'shin'
    else:
        r = 'foot'
    attr.data[v.index].value = REGIONS[r]
    counts[r] = counts.get(r, 0) + 1
print('REGIONS', counts)

with open(os.path.join(OUT, 'rest-skeleton.json'), 'w') as f:
    json.dump({'referenceHeight': H, 'units': 'm, glTF axes (Y up, +Z forward)', 'body': 'standard', 'bones': bones, 'regions': REGIONS}, f, indent=1)
save_stage('01_body')

# Report: rig shown as sticks next to the body, same four fixed views as every step.
rig.data.display_type = 'STICK'
rig.show_in_front = True
render_grid([('표준 미드필더형 183 cm', [body])], '01-body', res=(520, 900))
print('DONE 01_body')
