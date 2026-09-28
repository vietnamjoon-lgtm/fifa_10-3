# Blender half of the face-scan tool (tools/human/scan/make-face-pack.mjs runs it; one job file per call):
#   views   - import the scan, keep its largest piece (drops specks and loose bits), render it from several
#             directions (or one given camera) for the face detector; cameras go to <out>/views.json
#   raycast - each detected landmark's camera ray onto the scan: its 3D point, or null
#   fit     - the scan turned onto the game head, cut below the neck, the head's face vertices pulled onto the scan
#             surface, and the scan's colour baked into the head's own UV layout (plus the blend mask)
# Positions in and out are glTF axes (+Y up, face along +Z, metres), the game's `kitBind` space; Blender's own is
# +Z up, so they are converted at the edges (to_b / to_g).
#   Blender --background --python tools/human/scan/scan_blender.py -- <job.json>
import bpy, bmesh, sys, os, json, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

job = json.load(open(sys.argv[sys.argv.index('--') + 1:][0]))
OUT = job['out']
os.makedirs(OUT, exist_ok=True)
to_b = lambda p: Vector((p[0], -p[2], p[1]))
to_g = lambda v: [v.x, v.z, -v.y]
G2B = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def load_scan():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = job['scan']
    if path.lower().endswith(('.glb', '.gltf')):
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        bpy.ops.wm.obj_import(filepath=path)
    parts = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    scan = bpy.context.view_layer.objects.active
    scan.name = 'Scan'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if job.get('transform'):  # scan -> game head, a 4x4 in glTF axes (row-major)
        T = Matrix(job['transform'])
        scan.data.transform(G2B @ T @ G2B.inverted())
    keep_largest(scan, job.get('below'))
    return scan


