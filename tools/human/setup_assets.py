# Installs the MakeHuman system asset pack for MPFB and lists every skin, hair, eye,
# eyebrow, eyelash and teeth asset with the license written inside its own file.
# Blender -b --python-exit-code 1 --python tools/human/setup_assets.py
import os, sys, json, re, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, REPORT, mpfb, fail
from bl_ext.blender_org.mpfb.services.assetservice import AssetService

URL = 'https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip'
zip_path = os.path.join(CACHE, 'makehuman_system_assets_cc0.zip')
_, _, _, LocationService = mpfb()

if not AssetService.system_assets_pack_is_installed():
    if not os.path.exists(zip_path):
        print('DOWNLOAD', URL)
        urllib.request.urlretrieve(URL, zip_path)
    err = AssetService.check_asset_pack_zip(zip_path)
    if err not in (None, 'STRUCTURE', 'MACOS'):
        fail('asset pack zip: ' + err)
    err = AssetService.fix_and_extract_asset_pack_zip(zip_path, LocationService.get_user_data())
    if err:
        fail('asset pack extract: ' + err)
    AssetService.update_all_asset_lists()
if not AssetService.system_assets_pack_is_installed():
    fail('system assets not installed')


def license_of(path):
    """License declared by the asset file itself: a 'license' line or the CC0 release header."""
    with open(path, errors='ignore') as f:
        head = [next(f, '') for _ in range(40)]
    for line in head:
        m = re.match(r'\s*license\s+(.+)', line, re.I)
        if m:
            return m.group(1).strip()
    text = ' '.join(head)
    for name, pattern in (('CC0', r'\bCC0\b'), ('CC-BY', r'CC[- ]BY(?!-?NC)'), ('CC-BY-NC', r'CC[- ]BY[- ]NC'), ('AGPL', r'AGPL')):
        if re.search(pattern, text):
            return name
    return None


kinds = {'skins': 'mhmat', 'hair': 'mhclo', 'eyes': 'mhclo', 'eyebrows': 'mhclo', 'eyelashes': 'mhclo', 'teeth': 'mhclo'}
listing = {}
for sub, ext in kinds.items():
    files = AssetService.list_mhmat_assets(sub) if ext == 'mhmat' else AssetService.list_mhclo_assets(sub)
    data_root = LocationService.get_user_data()
    listing[sub] = sorted(({'name': os.path.splitext(os.path.basename(str(p)))[0], 'file': os.path.relpath(str(p), data_root), 'license': license_of(str(p))} for p in files), key=lambda a: a['name'])
with open(os.path.join(REPORT, 'assets-licenses.json'), 'w') as f:
    json.dump(listing, f, indent=1)
for sub, items in listing.items():
    print('ASSETS', sub, len(items), '|', ', '.join(f"{a['name']}[{a['license']}]" for a in items))
