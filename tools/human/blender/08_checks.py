# Step 8 (3-day scope): does the body poke through the kit in large poses? From every kit vertex a ray
# goes outward along the cloth normal; if it meets the posed body within 3 cm, skin is outside the cloth
# there. (A nearest-point test does not work: the body has holes where it is hidden under the kit.)
# Reports counts per pose and a render of each pose.
# Blender -b --python-exit-code 1 --python tools/human/blender/08_checks.py
import bpy, os, sys, json, math
from mathutils.bvhtree import BVHTree
from mathutils import Vector, Euler
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import REPORT, open_stage, render_grid

open_stage('06_reduce')
rig = bpy.data.objects['Rig']
body = bpy.data.objects['Body']
KIT = ['Kit_shirt', 'Kit_shorts', 'Kit_socks', 'Kit_boots']
d = math.radians
# Bone-local rotations (Mixamo bones: X bends forward/back for legs and spine).
POSES = {
    'rest': {},
    'knee_max': {'LeftUpLeg': (d(-30), 0, 0), 'LeftLeg': (d(125), 0, 0)},
    'kick_backswing': {'RightUpLeg': (d(35), 0, 0), 'RightLeg': (d(100), 0, 0), 'LeftUpLeg': (d(-15), 0, 0)},
    'kick_follow': {'RightUpLeg': (d(-95), 0, 0), 'RightLeg': (d(10), 0, 0)},
    'arms_up': {'LeftArm': ('aim', (0.35, 0.0, 0.94)), 'RightArm': ('aim', (-0.35, 0.0, 0.94))},  # celebration: both arms overhead
    'waist_twist': {'Spine': (0, d(20), 0), 'Spine1': (0, d(15), 0), 'Spine2': (0, d(10), 0)},
    'squat': {'LeftUpLeg': (d(-100), 0, 0), 'RightUpLeg': (d(-100), 0, 0), 'LeftLeg': (d(120), 0, 0), 'RightLeg': (d(120), 0, 0), 'Spine': (d(25), 0, 0)},
}


def set_pose(spec):
    """Euler triples are bone-local; ('aim', dir) turns the bone to point along dir in armature space."""
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        value = spec.get(pb.name)
        if value is None:
            continue
        if value[0] == 'aim':
            rest = pb.bone.matrix_local.to_quaternion()
            turn = (pb.bone.tail_local - pb.bone.head_local).rotation_difference(Vector(value[1]))
            pb.rotation_quaternion = rest.inverted() @ turn @ rest
        else:
            pb.rotation_quaternion = Euler(value, 'XYZ').to_quaternion()
    bpy.context.view_layer.update()


def evaluated(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    m3 = obj.matrix_world.to_3x3()
    verts = [obj.matrix_world @ v.co for v in me.vertices]
    normals = [(m3 @ v.normal).normalized() for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return verts, polys, normals


results = {}
for name, spec in POSES.items():
    set_pose(spec)
    bv, bp, _ = evaluated(body)
    tree = BVHTree.FromPolygons(bv, bp)
    counts = {}
    for k in KIT:
        kv, _, kn = evaluated(bpy.data.objects[k])
        through = 0
        for p, n in zip(kv, kn):
            hit = tree.ray_cast(p + n * 0.0005, n, 0.03)
            if hit[0] is not None:
                through += 1
        counts[k] = through
    results[name] = counts
    print('POSE', name, counts)
set_pose({})
with open(os.path.join(REPORT, '08-penetration.json'), 'w') as f:
    json.dump(results, f, indent=1)

# Render the poses (front and side are enough to see hems; the grid still shows all four views).
items = []
for name in ('knee_max', 'kick_backswing', 'kick_follow', 'arms_up', 'squat'):
    set_pose(POSES[name])
    snap = {}
    for o in [body, bpy.data.objects['Eyes'], bpy.data.objects['Eyebrows'], bpy.data.objects['Hair_short01']] + [bpy.data.objects[k] for k in KIT]:
        dg = bpy.context.evaluated_depsgraph_get()
        m = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        c = bpy.data.objects.new(f'{name}_{o.name}', m)
        c.matrix_world = o.matrix_world
        c.data.materials.clear()
        for mat in o.data.materials:
            c.data.materials.append(mat)
        bpy.context.scene.collection.objects.link(c)
        snap[o.name] = c
    items.append((name, list(snap.values())))
set_pose({})
for o in [body, bpy.data.objects['Eyes'], bpy.data.objects['Eyebrows'], bpy.data.objects['Hair_short01'], bpy.data.objects['Hair_afro01']] + [bpy.data.objects[k] for k in KIT]:
    o.hide_render = True
render_grid(items, '08-poses', res=(420, 700))
print('DONE 08_checks')
