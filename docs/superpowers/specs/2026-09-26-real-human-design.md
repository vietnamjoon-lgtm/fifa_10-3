# 사람 모델 다시 만들기 (ROADMAP 10단계) 설계

- 날짜: 2026-09-26
- 브랜치: `work/01-human-v2` (main `e40fa61`에서 분기)
- 담당: 1번 (선수·체형). 게임 연결 단계에서는 02·04·05번 파일도 관련됩니다.
- 전체 계획: [docs/ROADMAP-motion.md](../../ROADMAP-motion.md)

## 1. 목표와 범위

지금 선수는 피부가 매끈한 한 가지 재질이고, 머리카락은 칠한 모자 같고, 눈썹·속눈썹이 없고, 비율이 어색해서 사람처럼 보이지 않습니다. MPFB(MakeHuman의 Blender 확장)와 CC0 에셋으로 사람 모델을 Blender 백그라운드 스크립트로 만들고, 결과를 GLB로 내보냅니다.

- 이번 단계에서는 게임 코드(src/의 기존 파일)를 바꾸지 않습니다. 새 모델은 단독 뷰어 `human-lab.html`에서 확인합니다.
- 게임 연결(기존 선수 교체, 모션 매칭, 공 다루기)은 ROADMAP 4~7단계에서 합니다. 이 문서에서는 그때 필요한 약속(API, 대응표, 크기 데이터)만 정합니다.
- 사진으로 얼굴 만들기와 체형 편집은 이번에 빼고, 나중에 새 머리에 다시 연결합니다.
- 실제 선수 얼굴을 닮게 만들지 않습니다. 얼굴 수치는 임의로 섞고, 사진이나 실존 인물은 참고하지 않습니다.

## 2. 확인된 사실 (설계 근거)

| 항목 | 값 |
|---|---|
| MPFB | Blender 5.1.2 확장으로 설치됨 (build 20260722) |
| MPFB Mixamo 리그 | 몸 22뼈 + 손가락 30뼈 = 52뼈, 이름 앞에 `mixamorig:` |
| 몸 22뼈 | Hips, Spine, Spine1, Spine2, Neck, Head, 좌우 Shoulder·Arm·ForeArm·Hand, 좌우 UpLeg·Leg·Foot·ToeBase |
| MPFB 기본 메시 | 정점 19,158, 면 18,486 (보조 메시 포함) |
| 100STYLE | BVH, 60fps, cm, Y축 위, T포즈. 관절 23개(+끝점 5 = 28): Hips, Chest, Chest2, Chest3, Chest4, Neck, Head, 좌우 Collar·Shoulder·Elbow·Wrist, 좌우 Hip·Knee·Ankle·Toe. 손가락 없음. CC BY 4.0 |
| 지금 게임 | three r180 (vendor), 선수 13관절 리그, 원거리 판정은 카메라 거리 23 m. 선수 몸 충돌은 cannon-es 몸체가 아니라 `player-contact.js`의 반지름 계산(`playerRadius`)과 `ball-contact.js`의 다리 판정. 공 접촉 거리는 `assists.js` 상수(`footReach`, `footForward`) |

## 3. 리그

- **공통 뼈 이름**: 내보낼 때 `mixamorig:`를 뗍니다(`Hips`, `LeftUpLeg` 등). Three.js 애니메이션 바인딩에서 `:`가 문제를 일으키기 때문입니다.
- **LOD별 뼈**
  - near: 52뼈(손가락 포함)
  - mid·far: 몸 22뼈
  - 세 LOD는 몸 22뼈의 이름, 부모 관계, 기본 자세가 같습니다. near의 손가락은 Hand 아래에 붙은 추가 뼈라서, 22뼈짜리 애니메이션 하나로 세 LOD를 모두 움직입니다.
- **선수마다 스켈레톤 따로**: `SkeletonUtils.clone`으로 복제합니다. 메시 geometry, 텍스처, 재질 원본은 모든 선수가 공유합니다.
- **체형별 기본 뼈 위치**
  - MPFB로 체형 3종마다 리그를 다시 맞춘 기본 뼈 위치를 `rest-skeletons.json`으로 내보냅니다.
  - 게임에서 선수를 만들 때는 순서가 이렇습니다.
    1. 체형 모프 값을 적용합니다.
    2. 그 체형의 뼈 위치로 뼈를 옮깁니다.
    3. `skeleton.calculateInverses()`로 역행렬을 다시 계산합니다.
  - 이 순서라야 모프된 몸과 스키닝이 함께 맞게 움직입니다.
