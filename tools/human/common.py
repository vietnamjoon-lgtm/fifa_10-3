# Shared helpers for the Blender build steps in tools/human/blender/.
# Run every step with: Blender -b --python-exit-code 1 --python tools/human/blender/<step>.py
import bpy, os, sys, json, math, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(ROOT))
CACHE = os.path.join(ROOT, '.cache')
OUT = os.path.join(REPO, 'assets', 'human')
REPORT = os.path.join(REPO, 'reports', 'human-v2')
for d in (CACHE, OUT, REPORT):
    os.makedirs(d, exist_ok=True)


def mpfb():
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.targetservice import TargetService
    from bl_ext.blender_org.mpfb.services.rigservice import RigService
    from bl_ext.blender_org.mpfb.services.locationservice import LocationService
    return HumanService, TargetService, RigService, LocationService


def config():
    with open(os.path.join(ROOT, 'config', 'humans.json')) as f:
        return json.load(f)


def fail(msg):
    print('CHECK FAILED:', msg)
    sys.exit(1)


def save_stage(name):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(CACHE, name + '.blend'))


def open_stage(name):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(CACHE, name + '.blend'))


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


# Fixed report cameras: azimuth around the model in degrees (0 = looking at the face).
# Every report uses the same four views, framing and lights so images compare directly.
VIEWS = {'front': 0, 'side': 90, 'back': 180, 'threequarter': -45}
FRAME_HEIGHT = 2.1


def _ensure(scene, name, data):
    o = bpy.data.objects.get(name) or bpy.data.objects.new(name, data)
    if o.name not in scene.collection.objects:
        scene.collection.objects.link(o)
    return o


def _setup_studio(scene, res):
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys() else 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = False
    if not scene.world:
        scene.world = bpy.data.worlds.new('ReportWorld')
    scene.world.use_nodes = False
    scene.world.color = (0.62, 0.66, 0.70)
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0
    cam = _ensure(scene, 'ReportCam', bpy.data.cameras.get('ReportCam') or bpy.data.cameras.new('ReportCam'))
    cam.data.type = 'ORTHO'
    scene.camera = cam
    key = _ensure(scene, 'ReportKey', bpy.data.lights.get('ReportKey') or bpy.data.lights.new('ReportKey', 'SUN'))
    key.data.energy = 3.0
    key.rotation_euler = (math.radians(50), 0, math.radians(35))
    fill = _ensure(scene, 'ReportFill', bpy.data.lights.get('ReportFill') or bpy.data.lights.new('ReportFill', 'SUN'))
    fill.data.energy = 1.0
    fill.rotation_euler = (math.radians(70), 0, math.radians(-140))
    return cam


def render_grid(items, name, views=('front', 'side', 'back', 'threequarter'), res=(600, 900), frame_height=FRAME_HEIGHT, center_z=None):
    """Renders each (label, [objects]) item alone at the origin from the fixed views,
    then composes one grid PNG (rows = views, columns = items) at reports/human-v2/<name>.png."""
    scene = bpy.context.scene
    cam = _setup_studio(scene, res)
    cam.data.ortho_scale = frame_height
    cz = frame_height / 2 if center_z is None else center_z
    all_objs = {o for _, objs in items for o in objs}
    saved = {o: (o.hide_render, o.location.copy()) for o in all_objs}
    tiles = []
    tmp = os.path.join(CACHE, 'tiles')
    os.makedirs(tmp, exist_ok=True)
    for col, (label, objs) in enumerate(items):
        for o in all_objs:
            o.hide_render = o not in objs
        for row, view in enumerate(views):
            a = math.radians(VIEWS[view])
            cam.location = (12 * math.sin(a), -12 * math.cos(a), cz)
            cam.rotation_euler = (math.radians(90), 0, a)
            path = os.path.join(tmp, f'{name}_{col}_{row}.png')
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            tiles.append({'path': path, 'row': row, 'col': col, 'label': label, 'view': view})
    for o, (hidden, loc) in saved.items():
        o.hide_render = hidden
        o.location = loc
    out = os.path.join(REPORT, name + '.jpg')
    spec = os.path.join(tmp, name + '.json')
    with open(spec, 'w') as f:
        json.dump({'tiles': tiles, 'out': out, 'size': res}, f)
    subprocess.run(['python3', os.path.join(ROOT, 'compose_grid.py'), spec], check=True)
    return out
