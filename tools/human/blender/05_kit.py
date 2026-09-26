# Step 5: the short-sleeve outfield kit. Each piece is a copy of a body region pushed out along the
# normals, so it keeps the body's skin weights. Body faces fully under the kit are deleted (a ring
# under every hem is kept). The shirt gets a second UV 'Decal' for the number and name texture.
# Blender -b --python-exit-code 1 --python tools/human/blender/05_kit.py
import bpy, bmesh, os, sys, json
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import CACHE, OUT, config, fail, save_stage, open_stage, render_grid
cfg = config()

open_stage('04_hair')
body, rig = bpy.data.objects['Body'], bpy.data.objects['Rig']
mw = rig.matrix_world
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg)
me = ev.to_mesh()
co = [body.matrix_world @ v.co for v in me.vertices]  # evaluated body shape (shape keys applied)
normals = [(body.matrix_world.to_3x3() @ v.normal).normalized() for v in me.vertices]
ev.to_mesh_clear()
names = {g.index: g.name for g in body.vertex_groups}
visible = body.vertex_groups['body'].index


def strongest(v):
    return max(((names[x.group], x.weight) for x in v.groups if names.get(x.group) in rig.data.bones), key=lambda t: t[1], default=('Hips', 0))[0]


def along(bone, p):
    """0 at the bone head, 1 at its tail."""
    b = rig.data.bones[bone]
    h, t = mw @ b.head_local, mw @ b.tail_local
    d = t - h
    return (p - h).dot(d) / d.length_squared


hips_z = (mw @ rig.data.bones['Hips'].head_local).z
HEM_Z = hips_z + 0.07                                          # shirt hem / shorts waist
COLLAR_Z = (mw @ rig.data.bones['Neck'].head_local).z - 0.01  # neckline
SLEEVE, SHORTS_LEG, SOCK_TOP, BOOT_TOP = 0.5, 0.5, 0.14, 0.94  # fractions along the limb bone
piece = {}
for v in body.data.vertices:
    if not any(g.group == visible for g in v.groups):
        continue
    b, p = strongest(v), co[v.index]
    if b in ('Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder'):
        piece[v.index] = 'shirt'
    elif b in ('LeftArm', 'RightArm'):
        piece[v.index] = 'shirt' if along(b, p) < SLEEVE else None
    elif b == 'Neck':
        piece[v.index] = 'shirt' if p.z < COLLAR_Z else None
    elif b == 'Hips':
        piece[v.index] = 'shirt' if p.z > HEM_Z else 'shorts'
    elif b in ('LeftUpLeg', 'RightUpLeg'):
        piece[v.index] = 'shorts' if along(b, p) < SHORTS_LEG else None
    elif b in ('LeftLeg', 'RightLeg'):
        t = along(b, p)
        piece[v.index] = 'boots' if t > BOOT_TOP else 'socks' if t > SOCK_TOP else None
    elif b in ('LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'):
        piece[v.index] = 'boots'

OFFSET = {'shirt': 0.010, 'shorts': 0.007, 'socks': 0.003, 'boots': 0.006}
COLORS = {'shirt': (0.62, 0.03, 0.06, 1), 'shorts': (0.92, 0.92, 0.92, 1), 'socks': (0.62, 0.03, 0.06, 1), 'boots': (0.05, 0.05, 0.05, 1)}


def make_piece(kind):
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = 'Kit_' + kind
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    for k in obj.data.shape_keys.key_blocks if obj.data.shape_keys else []:
        k.value = 0.0 if k.name.startswith('face_') else k.value
    obj.shape_key_add(name='bake', from_mix=True)
    baked = [d.co.copy() for d in obj.data.shape_keys.key_blocks['bake'].data]
    obj.shape_key_clear()
    for i, c in enumerate(baked):
        obj.data.vertices[i].co = c
    for m in list(obj.modifiers):
        if m.type != 'ARMATURE':
            obj.modifiers.remove(m)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(piece.get(v.index) == kind for v in f.verts)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # Straight hems: move every open-edge vertex onto the cut it came from (a height for the
    # neckline, shirt hem and waist, a fraction along the bone for sleeves, shorts legs, socks, boots).
    layer = bm.verts.layers.int['_SRC']
    for v in [v for v in bm.verts if any(e.is_boundary for e in v.link_edges)]:
        src = v[layer]
        bone = strongest(body.data.vertices[src])
        p = obj.matrix_world.inverted() @ snap(kind, bone, co[src])
        v.co = p
    bm.normal_update()
    lift = OFFSET[kind]
    for v in bm.verts:
        v.co += v.normal * lift
    bm.to_mesh(obj.data)
    bm.free()
    mat = bpy.data.materials.new('Kit_' + kind)
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = COLORS[kind]
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.8 if kind != 'boots' else 0.35
    mat.use_backface_culling = False
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def snap(kind, bone, p):
    p = p.copy()
    limb = {'LeftArm': SLEEVE, 'RightArm': SLEEVE, 'LeftUpLeg': SHORTS_LEG, 'RightUpLeg': SHORTS_LEG}
    if bone in limb and kind in ('shirt', 'shorts'):
        cut = limb[bone]
    elif bone in ('LeftLeg', 'RightLeg') and kind in ('socks', 'boots'):
        t = along(bone, p)
        cut = SOCK_TOP if abs(t - SOCK_TOP) < abs(t - BOOT_TOP) else BOOT_TOP
    else:
        if kind == 'shirt' and abs(p.z - COLLAR_Z) < 0.06:
            p.z = COLLAR_Z
        elif kind in ('shirt', 'shorts') and abs(p.z - HEM_Z) < 0.06:
            p.z = HEM_Z
        return p
    b = rig.data.bones[bone]
    h, t = mw @ b.head_local, mw @ b.tail_local
    return p + (t - h) * (cut - along(bone, p))