- **손 자세 자리**
  - near 손가락 뼈는 유지합니다.
  - `hand-poses.json`에 자세 프리셋 칸을 둡니다: `relaxed`, `open`, `fist`, `gk_catch`, `gk_punch`.
  - 이번에는 `relaxed`만 채우고, 나머지 칸은 골키퍼 작업 때 채웁니다.
  - API: `applyHandPose(skeleton, side, name, weight)`

### 3.1 기존 13관절 API 대응표 (`tools/human/maps/game13.json`)

| 기존 | 새 리그 | 규칙 |
|---|---|---|
| hips | Hips | 그대로 |
| torso | Spine, Spine1, Spine2 | 쓸 때는 회전을 30/30/40%로 나눔. 읽을 때는 Spine2 월드 회전 |
| head | Neck, Head | 40/60%로 나눔 |
| arms[i].upper | LeftArm / RightArm | Shoulder는 클립이 움직임 |
| arms[i].lower | LeftForeArm / RightForeArm | 그대로 |
| legs[i].upper | LeftUpLeg / RightUpLeg | 발 고정 IK의 첫 뼈 |
| legs[i].lower | LeftLeg / RightLeg | IK 둘째 뼈 |
| legs[i].foot | LeftFoot / RightFoot | 발목. ToeBase는 새로 추가된 뼈(발끝 차고 나가기) |

- `legs[0]`, `arms[0]`이 왼쪽인지 오른쪽인지는 1단계 스크립트에서 실제 위치로 확인해서 이 파일에 적습니다.
- 지금 코드에서는 `legs[0]`이 x가 음수인 쪽이고, 선수는 +z를 바라봅니다.

### 3.2 모캡 대응표

- `maps/100style.json`

  | 100STYLE | 새 리그 |
  |---|---|
  | Hips | Hips |
  | Chest | Spine |
  | Chest2 | Spine1 |
  | Chest3 + Chest4 | Spine2 (두 회전을 합성) |
  | Neck / Head | Neck / Head |
  | Collar | Shoulder |
  | Shoulder | Arm |
  | Elbow | ForeArm |
  | Wrist | Hand |
  | Hip | UpLeg |
  | Knee | Leg |
  | Ankle | Foot |
  | Toe | ToeBase |

- `maps/cmu.json`: CMU ASF 31뼈 → 22뼈. LowerBack·Spine·Spine1은 Spine 체인으로 가고, LHipJoint·RHipJoint는 버립니다.
- 리타게팅은 월드 회전 기준으로 기본 자세 차이(T포즈 → 우리 A포즈)를 보정합니다. 본격적인 파이프라인은 5단계입니다. 이번에는 확인용 최소 버전만 만듭니다(7장).

## 4. 키와 다리 길이

- 모델은 183 cm 하나로 만들고, 선수마다 **균일 스케일** `s = 키/183`(170~195 cm → 0.93~1.07)을 겁니다. 균일 스케일이라 스키닝과 관절 비율이 유지됩니다.
- **몸 크기 데이터** `bodyMetrics(player)`
  - 기본 뼈 위치와 `s`로 다음 값을 계산해 주는 함수입니다: `height`, `legLength`(UpLeg+Leg+발목 높이), `hipHeight`, `footLength`, `reach`(골반에서 발끝까지 최대), `shoulderWidth`, `bodyRadius`.
  - 게임에서 크기를 쓰는 곳은 모두 이 값을 쓰도록 연결합니다(연결은 4~7단계, 약속은 지금 정함).

    | 사용처 | 담당 | 쓰는 값 |
    |---|---|---|
    | 발 고정 IK (`foot-plant.js`) | 02 | 다리 뼈 길이는 스켈레톤에서 자동으로 스케일됨. 발바닥 높이, 소프트 IK 구간 |
    | 공 접촉 거리 (`assists.js`의 `footReach`·`footForward`, `ball-contact.js` 다리 판정) | 03·04 | `legLength` 비례 |
    | 몸 충돌 반지름 (`player-contact.js`의 `playerRadius`) | 04 | `bodyRadius`, 체형 반영 |