def keep_largest(obj, below=None):
    """Keeps the largest connected piece (by faces); with `below` (glTF y, metres) first drops faces under it."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if below is not None:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if max(v.co.z for v in f.verts) < below], context='FACES')
    bm.faces.ensure_lookup_table()
    seen, best = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, piece = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            piece.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        if len(piece) > len(best):
            best = piece
    keep = {f.index for f in best}
    dropped = len(bm.faces) - len(keep)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    print('CLEAN dropped', dropped, 'faces')


def light_scene():
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
    bpy.context.scene.world = world
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 2.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(20))
    bpy.context.collection.objects.link(sun)


def camera(eye, target, up, angle, size):
    data = bpy.data.cameras.new('Cam')
    data.lens_unit = 'FOV'
    data.angle = angle
    cam = bpy.data.objects.new('Cam', data)
    bpy.context.collection.objects.link(cam)
    f = (target - eye).normalized()
    r = f.cross(up).normalized()
    u = r.cross(f)
    cam.matrix_world = Matrix((( r.x, u.x, -f.x, eye.x), (r.y, u.y, -f.y, eye.y), (r.z, u.z, -f.z, eye.z), (0, 0, 0, 1)))
    bpy.context.scene.camera = cam
    s = bpy.context.scene
    s.render.resolution_x = s.render.resolution_y = size
    return cam


def render(path):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE'
    s.render.image_settings.file_format = 'PNG'
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)


def views():
    scan = load_scan()
    light_scene()
    out = []
    if job.get('frontal'):
        # The same camera the head calibration used (tools/human/rocketbox/03_render_face.py): 62 cm in front of
        # the eye centre, 28 degrees, looking back along -Z (glTF).
        eye = to_b(job['frontal'])
        cams = [(eye + Vector((0, -.62, 0)), eye, Vector((0, 0, 1)), math.radians(28), 1024)]
    else:
        lo = Vector([min(v.co[k] for v in scan.data.vertices) for k in range(3)])
        hi = Vector([max(v.co[k] for v in scan.data.vertices) for k in range(3)])
        centre, radius = (lo + hi) / 2, (hi - lo).length / 2
        cams = []
        for up in (Vector((0, 0, 1)), Vector((0, -1, 0)), Vector((0, 1, 0))):
            side = Vector((1, 0, 0)) if abs(up.x) < .9 else Vector((0, 1, 0))
            other = up.cross(side).normalized()
            for k in range(8):
                a = k * math.pi / 4
                d = side * math.cos(a) + other * math.sin(a)
                cams.append((centre + d * radius * 2.4, centre, up, math.radians(30), 768))
    for i, (eye, target, up, angle, size) in enumerate(cams):
        cam = camera(eye, target, up, angle, size)
        path = os.path.join(OUT, f'view-{i:02d}.png')
        render(path)
        out.append({'png': path, 'angle': angle, 'matrix': [list(r) for r in cam.matrix_world]})
        bpy.data.objects.remove(cam, do_unlink=True)
    json.dump(out, open(os.path.join(OUT, 'views.json'), 'w'))
    print('VIEWS', len(out))


def raycast():
    scan = load_scan()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    view = job['view']
    m = Matrix(view['matrix'])
    origin, half = m.translation, math.tan(view['angle'] / 2)
    points = []
    for x, y, *_ in job['landmarks']:
        d = (m.to_3x3() @ Vector(((x - .5) * 2 * half, (.5 - y) * 2 * half, -1)).normalized()).normalized()
        ok, loc, *_ = bpy.context.scene.ray_cast(depsgraph, origin, d)
        points.append([round(c, 6) for c in to_g(loc)] if ok else None)
    json.dump(points, open(os.path.join(OUT, 'hits.json'), 'w'))
    print('HITS', sum(1 for p in points if p), 'of', len(points))


def fit():
    scan = load_scan()
    tree = BVHTree.FromObject(scan, bpy.context.evaluated_depsgraph_get())
    head = job['head']
    moved, pulled = [], 0
    # Face vertices onto the scan surface: the nearest point within 2.5 cm, fully within 1.2 cm, by `snap` weight.
    for p, w in zip(head['points'], head['snap']):
        v = to_b(p)
        if w > 0:
            hit = tree.find_nearest(v, .025)
            if hit[0] is not None:
                d = (hit[0] - v).length
                k = w * max(0.0, min(1.0, (.025 - d) / .013))
                v = v + (hit[0] - v) * k
                pulled += k > .5
        moved.append([round(c, 6) for c in to_g(v)])
    json.dump(moved, open(os.path.join(OUT, 'fitted.json'), 'w'))
    print('PULLED', pulled, 'of', len(moved))
    # Bake target: the game head with its fitted positions and its own UVs (glTF v runs down, Blender's up).
    me = bpy.data.meshes.new('Head')
    tris = head['index']
    me.from_pydata([to_b(p) for p in moved], [], [tris[i:i + 3] for i in range(0, len(tris), 3)])
    uv = me.uv_layers.new(name='UV')
    for loop in me.loops:
        u, v = head['uv'][loop.vertex_index]
        uv.data[loop.index].uv = (u, 1 - v)
    mask = me.color_attributes.new('mask', 'FLOAT_COLOR', 'POINT')
    for i, w in enumerate(head['texture']):
        mask.data[i].color = (w, w, w, 1)
    target = bpy.data.objects.new('Head', me)
    bpy.context.collection.objects.link(target)
    size = job.get('size', 1024)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = 4
    s.render.bake.margin = 6

    def bake(name, kind, selected):
        img = bpy.data.images.new(name, size, size, alpha=True, float_buffer=False)
        img.generated_color = (0, 0, 0, 0)
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        node = nt.nodes.new('ShaderNodeTexImage')
        node.image = img
        nt.nodes.active = node
        if kind == 'EMIT':
            attr = nt.nodes.new('ShaderNodeVertexColor')
            attr.layer_name = 'mask'
            em = nt.nodes.new('ShaderNodeEmission')
            nt.links.new(attr.outputs['Color'], em.inputs['Color'])
            nt.links.new(em.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
        target.data.materials.clear()
        target.data.materials.append(mat)
        bpy.ops.object.select_all(action='DESELECT')
        if selected:
            scan.select_set(True)
        target.select_set(True)
        bpy.context.view_layer.objects.active = target
        if kind == 'EMIT':
            bpy.ops.object.bake(type='EMIT', use_selected_to_active=False)
        else:
            bpy.ops.object.bake(type='EMIT', use_selected_to_active=True, cage_extrusion=.008, max_ray_distance=.03)
        img.filepath_raw = os.path.join(OUT, name + '.png')
        img.file_format = 'PNG'
        img.save()

    # The scan's own colour, whatever shader the app's export set up: each material's base-colour image (or
    # colour) drives an emission shader, so the bake is the texture itself with no lighting in it.
    for mat in scan.data.materials:
        if not mat:
            continue
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        em = nt.nodes.new('ShaderNodeEmission')
        src = bsdf and bsdf.inputs['Base Color']
        if src and src.links:
            nt.links.new(src.links[0].from_socket, em.inputs['Color'])
        elif src:
            em.inputs['Color'].default_value = src.default_value
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    bake('bake', 'SCAN', True)
    bake('mask', 'EMIT', False)
    print('BAKED', size)


{'views': views, 'raycast': raycast, 'fit': fit}[job['mode']]()