# Remember original vertex ids through the bmesh edits with an integer layer.
idx = body.data.attributes.get('_SRC') or body.data.attributes.new('_SRC', 'INT', 'POINT')
for v in body.data.vertices:
    idx.data[v.index].value = v.index
kits = {k: make_piece(k) for k in ('shirt', 'shorts', 'socks', 'boots')}
boots = kits['boots']
sm = boots.modifiers.new('toes', 'SMOOTH')
sm.factor, sm.iterations = 0.9, 12
bpy.context.view_layer.objects.active = boots
bpy.ops.object.modifier_move_to_index(modifier='toes', index=0)
bpy.ops.object.modifier_apply(modifier='toes')

# Shin guard bulge on the sock front between 25 % and 75 % of the shin.
socks = kits['socks']
src = socks.data.attributes['_SRC']
for v in socks.data.vertices:
    s = src.data[v.index].value
    b = strongest(body.data.vertices[s])
    if b in ('LeftLeg', 'RightLeg'):
        t = along(b, co[s])
        if 0.25 < t < 0.75 and normals[s].y < -0.5:  # facing forward (-Y in Blender)
            w = 1 - abs(t - 0.5) / 0.25
            v.co += normals[s] * 0.006 * w

# Shirt decal UV: back (left half of the texture) and front (right half), orthographic projection.
shirt = kits['shirt']
uv = shirt.data.uv_layers.new(name='Decal')
x0, x1, z0, z1 = -0.22, 0.22, 1.02, 1.56
for poly in shirt.data.polygons:
    n = poly.normal
    for li in poly.loop_indices:
        p = shirt.data.vertices[shirt.data.loops[li].vertex_index].co
        u, w = (p.x - x0) / (x1 - x0), (p.z - z0) / (z1 - z0)
        if n.y > 0.35:      # back, seen from +Y: screen right is -x
            uv.data[li].uv = ((1 - u) * 0.5, w)
        elif n.y < -0.35:   # front
            uv.data[li].uv = (0.5 + u * 0.5, w)
        else:
            uv.data[li].uv = (-1.0, -1.0)
shirt.data.uv_layers.active_index = 0

# Delete body faces fully under the kit, keeping one ring of faces under every hem.
covered = {i for i, k in piece.items() if k}
bm = bmesh.new()
bm.from_mesh(body.data)
bm.verts.ensure_lookup_table()
inner = {v.index for v in bm.verts if v.index in covered and all(e.other_vert(v).index in covered for e in v.link_edges)}
gone = [f for f in bm.faces if all(v.index in inner for v in f.verts)]
bmesh.ops.delete(bm, geom=gone, context='FACES')
bm.to_mesh(body.data)
bm.free()
print('BODY faces removed under the kit', len(gone))
for k, o in kits.items():
    print('KIT', k, 'triangles', sum(len(p.vertices) - 2 for p in o.data.polygons))

save_stage('05_kit')

# Report render with the sample number/name texture on the shirt.
decal = bpy.data.images.load(os.path.join(CACHE, 'textures', 'decal_sample.png'))
nt = shirt.active_material.node_tree
bsdf = nt.nodes['Principled BSDF']
uvn = nt.nodes.new('ShaderNodeUVMap')
uvn.uv_map = 'Decal'
img = nt.nodes.new('ShaderNodeTexImage')
img.image = decal
img.extension = 'CLIP'
mix = nt.nodes.new('ShaderNodeMix')
mix.data_type = 'RGBA'
mix.inputs['A'].default_value = COLORS['shirt']
mix.inputs['B'].default_value = (0.97, 0.97, 0.97, 1)
nt.links.new(uvn.outputs['UV'], img.inputs['Vector'])
nt.links.new(img.outputs['Alpha'], mix.inputs['Factor'])
nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
hair = bpy.data.objects['Hair_short01']
items = [('반팔 유니폼', [body, bpy.data.objects['Eyes'], bpy.data.objects['Eyebrows'], hair] + list(kits.values()))]
bpy.data.objects['Hair_afro01'].hide_render = True
render_grid(items, '05-kit', res=(520, 900))
print('DONE 05_kit')
