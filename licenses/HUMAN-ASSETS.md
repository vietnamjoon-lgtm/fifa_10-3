# Human assets and local face fitting

- MakeHuman base mesh, default skeleton/weights and target data: https://github.com/makehumancommunity/makehuman ; data license CC0, full text in MAKEHUMAN-CC0.md. Only data was used, not MakeHuman application code. Converted and retargeted by tools/build-human.mjs; generated anatomy-data.js.
- License clarification: https://static.makehumancommunity.org/about/license.html
- @mediapipe/tasks-vision 1.0.1: official npm package, Apache-2.0. Runtime files are in vendor/mediapipe. Full license: MEDIAPIPE-APACHE-2.txt.
- Face Landmarker model: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Official model documentation: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
- MediaPipe model and runtime are served locally by this game. Photos are analyzed locally using the CPU delegate. No third-party photo analysis endpoint is used.
- CMU locomotion/kick data attribution remains in the existing motion license files. Seven skill moves and 42 celebration sequences are authored approximations, not extracted Nexon/EA animation assets.
