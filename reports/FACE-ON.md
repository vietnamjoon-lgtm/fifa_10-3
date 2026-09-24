# 3D 선수 얼굴과 몸

2026-09-24. 게임: https://project-touchline-three.vercel.app/

## 사용법

1. 선수 · 팀 편집 → 선수 선택 → 페이스온 · 얼굴 편집.
2. 기본 표시 방식은 3D 얼굴입니다. 앞모습 사진을 선택하면 자동 분석합니다. 기존 사진은 **사진에서 3D 얼굴 만들기**를 다시 누릅니다.
3. 브라우저가 눈꺼풀·눈썹·코·입술·턱선의 54개 위치를 찾아 얼굴 메시와 피부색을 조정합니다. **분석 전 얼굴과 비교**로 변화를 확인하세요. 사진을 피부에 붙이지 않고 3D 두상의 형태를 바꿉니다.
4. 옆·뒤 사진은 수동 조절용 참고 자료입니다. 코 높이·두상 깊이 등을 미리보기와 비교해 다듬습니다. 14개 얼굴 형태 값을 지원합니다.
5. **이 선수에 적용** 후 **선수 설정 저장**을 누르면 다음 경기부터 적용됩니다.

사진이 없어도 직접 얼굴 비율을 조절할 수 있습니다. 가상 선수 예시 사진으로 얼굴 분석을 시험할 수 있습니다. 이전 사진 표면 방식도 선택할 수 있습니다. 눈 깜빡임·시선·입 움직임은 3D 얼굴 방식에 적용됩니다.

## 저장과 공유

사진은 이 브라우저의 IndexedDB, 선수 설정은 localStorage에 저장합니다. 얼굴 분석은 로컬 브라우저에서 실행하며 외부 분석 서비스로 사진을 보내지 않습니다. 분석기와 모델은 게임 주소에서 받습니다. 클라우드 계정 동기화는 없습니다.

온라인의 얼굴 공유는 기본 꺼짐입니다. 꺼두면 상대에게는 기본 얼굴·피부색이 전달됩니다. 켜면 얼굴 형태·피부색과 최대 32,000자 JPEG 표면을 경기 서버와 해당 상대에게 보냅니다. 원본 앞·옆·뒤 사진은 보내지 않습니다. 반복 경기 상태에는 사진을 포함하지 않습니다. 내 화면에는 공유 여부와 관계없이 로컬에 저장한 얼굴을 사용합니다.

선수 파일 내보내기는 사진·정렬·얼굴 형태와 팀 구성을 함께 저장하므로 개인 사진이 포함된 파일은 직접 보관하세요.

## 구현과 한계

MakeHuman CC0 인체 데이터를 13개 관절에 연결한 몸과 별도 3D 머리를 사용합니다. 기본 머리는 4,183개 정점이며 코·입술·귀·턱·눈을 입체적으로 표현합니다. 기존 단순 원통형 팔다리 대신 어깨·팔꿈치·손·무릎 구조가 있는 몸을 적용했습니다. 손가락 개별 관절과 천 시뮬레이션은 없습니다.

얼굴 분석은 MediaPipe의 478개 얼굴 랜드마크에서 54개 형상 제어점을 추출하고 기울기를 제거해 부드러운 변형장으로 3D 메시를 조정합니다. 정면 한 장으로 사람의 정확한 3D 얼굴을 복원하는 스캔 기능은 아닙니다. 옆·뒤 사진을 자동으로 합쳐 개인의 두상을 복원하지 않습니다. 표정·가림·조명·각도에 따라 닮음이 제한되며 코 깊이와 귀·머리 모양은 수동 조정이 필요할 수 있습니다. FC/FC Online의 선수 스캔이나 모션 자산은 사용하지 않았습니다.

검증: 자동 검사 143개 통과(경기 전체 포함), 가상 예시 정면 사진의 로컬 얼굴 분석·전후 비교·별도 로컬 저장소에서 저장 후 재접속 성공, 미리보기의 몸·얼굴·손·달리기·받기·세리머니 확인. 사용자 개인 사진은 검증용으로 업로드하거나 덮어쓰지 않았습니다. 배포 검증은 DEPLOYMENT.md를 참조하세요.

## 생성 이미지 기록

내장 image_gen 도구를 사용했습니다. 실제 인물의 사진을 입력하지 않았습니다.

- 원본: `src/assets/fictional-player-reference.png`
- 게임에서 합성한 기본 표면: `src/assets/default-face.jpg`
- 기본 표면의 피부색 메타데이터: `src/assets/default-face.json`
- 온라인 검증용 축소본: `tests/face-online-fixture.jpg`

최종 생성 프롬프트:

> Use case: photorealistic-natural. Asset type: production base-color texture source for a 3D football player's head. Generate a clean orthographic three-view reference sheet of ONE fictional 26-year-old Korean male football player, realistic natural human skin, dark brown eyes, subtle pores, short black cropped hair, clean-shaven, relaxed closed mouth, neutral expression, absolutely no resemblance to a named celebrity. Three equal-width vertical panels left to right: straight front, exact side profile with nose pointing RIGHT, straight back of same head. All three heads at identical scale and vertical alignment, top of hair at 3% image height, chin at 96%, eye line at 44%, nose bottom at 62%, mouth at 79%. Cropped head only, no shoulders, only tiny neck at bottom. Front face fills 84% of panel width. Side head fills similar width. Bright very soft flat diffuse cross-polarized studio light, minimal shadows, neutral matte gray background, crisp photographic detail. This is a utilitarian game texture reference, NOT stylized, NOT 3D render, no text, no panel borders, no logos. Landscape 1536x640 or similar aspect ratio 2.4:1.
