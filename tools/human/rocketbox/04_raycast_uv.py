# Turns 468 face-landmark pixel positions (detect_landmarks.py, on a 03_render_face.py render) into head
# texture UV coordinates: each landmark's camera ray is cast at the same rest-pose mesh, and the hit
# triangle's UV is read off by barycentric interpolation. Points that miss the mesh (mostly the face oval's
# outer edge, occluded by the ear or outside the silhouette at this camera angle) are filled from their
# nearest hit neighbour on the canonical face mesh (assets/human/canonical-face.json triangulation) so every
# one of the 468 entries has a usable UV.
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python 04_raycast_uv.py -- <plain glb> <camera.json> <landmarks.json> <avatar> <out.json> <canonical-face.json>
import bpy, sys, json, math
from mathutils import Vector, Matrix
from mathutils.geometry import barycentric_transform

GLB, CAMERA_JSON, LANDMARKS_JSON, AVATAR, OUT, CANONICAL = [a for a in sys.argv[sys.argv.index('--') + 1:]]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
mesh_obj = bpy.data.objects['Player']
mesh_obj.data.shape_keys.key_blocks['Basis'].value = 1.0
for k in mesh_obj.data.shape_keys.key_blocks[1:]:
    k.value = 0.0
depsgraph = bpy.context.evaluated_depsgraph_get()
mesh_obj.data.update()

cam_info = json.load(open(CAMERA_JSON))
cam_matrix = Matrix([list(row) for row in cam_info['matrix_world']])
origin = cam_matrix.translation
half_width = math.tan(cam_info['lens_angle'] / 2)

landmarks = json.load(open(LANDMARKS_JSON))['points']
scene = bpy.context.scene

uv_layer = mesh_obj.data.uv_layers.active.data


def hit_uv(x, y):
    ndc_x, ndc_y = (x - .5) * 2, (.5 - y) * 2
    dir_local = Vector((ndc_x * half_width, ndc_y * half_width, -1)).normalized()
    direction = (cam_matrix.to_3x3() @ dir_local).normalized()
    ok, location, _normal, index, obj, _matrix = scene.ray_cast(depsgraph, origin, direction)
    if not ok or obj.name != 'Player':
        return None
    poly = mesh_obj.data.polygons[index]
    if len(poly.vertices) != 3:
        return None
    verts = [mesh_obj.matrix_world @ mesh_obj.data.vertices[i].co for i in poly.vertices]
    uvs = [uv_layer[li].uv for li in poly.loop_indices]
    hit = barycentric_transform(location, verts[0], verts[1], verts[2], Vector((*uvs[0], 0)), Vector((*uvs[1], 0)), Vector((*uvs[2], 0)))
    # Blender's re-imported UV is bottom-left origin; the shipped GLB (and this game's texture sampling,
    # src/human-body.js tex() flipY=false) is glTF's top-left origin, so v is flipped back here.
    return [hit.x, 1 - hit.y]


raw = [hit_uv(p[0], p[1]) for p in landmarks]
misses = sum(1 for u in raw if u is None)

# Fill misses from the nearest hit landmark by 3D distance on MediaPipe's canonical face mesh (stable across
# avatars, unlike this render's own pixel positions near the silhouette).
canonical = json.load(open(CANONICAL))
canon_uv = canonical['uv']


def canon_xy(i):
    return canon_uv[i]


filled = list(raw)
if misses:
    hit_indices = [i for i, u in enumerate(raw) if u is not None]
    for i, u in enumerate(raw):
        if u is not None:
            continue
        cx, cy = canon_xy(i)
        nearest = min(hit_indices, key=lambda j: (canon_xy(j)[0] - cx) ** 2 + (canon_xy(j)[1] - cy) ** 2)
        filled[i] = raw[nearest]

with open(OUT, 'w') as f:
    json.dump({'avatar': AVATAR, 'uv': filled, 'misses': misses}, f)
print(json.dumps({'avatar': AVATAR, 'hits': 468 - misses, 'misses': misses, 'out': OUT}))
