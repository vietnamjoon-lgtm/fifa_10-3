# Renders a straight-on close-up of a Rocketbox football player's face with its own head texture, for the
# one-time face-landmark calibration (build-face-landmarks-uv step). Blender's glTF importer cannot read the
# meshopt-compressed player GLBs shipped in assets/human/rocketbox, so the caller decompresses a temporary
# copy first (npx @gltf-transform/cli copy). Writes <avatar>-face.png and <avatar>-camera.json (Blender/OpenGL
# camera intrinsics and world transform, metres) to tools/human/rocketbox/.cache/.
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python 03_render_face.py -- <plain glb> <head jpg> <avatar id>
import bpy, sys, os, json, math
from mathutils import Vector

GLB, HEAD_TEX, AVATAR = [a for a in sys.argv[sys.argv.index('--') + 1:]]
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
os.makedirs(CACHE, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
mesh = bpy.data.objects['Player']
mesh.data.shape_keys.key_blocks['Basis'].value = 1.0
for k in mesh.data.shape_keys.key_blocks[1:]:
    k.value = 0.0

# Head material gets its painted texture (the export kept materials but not images).
head_mat = next(s.material for s in mesh.material_slots if s.material.name == 'head')
head_mat.use_nodes = True
nt = head_mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = bpy.data.images.load(HEAD_TEX)
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])

bones = arm.pose.bones
head_world = arm.matrix_world @ bones['Head'].head
# Eye centre, src/human-body.js bindData: 9.9 cm above and 8.6 cm in front of the Head bone, model faces -Y.
eye = head_world + Vector((0, -0.086, 0.099))
cam_data = bpy.data.cameras.new('FaceCam')
cam_data.lens_unit = 'FOV'
cam_data.angle = math.radians(28)
cam = bpy.data.objects.new('FaceCam', cam_data)
bpy.context.collection.objects.link(cam)
distance = 0.62
cam.location = eye + Vector((0, -distance, 0))
cam.rotation_euler = (math.radians(90), 0, 0)  # points -Y like the character's own forward, +Z up
bpy.context.scene.camera = cam

world = bpy.data.worlds.new('World')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.4
bpy.context.scene.world = world
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(55), 0, math.radians(35))
bpy.context.collection.objects.link(sun)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
N = 1024
scene.render.resolution_x = scene.render.resolution_y = N
scene.render.image_settings.file_format = 'PNG'
out_png = os.path.join(CACHE, f'{AVATAR}-face.png')
scene.render.filepath = out_png
bpy.ops.render.render(write_still=True)

cam.matrix_world  # ensure evaluated
camera_json = {
    'lens_angle': cam_data.angle, 'sensor_fit': cam_data.sensor_fit, 'clip_start': cam_data.clip_start, 'clip_end': cam_data.clip_end,
    'resolution': N, 'matrix_world': [list(row) for row in cam.matrix_world],
}
with open(os.path.join(CACHE, f'{AVATAR}-camera.json'), 'w') as f:
    json.dump(camera_json, f)
print(json.dumps({'avatar': AVATAR, 'render': out_png, 'head_world': list(head_world), 'eye': list(eye)}))
