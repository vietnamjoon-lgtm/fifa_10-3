# Runs MediaPipe's 468-point face mesh (same landmark topology as vendor/mediapipe's face_landmarker.task,
# and as vendor/mediapipe/canonical_face_model.obj) over a Blender render (03_render_face.py), for the
# one-time UV calibration (04_raycast_uv.py). Needs the real `mediapipe` PyPI package (Apache-2.0,
# tools/human/rocketbox/requirements.txt). Uses the legacy mediapipe.solutions.face_mesh API: on this
# machine the newer Tasks API's face detector graph crashes outside a GUI process (a macOS-only Metal
# helper calculator that needs a GPU service the Tasks graph never sets up here); the browser (the game's
# own @mediapipe/tasks-vision, WASM) is unaffected, and the two APIs share the same 468-point topology, so
# the calibration this produces still matches what the shipped game detects on a real photo.
#   python3 detect_landmarks.py <avatar>-face.png <avatar>-landmarks.json
import sys, json
import cv2
import mediapipe as mp

PNG, OUT = sys.argv[1], sys.argv[2]
image = cv2.imread(PNG)
if image is None:
    raise SystemExit(f'could not read {PNG}')
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=False, min_detection_confidence=.3) as mesh:
    result = mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
if not result.multi_face_landmarks:
    raise SystemExit(f'no face detected in {PNG}')
points = [[p.x, p.y, p.z] for p in result.multi_face_landmarks[0].landmark]
h, w = image.shape[:2]
with open(OUT, 'w') as f:
    json.dump({'width': w, 'height': h, 'points': points}, f)
print(json.dumps({'png': PNG, 'points': len(points), 'out': OUT}))
