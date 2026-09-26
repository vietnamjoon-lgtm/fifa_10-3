# Human assets and local face fitting

- MakeHuman base mesh, default skeleton/weights and target data: https://github.com/makehumancommunity/makehuman ; data license CC0, full text in MAKEHUMAN-CC0.md. Only data was used, not MakeHuman application code. Converted and retargeted by tools/build-human.mjs; generated anatomy-data.js.
- License clarification: https://static.makehumancommunity.org/about/license.html
- @mediapipe/tasks-vision 1.0.1: official npm package, Apache-2.0. Runtime files are in vendor/mediapipe. Full license: MEDIAPIPE-APACHE-2.txt.
- Face Landmarker model: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Official model documentation: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
- MediaPipe model and runtime are served locally by this game. Photos are analyzed locally using the CPU delegate. No third-party photo analysis endpoint is used.
- CMU locomotion/kick data attribution remains in the existing motion license files. Seven skill moves and 42 celebration sequences are authored approximations, not extracted Nexon/EA animation assets.

## Player model v2 (assets/human/, ROADMAP stage 10, branch work/01-human-v2)

| File | Source | License |
|---|---|---|
| `player.glb` body, face presets, eyes, eyebrows, hair | MakeHuman base mesh and targets through MPFB 2 (Blender extension, build 20260722); makehuman_system_assets: skins young_caucasian_male, young_african_male, eyes low-poly (brown), eyebrow001, hair short01, afro01 | CC0 (declared in each asset file header; list in reports/human-v2/assets-licenses.json) |
| `skin_light/brown/dark.ktx2` | young_caucasian_male / 50 % mix / young_african_male diffuse maps, resized to 1024 | CC0 |
| `hair_*.ktx2`, `eyes.ktx2`, `eyebrows.ktx2` | textures of the assets above, resized | CC0 |
| Kit, boots, number layout | made in this repo by tools/human/blender/05_kit.py from the body surface | this project |
| Rig | MPFB "mixamo" standard rig, finger bones removed (22 bones) | CC0 (MPFB output) |

- The MPFB add-on (GPL-3.0) is not in this repository; only its CC0 output is. See https://static.makehumancommunity.org/mpfb/faq/use_in_closed_source.html
- vendor/three-addons: three.js r180 examples (GLTFLoader, KTX2Loader, basis transcoder, meshopt decoder, SkeletonUtils), MIT, license in vendor/three-addons/LICENSE.
- Planned motion data: 100STYLE (CC BY 4.0, credit "The 100STYLE Dataset - Ian Mason") and CMU; not used yet in these files.