- **보폭과 재생 속도(발 미끄러짐 방지)**
  - 클립은 기준 다리 길이 `L0`(183 cm 모델)에서 만들어졌습니다. 스케일 `s`인 선수는 같은 클립을 재생하면 보폭이 `s`배가 됩니다.
  - 따라서 게임 속도 `v`에 맞추려면 클립 재생 속도를 이렇게 정합니다.
    - `rate = v / (s · v_clip)`
    - `v_clip`: 클립의 기준 속도(5단계 메타데이터의 루트 속도)
  - 모션 매칭(6단계)에서는 검색할 때 속도·위치 특징을 `s`로 나눠 **다리 길이 단위**로 비교합니다. 고른 클립의 루트 이동은 다시 `s`를 곱해 씁니다.
  - 속도가 같으면 키 큰 선수는 걸음 수가 적고 보폭이 커집니다(실제 사람과 같음).
  - 남는 오차는 발 고정 IK가 마지막으로 잡습니다.
  - 확인(7장): 스케일 0.93과 1.07에서 달리기 클립을 돌리고, 접지 중 발 이동 거리를 비교합니다(목표: 스케일 1.0과의 차이 1 cm 이하).

## 5. 겉모습

### 5.1 체형 (축구 선수)

| 체형 | 키 범위 | MPFB 설정 방향 |
|---|---|---|
| 날씬한 윙어형 `slim` | 170~180 cm | 체지방 0.2, 근육 0.55, 어깨 좁게, 허벅지·종아리 근육 + |
| 표준 미드필더형 `standard` | 175~185 cm | 체지방 0.25, 근육 0.65, 허벅지·종아리 근육 ++ |
| 큰 수비수·골키퍼형 `large` | 185~195 cm | 체지방 0.3, 근육 0.7, 골격·어깨 크게, 하체 근육 ++ |

- 가슴·팔 근육 타깃은 올리지 않습니다(보디빌더 체형 방지).
- 체형은 모프 타깃 3개로 넣습니다. 기준 모델은 `standard`이고, `slim`과 `large`는 기준과의 차이 모프입니다.

### 5.2 얼굴과 머리

- 얼굴 프리셋 8개: MPFB 얼굴 타깃(턱, 광대, 코, 눈, 입, 이마)을 조합해 셰이프키로 만듭니다. near·mid에만 넣습니다.
- 피부톤 4가지(MakeHuman 시스템 에셋의 남성 피부 텍스처 기반), 머리 모양 6개(짧은 머리 4~5, 긴 머리 1~2), 머리색 5가지를 섞어서 선수를 만듭니다.
- 머리카락 카드는 `alphaHash`를 기본으로 씁니다. 가장자리가 너무 거칠면 `alphaTest`와 비교해서 고릅니다. 투명 정렬은 쓰지 않습니다.
- 눈, 치아, 속눈썹은 near에만 넣습니다. 눈썹은 near에서는 카드로, mid·far에서는 피부 텍스처에 구워 넣습니다.

### 5.3 유니폼

- **종류 3가지**
  - `field_short`: 반팔 셔츠, 반바지, 양말, 축구화
  - `field_long`: 긴팔 셔츠, 반바지, 양말, 축구화
  - `gk`: 긴팔 셔츠, 반바지 또는 긴바지(옵션), 양말, 축구화, 장갑
- **몸 면 지우기 (종류별 마스크)**
  - 몸 메시에 정점마다 영역 번호 속성 `_REGION`을 넣습니다. 영역 경계는 모든 유니폼 종류의 밑단선을 합친 것입니다: 목, 윗팔 중간, 손목, 허리, 허벅지 중간, 무릎 아래, 발목, 손.
  - `kit-masks.json`에 종류별로 숨길 영역 목록을 적습니다. 밑단 안쪽 1 cm는 남기도록 영역을 나눕니다.
  - 불러올 때 영역 번호로 **종류별 인덱스 버퍼 3개**를 만듭니다. 정점 버퍼는 공유하고, 몸은 선수당 draw call 1번입니다.
  - 유니폼 종류를 바꾸면 몸 인덱스 버퍼와 유니폼 메시를 같이 바꿉니다.
- **정강이 보호대**: 양말 앞면의 정강이 25~75% 구간을 6 mm 더 띄워서 보호대 윤곽이 보이게 합니다.
- **팀 색과 선수별 요소**
  - 마스크 텍스처 채널로 영역을 나눕니다: R = 셔츠, G = 반바지(긴바지), B = 양말, A = 보조색(칼라·밑단 라인).
  - 셰이더 색 값은 `shirt`, `shorts`, `socks`, `trim` 4개이고, 각각 따로 바꿉니다.
  - 등번호·이름·앞번호는 두 번째 UV의 정해진 칸에 선수별 `CanvasTexture`로 붙입니다. 기본 텍스처는 공유합니다.
  - 축구화: 마스크로 갑피·밑창·줄무늬를 나누고, 선수별 색 값 3개로 바꿉니다.
  - 장갑: 손목 밴드와 손바닥 색을 선수별로 바꿉니다.
