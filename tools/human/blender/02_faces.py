# Step 2: three face presets as shape keys face_f1..f3 (head and neck vertices only).
# Blender -b --python-exit-code 1 --python tools/human/blender/02_faces.py
import bpy, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import mpfb, config, fail, save_stage, open_stage, render_grid
HumanService, TargetService, RigService, LocationService = mpfb()
cfg = config()
TARGETS = LocationService.get_mpfb_data('targets')

open_stage('01_body')
body = bpy.data.objects['Body']
keys = body.data.shape_keys.key_blocks
basis = [v.co.copy() for v in keys[0].data]
head = {g.index for g in body.vertex_groups if g.name in ('Head', 'Neck')}
face_only = [any(x.group in head and x.weight > 0.05 for x in v.groups) for v in body.data.vertices]
saved = {k.name: k.value for k in keys}

for face in cfg['faces']:
    # Sum each face target's own offset from its reference key, weighted, on head and neck only.
    delta = [None] * len(basis)
    loaded = []
    for target, weight in face['targets'].items():
        path = os.path.join(TARGETS, target + '.target.gz')
        if not os.path.exists(path):
            fail('missing face target ' + target)
        TargetService.load_target(body, path, weight=weight)
        k = body.data.shape_keys.key_blocks[-1]
        ref = k.relative_key
        for i, only in enumerate(face_only):
            if only:
                d = (k.data[i].co - ref.data[i].co) * weight
                delta[i] = d if delta[i] is None else delta[i] + d
        loaded.append(k.name)
    for name in loaded:
        body.shape_key_remove(body.data.shape_keys.key_blocks[name])
    key = body.shape_key_add(name='face_' + face['id'], from_mix=False)
    key.relative_key = keys[0]
    for i in range(len(basis)):
        key.data[i].co = basis[i] + delta[i] if delta[i] is not None else basis[i].copy()
    key.value = 0.0

for k in body.data.shape_keys.key_blocks:
    k.value = saved.get(k.name, 0.0) if not k.name.startswith('face_') else 0.0
names = [k.name for k in body.data.shape_keys.key_blocks]
for face in cfg['faces']:
    if 'face_' + face['id'] not in names:
        fail('missing face_' + face['id'])
moved = {face['id']: max((body.data.shape_keys.key_blocks['face_' + face['id']].data[i].co - basis[i]).length for i in range(len(basis))) for face in cfg['faces']}
print('FACE max displacement (m)', {k: round(v, 4) for k, v in moved.items()})
save_stage('02_faces')

# Report: one row per face, head close-up from the four fixed views.
items = []
for face in cfg['faces']:
    o = body.copy()
    o.data = body.data.copy()
    bpy.context.scene.collection.objects.link(o)
    for k in o.data.shape_keys.key_blocks:
        if k.name.startswith('face_'):
            k.value = 1.0 if k.name == 'face_' + face['id'] else 0.0
    items.append((face['id'], [o]))
body.hide_render = True
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg)
me = ev.to_mesh()
head_z = max((body.matrix_world @ v.co).z for v in me.vertices) - 0.16  # evaluated: shape keys applied
ev.to_mesh_clear()
render_grid(items, '02-faces', res=(420, 480), frame_height=0.42, center_z=head_z)
print('DONE 02_faces')
