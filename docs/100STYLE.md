# 100STYLE 클립 교체 (motion/100style-clips)

02번(애니메이션) 작업 기록입니다. CMU의 walk·jog·run·turn·stop 클립을 100STYLE Neutral 캡처로 바꾸는 작업이고, kick은 CMU 그대로 둡니다.

## 현재 상태 (2026-09-26)

- **`src/mocap-data.js`는 아직 CMU 데이터입니다.** 이 환경의 네트워크 정책이 zenodo.org를 막고 있어서(프록시 403) 원본 BVH를 받지 못했습니다.
- `CREDITS.md`의 100STYLE 항목은 교체 후를 기준으로 쓴 것입니다. 실제 데이터를 넣기 전에는 이 브랜치를 main에 머지하면 안 됩니다.
- 변환 도구는 끝까지 동작하는 것을 합성 데이터로 확인했습니다(아래).
- main(#31~#33)은 `fix/left-right`에 이미 들어 있는 머지를 그대로 가져왔습니다. 그래서 이 브랜치는 PR #30 → PR #34 → 이 브랜치 순서로 쌓여 있습니다.

## 실제 데이터로 교체하는 방법

```sh
# 1. https://zenodo.org/records/8127870 에서 100STYLE.zip을 받아 Neutral 파일만 풉니다
unzip -j 100STYLE.zip '*/Neutral/*' '*Frame_Cuts.csv' -d ~/.cache/100style
# 2. Blender 모듈 (Python 3.11): pip install bpy==4.2.0   또는 BLENDER=/path/to/blender
node tools/anim/convert-100style.mjs --report   # 후보 표만 확인
node tools/anim/convert-100style.mjs            # src/mocap-data.js, tools/anim/100style-selection.json 생성
node tools/anim/check-clips.mjs                 # 이음새·위상·좌우 규칙 검사
node --test --experimental-test-isolation=none tests/*.test.mjs
node tools/anim/measure-pops.mjs reports/anim-pops-100style.json 60 1,2,3   # CMU와 튐 비교
```

원본 BVH와 zip은 저장소에 넣지 않습니다(CREDITS.md 참고).

## 합성 데이터로 한 변환 도구 검증

`tools/anim/synthetic-100style.mjs`가 100STYLE과 같은 관절 이름·좌표계(Y 위, cm, +z 정면, 오른쪽 -x, 팔 T자)로 가짜 FW·FR·TR1 테이크를 만듭니다. 디딘 발은 땅에 완전히 고정되고 다리는 IK로 풉니다. 정답(속도, 왼발 착지 = 위상 0, 첫 턴은 왼쪽)을 알고 있으니, 변환 결과가 그 정답과 맞는지 보면 됩니다. 게임 데이터로 쓰는 것이 아닙니다.

```sh
node tools/anim/synthetic-100style.mjs /tmp/syn
STYLE100_DIR=/tmp/syn OUT_DATA=/tmp/syn/mocap-data.js OUT_REPORT=/tmp/syn/selection.json node tools/anim/convert-100style.mjs
node tools/anim/check-clips.mjs /tmp/syn/mocap-data.js
```

| 항목 | 만든 값 | 변환 결과 |
|---|---|---|
| walk 속도 | 1.3 / 1.45 / 1.6 m/s 구간 | 1.45 m/s 구간 선택 (목표 1.45) |
| jog / run 속도 | 3.1 / 4.8 m/s | 3.1 / 4.8 m/s |
| 오른발 착지 위상 (walk/jog/run) | 0.5 | 0.500 / 0.500 / 0.511 |
| 위상 0에서 앞에 있는 다리 | 왼다리 (`legs[1]`) | 세 클립 모두 왼다리 |
| 루프 이음새 | — | 0°, 각속도 차이 1e-15 이하 |
| turn | 첫 턴 왼쪽 100°, 180번 프레임 시작 | 왼쪽 91.2°, 177번 프레임 시작 |
| stop | 960번 프레임부터 1.3초 동안 4.8 → 0 m/s | 968번 프레임부터, 진입 속도 4.68 m/s, 감속 1.03초 |

- Blender 가져오기의 축 변환, 좌우, 위상 규칙이 합성 데이터에서는 맞게 나옵니다. 실제 캡처는 발뒤꿈치에서 발끝으로 구르고 잡음도 있어서, 접지 판정 임계값(4 cm, 1.1 m/s)은 실제 데이터로 다시 확인해야 합니다.
- 변환한 합성 클립을 `src/mocap-data.js` 자리에 잠시 넣고 전체 테스트를 돌리면 290개가 모두 통과합니다. 출력 형식이 `motion.js`와 테스트에 맞는다는 뜻입니다. 확인한 뒤 CMU 데이터로 되돌렸습니다.
- 수정 1건: stop 구간을 고를 때 감속 앞의 일정 속도 달리기까지 최대 150프레임을 거슬러 올라가서, 감속 시간이 2.5초로 잡혔습니다(실제 1.3초). 이제 최고 속도의 97% 아래로 떨어지기 시작하는 곳부터 자릅니다.

## main 머지 후 튐 측정

`tools/anim/measure-pops.mjs`로 AI 11대11 경기 60초를 쟀습니다. 클립은 두 쪽 모두 CMU입니다.

| | 이 브랜치 (머지 전) | main 머지 후 |
|---|---|---|
| seed 1, 2, 3 합계 | 570, 673, 680 (평균 641) | 731, 653, 533 (평균 639) |
| 상태 전환 순간 (평균) | 107 | 181 |
| 최대 (평균) | 101.4° | 102.3° |
| seed 5 합계 | 641 | 636 |

main에서 게임 로직(패스 밸런스, 수비 AI 등)이 바뀌어서 같은 seed라도 경기가 다르게 흘러갑니다. 그래서 같은 장면끼리 비교한 값이 아닙니다. 참고로 main 자체(e40fa61 이후 #31~#33, 튐 수정 없음)는 seed 5에서 5,613입니다.