- 천 주름과 짜임은 노멀맵으로 굽습니다(Blender 절차 텍스처, 추가 다운로드 없음). 천 광택(sheen)은 성능 측정 뒤 LOD별로 켤지 정합니다.

## 6. LOD

| LOD | 삼각형 | 뼈 | 모프 | 텍스처 | 머리 |
|---|---|---|---|---|---|
| near | ≤ 25,000 | 52 | 체형 3 + 얼굴 8 | 피부 2K(색·노멀·거칠기), 유니폼 1K | 머리카락 카드, 눈·치아·속눈썹·눈썹 카드 |
| mid | ≤ 10,000 | 22 | 체형 3 + 얼굴 8 | 피부 1K, 유니폼 512 | 머리카락 껍질 한 겹(텍스처), 눈썹은 피부에 구움 |
| far | ≤ 5,000 | 22 | 체형 3만 | 피부 512, 유니폼 256 | 단순한 머리 메시, 머리카락 색만 칠함 |

- **전환 기준**: 화면에 보이는 선수 키(픽셀, 1080p 기준). near > 220 px, mid 80~220 px, far < 80 px. 들어갈 때와 나올 때 기준을 ±10% 다르게 둡니다.
- **전환할 때 튀지 않게**
  - 세 LOD가 같은 스켈레톤을 쓰니까 자세는 튀지 않습니다.
  - 모양 차이는 0.15초 동안 두 LOD를 같이 그리면서 **화면 디더링**(불투명, 픽셀 버리기)으로 교차합니다.
  - 같은 디더링을 그림자 패스(`customDepthMaterial`)에도 넣어서, 전환 중 그림자가 두 겹이 되거나 끊기지 않게 합니다. 그림자 모양은 확인 항목에 있습니다.
- 경기 카메라에서 LOD별로 몇 명씩 뜨는지는 지금 게임 카메라(`src/camera.js`)를 가져와 실측하고 문서에 적습니다.

## 7. 확인 항목

1. **스키닝 정지 자세**: 무릎 최대 굽힘, 킥 백스윙·팔로우스루(고관절 크게 굽힘), 어깨 올리기(세리머니), 허리 비틀기, 쪼그려 앉기. 체형 3종 × 유니폼 3종을 렌더합니다.
2. **모캡 재생 확인**
   - 클립: CMU 10_02 킥 전체, 100STYLE Neutral의 FR(앞으로 뛰기, 전력질주 구간 포함), SR(옆으로 뛰기), BR(뒤로 뛰기)과 스타일 1~2개
   - 방법: 확인용 최소 리타게팅(Blender, 월드 회전 기준)으로 체형 3종 × 유니폼 3종에서 **몸 뚫림 개수**를 셉니다. 목표는 0입니다.
     - 뚫림 판정은 밑단 근처 몸 정점에서 법선 방향으로 광선을 쏴서, 유니폼보다 밖으로 나온 정점 수를 세는 방식입니다.
   - 극단 조합 `large × 195 cm`, `slim × 170 cm`는 따로 표로 적습니다.
3. **키 스케일 발 미끄러짐**: 4장 방식으로 스케일 0.93 / 1.0 / 1.07에서 접지 중 발 이동 거리를 잽니다.
4. **22명 동시 fps**: 조합은 다음과 같고, 각 조합에서 피부 산란 근사와 천 광택을 켰을 때와 껐을 때를 모두 잽니다.
   - 전부 far
   - 6 mid + 16 far
   - 1 near + 6 mid + 15 far
   - 전부 near
5. **LOD 전환**: 디더링 교차가 본 화면과 그림자 모두에서 튀지 않는지 프레임 단위로 봅니다.
6. **기존 캐릭터와 나란히**: 정면, 측면, 클로즈업, 실제 경기 카메라 거리. 스튜디오 조명과 게임 조명 두 가지로 봅니다.
7. **용량**: near ≤ 6 MB(피부톤 1세트 포함, 추가 피부톤당 약 0.8 MB), mid ≤ 1.5 MB, far ≤ 0.4 MB, 경기 첫 로딩(mid + far + 피부톤 4개) ≤ 4 MB.
8. **legs[0] 좌우**: 결과를 `game13.json`에 적습니다.
9. **CREDITS.md**: MakeHuman 에셋(CC0), Poly Haven HDRI(CC0), 100STYLE(CC BY 4.0, 표기 필수), CMU. MPFB 애드온 자체는 저장소에 넣지 않습니다.

