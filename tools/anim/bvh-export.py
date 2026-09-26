# Blender step of the 100STYLE conversion: import a BVH with Blender's own importer, evaluate the armature on every
# frame of the requested range and write joint positions and world rotations (relative to the BVH rest pose) as JSON.
# Coordinates are converted back to the BVH frame: Y up, metres, character's right at -x, facing +z at rest.
#
# Run with Blender (`blender -b -P tools/anim/bvh-export.py -- in.bvh out.json start end`) or with the `bpy`
# module from PyPI (`python3 tools/anim/bvh-export.py in.bvh out.json start end`). Frame numbers are BVH frames
# counted from 0, as in 100STYLE's Frame_Cuts.csv; `end` is exclusive.
import json
import sys

import bpy
from mathutils import Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
source, target, start, end = args[0], args[1], int(args[2]), int(args[3])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_anim.bvh(filepath=source, global_scale=0.01, frame_start=0, use_fps_scale=False,
                        update_scene_fps=True, update_scene_duration=True, rotate_mode='NATIVE',
                        axis_forward='-Z', axis_up='Y')
armature = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
scene = bpy.context.scene
end = min(end, int(armature.animation_data.action.frame_range[1]) + 1)

# Blender (Z up, -Y forward after the importer's conversion) -> BVH (Y up, +Z forward).
to_bvh = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))
to_bvh_q = to_bvh.to_quaternion()


def vec(v):
    v = to_bvh @ v
    return [round(v.x, 6), round(v.y, 6), round(v.z, 6)]


def quat(q):
    q = to_bvh_q @ q @ to_bvh_q.conjugated()
    return [round(q.x, 7), round(q.y, 7), round(q.z, 7), round(q.w, 7)]


world = armature.matrix_world
bones = armature.data.bones
rest = {b.name: {'head': vec(world @ b.head_local), 'tail': vec(world @ b.tail_local),
                 'parent': b.parent.name if b.parent else None} for b in bones}
rest_inverse = {b.name: (world @ b.matrix_local).to_quaternion().inverted() for b in bones}
frames = []
for frame in range(start, end):
    scene.frame_set(frame)
    pose = {}
    for pb in armature.pose.bones:
        m = world @ pb.matrix
        pose[pb.name] = {'p': vec(m.translation), 'q': quat(m.to_quaternion() @ rest_inverse[pb.name])}
    frames.append(pose)

with open(target, 'w') as f:
    json.dump({'source': source.split('/')[-1], 'fps': round(scene.render.fps / scene.render.fps_base, 3),
               'start': start, 'rest': rest, 'frames': frames}, f)
print('exported', len(frames), 'frames of', source, 'fps', scene.render.fps / scene.render.fps_base)
