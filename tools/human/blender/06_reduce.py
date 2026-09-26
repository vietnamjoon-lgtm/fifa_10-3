# Step 6: one game LOD under 8,000 triangles with 22 bones.
# - body: drop MPFB helper geometry, bake the macro shape into the basis, keep only face_* keys
# - rig: finger weights merged into the hands, finger bones removed
# - every mesh decimated to a budget; face_* keys re-created on the reduced body, and on hair,
#   eyes and eyebrows, by Surface Deform from the full-resolution body
# Blender -b --python-exit-code 1 --python tools/human/blender/06_reduce.py
import bpy, bmesh, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import REPORT, config, fail, save_stage, open_stage, render_grid
cfg = config()
BUDGET = {'Body': 3000, 'Kit_shirt': 1100, 'Kit_shorts': 500, 'Kit_socks': 350, 'Kit_boots': 450, 'Hair_short01': 900, 'Hair_afro01': 900}
LIMIT = cfg['lod']['player']['maxTriangles']

open_stage('05_kit')
body, rig = bpy.data.objects['Body'], bpy.data.objects['Rig']


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def activate(o):
    for x in bpy.context.selected_objects:
        x.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)


# 1. Body: keep only visible body vertices; macro shape into the basis; face keys relative to it.
for m in list(body.modifiers):
    if m.type == 'MASK':
        body.modifiers.remove(m)
keys = body.data.shape_keys.key_blocks
face_names = [k.name for k in keys if k.name.startswith('face_')]
for k in keys:
    k.value = 0.0 if k.name.startswith('face_') else k.value
mix = body.shape_key_add(name='mix', from_mix=True)
basis_old = [d.co.copy() for d in keys[0].data]
mixed = [d.co.copy() for d in mix.data]
face_rel = {n: [keys[n].data[i].co - basis_old[i] for i in range(len(basis_old))] for n in face_names}
body.shape_key_clear()
for i, v in enumerate(body.data.vertices):
    v.co = mixed[i]
body.shape_key_add(name='Basis')
for n in face_names:
    k = body.shape_key_add(name=n)
    for i in range(len(mixed)):
        k.data[i].co = mixed[i] + face_rel[n][i]
bm = bmesh.new()
bm.from_mesh(body.data)
g = body.vertex_groups['body'].index
deform = bm.verts.layers.deform.active
bmesh.ops.delete(bm, geom=[v for v in bm.verts if g not in v[deform]], context='VERTS')
bm.to_mesh(body.data)
bm.free()
for vg in list(body.vertex_groups):
    if vg.name not in rig.data.bones:
        body.vertex_groups.remove(vg)
print('BODY visible triangles before reduction', tris(body))

# 2. Fingers -> hands.
fingers = [b.name for b in rig.data.bones if any(f in b.name for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'))]
for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    for side in ('Left', 'Right'):
        hand = o.vertex_groups.get(side + 'Hand')
        for name in [f for f in fingers if f.startswith(side)]:
            fg = o.vertex_groups.get(name)
            if not fg:
                continue
            if hand is None:
                hand = o.vertex_groups.new(name=side + 'Hand')
            for v in o.data.vertices:
                for x in v.groups:
                    if x.group == fg.index and x.weight > 0:
                        hand.add([v.index], x.weight, 'ADD')
            o.vertex_groups.remove(fg)
activate(rig)
bpy.ops.object.mode_set(mode='EDIT')
for name in fingers:
    rig.data.edit_bones.remove(rig.data.edit_bones[name])
bpy.ops.object.mode_set(mode='OBJECT')
print('BONES', len(rig.data.bones))
if len(rig.data.bones) != cfg['lod']['player']['bones']:
    fail('expected 22 bones')

# 3. Full-resolution copy of the body as the source of the face shapes.
src = body.copy()
src.data = body.data.copy()
src.name = 'BodySource'
bpy.context.scene.collection.objects.link(src)
for m in list(src.modifiers):
    src.modifiers.remove(m)


def decimate(o, budget):
    before = tris(o)
    if o.data.shape_keys:
        o.shape_key_clear()
    if before > budget:
        m = o.modifiers.new('reduce', 'DECIMATE')
        m.ratio = budget / before
        m.use_symmetry = True
        m.symmetry_axis = 'X'
        activate(o)
        bpy.ops.object.modifier_move_to_index(modifier='reduce', index=0)
        bpy.ops.object.modifier_apply(modifier='reduce')
    return before, tris(o)


def face_keys_from_source(o):
    """face_* keys on o, taken from the full-resolution body through Surface Deform."""
    activate(o)
    o.shape_key_add(name='Basis')
    sd = o.modifiers.new('faces', 'SURFACE_DEFORM')
    sd.target = src
    bpy.ops.object.modifier_move_to_index(modifier='faces', index=0)
    bpy.ops.object.surfacedeform_bind(modifier='faces')
    if not sd.is_bound:
        fail('surface deform did not bind for ' + o.name)
    for n in face_names:
        for k in src.data.shape_keys.key_blocks:
            k.value = 1.0 if k.name == n else 0.0
        bpy.context.view_layer.update()
        bpy.ops.object.modifier_apply_as_shapekey(modifier='faces', keep_modifier=True)
        o.data.shape_keys.key_blocks[-1].name = n
    for k in src.data.shape_keys.key_blocks:
        k.value = 0.0
    o.modifiers.remove(sd)


report = {}
for name, budget in BUDGET.items():
    report[name] = decimate(bpy.data.objects[name], budget)
for name in ('Body', 'Hair_short01', 'Hair_afro01', 'Eyes', 'Eyebrows'):
    face_keys_from_source(bpy.data.objects[name])
bpy.data.objects.remove(src, do_unlink=True)

counted = ['Body', 'Kit_shirt', 'Kit_shorts', 'Kit_socks', 'Kit_boots', 'Eyes', 'Eyebrows']
total = sum(tris(bpy.data.objects[n]) for n in counted)
per_hair = {h: total + tris(bpy.data.objects[h]) for h in ('Hair_short01', 'Hair_afro01')}
print('TRIANGLES', {n: tris(bpy.data.objects[n]) for n in counted + ['Hair_short01', 'Hair_afro01']})
print('TOTAL with hair', per_hair)
if max(per_hair.values()) > LIMIT:
    fail(f'over budget: {per_hair}')
with open(os.path.join(REPORT, '06-reduce.json'), 'w') as f:
    json.dump({'before_after': report, 'total_with_hair': per_hair, 'bones': len(rig.data.bones), 'face_keys': face_names}, f, indent=1)
save_stage('06_reduce')

items = []
for h, tone in (('Hair_short01', 'light'), ('Hair_afro01', 'dark')):
    b = body.copy()
    b.data = body.data.copy()
    bpy.context.scene.collection.objects.link(b)
    b.data.materials[0] = bpy.data.materials['Skin_' + tone]
    items.append((f'{h[5:]} · {per_hair[h]} 삼각형', [b, bpy.data.objects['Eyes'], bpy.data.objects['Eyebrows'], bpy.data.objects[h]] + [bpy.data.objects[n] for n in counted[1:5]]))
body.hide_render = True
render_grid(items, '06-reduce', res=(520, 900))
print('DONE 06_reduce')