## 8. 렌더링

- 뷰어 조명 모드 두 가지
  - 스튜디오: Poly Haven CC0 HDRI 1K
  - 게임: 지금 게임의 조명·톤매핑·노출·카메라 설정을 그대로 가져온 모드
- 피부: 거칠기·노멀 텍스처와 가벼운 wrap 조명 산란 근사(`onBeforeCompile`)
- 천: `MeshPhysicalMaterial`의 sheen
- 둘 다 22명 fps를 재고, 무거우면 near에만 적용합니다.

## 9. 파일 구성

| 경로 | 내용 |
|---|---|
| `tools/human/build.sh` | 전체 빌드 (Blender 단계 → 압축 → 용량 확인) |
| `tools/human/config/humans.json` | 체형, 얼굴 프리셋, 피부톤, 머리 모양·색, 유니폼 종류 정의 |
| `tools/human/blender/01_body.py` | 기본 몸, 체형 모프, Mixamo 리그, `rest-skeletons.json`, legs[0] 좌우 확인, 몸 영역 `_REGION` |
| `tools/human/blender/02_faces.py` | 얼굴 프리셋 셰이프키 |
| `tools/human/blender/03_skin_bake.py` | 피부톤별 텍스처 굽기 (2K / 1K / 512), 눈썹 굽기 |
| `tools/human/blender/04_hair.py` | 머리카락 맞추기, near 카드 / mid 껍질 / far 단순 머리 |
| `tools/human/blender/05_kit.py` | 유니폼 3종, 정강이 보호대, 축구화, 장갑, 마스크 텍스처, 번호 칸 UV, `kit-masks.json` |
| `tools/human/blender/06_lod.py` | mid·far 만들기, 셰이프키·가중치 옮기기, 기본 자세 일치 확인 |
| `tools/human/blender/07_export.py` | LOD별 glTF 내보내기 (`mixamorig:` 제거) |
| `tools/human/blender/08_checks.py` | 정지 자세 렌더, 모캡 재생 뚫림 개수, 삼각형·뼈 수 보고서 |
| `tools/human/blender/retarget_min.py` | 확인용 최소 리타게팅 (100STYLE / CMU → 22뼈) |
| `tools/human/compress.mjs` | gltf-transform(meshopt, KTX2 ETC1S/UASTC), 용량 목표 확인 |
| `tools/human/maps/{game13,100style,cmu}.json` | 뼈 대응표 |
| `tools/human/hand-poses.json` | 손 자세 프리셋 칸 |
| `assets/human/*.glb`, `assets/human/*.json` | 결과물 (압축본만 커밋) |
| `human-lab.html`, `src/human-lab/*.js` | 단독 뷰어: LOD, 유니폼·색, 테스트 자세·모캡 재생, 조명 모드, fps, 기존 캐릭터 비교 |
| `vendor/three-addons/` | three r180의 GLTFLoader, KTX2Loader, basis transcoder, meshopt decoder, SkeletonUtils, BufferGeometryUtils |
| `tests/human-v2.test.mjs` | 대응표·기본 자세·용량·마스크 데이터 검사 |

- Blender 원본 파일(.blend)과 다운로드한 에셋 팩, 100STYLE·CMU 원본은 저장소에 넣지 않습니다. 빌드 때 로컬 경로(`tools/human/.cache/`, gitignore)에서 읽습니다.
- 새 파일은 `collaboration/ownership.json`에 1번 담당으로 추가합니다.

## 10. 설치·다운로드 (승인됨)

- MPFB 확장: 설치 완료
- makehuman system assets (267 MB, CC0): Blender 사용자 데이터에 둠
- Poly Haven HDRI 1K (CC0)
- `@gltf-transform/cli` (npx), KTX-Software `toktx` (brew)
- 100STYLE: 필요한 BVH만 zip에서 HTTP 범위 요청으로 받음. CMU 10_02 ASF/AMC는 공식 사이트에서 받음.

## 11. 진행 방식

- 스크립트는 `01_body.py`부터 하나씩 만들고, 스크립트가 끝날 때마다 렌더 이미지를 보여주고 멈춥니다.
- 확인 결과(표·이미지)는 `reports/human-v2/`에 모읍니다.
