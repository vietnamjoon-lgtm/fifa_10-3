# A made-up "phone scan" for checking the face-scan tool without any real person: a Rocketbox adult (MIT, not one
# of the game's heads) cut to head, neck and shoulders, its hair cards dropped (a scan sees hair as a surface),
# triangulated and subdivided so its topology is nothing like the game head, with 0.3 mm noise, three floating
# specks, an arbitrary turn and position, written as a textured OBJ like the scan apps export.
#   Blender --background --python tools/human/scan/make_test_scan.py -- <Rocketbox checkout> Male_Adult_08 <out dir>
import bpy, bmesh, sys, os, glob, math, random
from mathutils import Vector, Matrix

SRC, AVATAR, OUT = sys.argv[sys.argv.index('--') + 1:][:3]
os.makedirs(OUT, exist_ok=True)
fbx = glob.glob(os.path.join(SRC, 'Assets', 'Avatars', '*', AVATAR, 'Export', AVATAR + '*.fbx'))[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
# Keep the rig's centimetre-to-metre scale and turn on the mesh before the rig goes.
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for o in list(bpy.data.objects):
    if o is not mesh:
        bpy.data.objects.remove(o, do_unlink=True)
mesh.modifiers.clear()
if mesh.data.shape_keys:
    mesh.shape_key_clear()
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bm = bmesh.new()
bm.from_mesh(mesh.data)
kind = lambda f: mesh.data.materials[f.material_index].name.rsplit('_', 1)[-1]
drop = [f for f in bm.faces if kind(f) == 'opacity' or (kind(f) == 'body' and min(v.co.z for v in f.verts) < 1.33)]
bmesh.ops.delete(bm, geom=drop, context='FACES')
bmesh.ops.triangulate(bm, faces=bm.faces[:])
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
random.seed(7)
for v in bm.verts:
    v.co += Vector([random.gauss(0, .0003) for _ in range(3)])
# Specks the scan app picked up around the person.
body_slot = next(i for i, m in enumerate(mesh.data.materials) if m.name.endswith('_body'))
for c in ((.22, .05, 1.45), (-.25, -.1, 1.62), (.05, .3, 1.75)):
    r = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=.012, matrix=Matrix.Translation(c))
    for f in {f for v in r['verts'] for f in v.link_faces}:
        f.material_index = body_slot
bm.to_mesh(mesh.data)
bm.free()
# Some turn, tilt and offset: the tool must find the face on its own.
mesh.matrix_world = Matrix.Translation((.31, -.12, .2)) @ Matrix.Rotation(math.radians(70), 4, 'Z') @ Matrix.Rotation(math.radians(8), 4, 'X') @ Matrix.Translation((0, 0, -1.6))
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# One texture per material, as PNG next to the OBJ.
for m in mesh.data.materials:
    name = m.name.rsplit('_', 1)[-1]
    tga = glob.glob(os.path.join(os.path.dirname(os.path.dirname(fbx)), 'Textures', f'*_{name}_color.tga'))
    if not tga:
        continue
    img = bpy.data.images.load(tga[0])
    img.scale(1024, 1024)
    img.filepath_raw = os.path.join(OUT, f'scan_{name}.png')
    img.file_format = 'PNG'
    img.save()
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = m.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(img.filepath_raw)
    m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
out = os.path.join(OUT, 'test-scan.obj')
bpy.ops.wm.obj_export(filepath=out, export_materials=True, path_mode='RELATIVE', export_normals=True, export_uv=True)
print('SCAN', out, len(mesh.data.polygons), 'faces')
