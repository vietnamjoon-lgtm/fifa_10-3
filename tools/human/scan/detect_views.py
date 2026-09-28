# MediaPipe's 468 face points on each render of a scan (the same legacy face_mesh API and pinned version as
# tools/human/rocketbox/detect_landmarks.py; runs in tools/human/rocketbox/.cache/venv). Each view also gets a
# frontal score: 1 when the nose tip sits halfway between the eyes, less as the face turns away.
#   python detect_views.py <views.json> <out.json>
import sys, json
import cv2
import mediapipe as mp

views = json.load(open(sys.argv[1]))
out = []
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=False, min_detection_confidence=.3) as mesh:
    for view in views:
        image = cv2.imread(view['png'])
        result = mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB)) if image is not None else None
        if not result or not result.multi_face_landmarks:
            out.append(None)
            continue
        p = [[q.x, q.y, q.z] for q in result.multi_face_landmarks[0].landmark]
        eyes = [(p[33][0] + p[133][0]) / 2, (p[362][0] + p[263][0]) / 2]
        span = abs(eyes[1] - eyes[0]) or 1e-6
        score = max(0.0, 1 - abs(p[1][0] - sum(eyes) / 2) / span) * min(1.0, span * 8)
        out.append({'landmarks': p, 'score': score})
json.dump(out, open(sys.argv[2], 'w'))
print(json.dumps({'views': len(views), 'faces': sum(1 for o in out if o)}))
