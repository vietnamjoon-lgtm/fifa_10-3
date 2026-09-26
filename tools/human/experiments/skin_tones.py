# Task 2 comparison: the four young male skins, tinted or mixed variants for mid tones,
# and the middle-aged skins, on the same standard body with the fixed report cameras.
# Blender -b --python-exit-code 1 --python tools/human/experiments/skin_tones.py
import bpy, os, sys, re
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import mpfb, config, fail, clear_scene, render_grid
from bl_ext.blender_org.mpfb.services.assetservice import AssetService
HumanService, TargetService, RigService, LocationService = mpfb()
cfg = config()


def skin_path(name):
    p = AssetService.find_asset_absolute_path(f'{name}/{name}.mhmat', 'skins')
    return p or fail('skin not found ' + name)


def diffuse_of(name):
    with open(skin_path(name)) as f:
        for line in f:
            m = re.match(r'\s*diffuseTexture\s+(\S+)', line)
            if m:
                return os.path.join(os.path.dirname(skin_path(name)), os.path.basename(m.group(1)))
    fail('no diffuse texture in ' + name)


def base_color_link(mat):
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    link = bsdf.inputs['Base Color'].links[0]
    return nt, link.from_socket, bsdf.inputs['Base Color']


def tint(mat, hsv):
    nt, src, dst = base_color_link(mat)
    n = nt.nodes.new('ShaderNodeHueSaturation')
    n.inputs['Hue'].default_value = 0.5 + hsv[0]
    n.inputs['Saturation'].default_value = hsv[1]
    n.inputs['Value'].default_value = hsv[2]
    nt.links.new(src, n.inputs['Color'])
    nt.links.new(n.outputs['Color'], dst)


def mix(mat, other, factor):
    nt, src, dst = base_color_link(mat)
    img = nt.nodes.new('ShaderNodeTexImage')
    img.image = bpy.data.images.load(diffuse_of(other), check_existing=True)
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    m.inputs['Factor'].default_value = factor
    nt.links.new(src, m.inputs['A'])
    nt.links.new(img.outputs['Color'], m.inputs['B'])
    nt.links.new(m.outputs['Result'], dst)


clear_scene()
macro = TargetService.get_default_macro_info_dict()
macro.update(cfg['bodies']['standard']['macro'])
source = HumanService.create_human(macro_detail_dict=macro, scale=0.1)
eyes = None
try:
    before = set(bpy.data.objects)
    HumanService.add_mhclo_asset(AssetService.find_asset_absolute_path('high-poly/high-poly.mhclo', 'eyes'), source, asset_type='Eyes', subdiv_levels=0, material_type='MAKESKIN')
    eyes = [o for o in bpy.data.objects if o not in before][0]
except Exception as exc:
    print('EYES skipped:', exc)

variants = [(s['id'], s['base'], None) for s in cfg['skinTones']]
variants += [(t['id'] + ' (조정)', t['base'], t) for t in cfg['skinToneCandidates']['tinted']]
variants += [(m.replace('_male', '').replace('middleage_', 'middle '), m, None) for m in cfg['skinToneCandidates']['middleage']]

items = []
for label, base, spec in variants:
    o = source.copy()
    o.data = source.data.copy()
    bpy.context.scene.collection.objects.link(o)
    HumanService.set_character_skin(skin_path(base), o, skin_type='GAMEENGINE', material_instances=True)
    mat = o.active_material
    if spec and 'hsv' in spec:
        tint(mat, spec['hsv'])
    if spec and 'mix' in spec:
        mix(mat, spec['mix']['with'], spec['mix']['factor'])
    items.append((label, [o] + ([eyes] if eyes else [])))
source.hide_render = True

render_grid(items, '02b-skin-tones-body', res=(420, 700))
head_z = max((source.matrix_world @ v.co).z for v in source.data.vertices if any(g.group == source.vertex_groups['body'].index for g in v.groups)) - 0.12
render_grid(items, '02b-skin-tones-head', res=(420, 480), frame_height=0.42, center_z=head_z)
print('DONE skin tones')
