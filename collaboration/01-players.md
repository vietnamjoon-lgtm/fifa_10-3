# 01번 — 선수·얼굴·체형

작업 브랜치: `work/01-players`. 저장소 전체를 받아 실행하되 아래 담당 파일을 중심으로 수정합니다. 다른 사람 파일은 먼저 해당 담당자와 변경 범위를 정합니다.

## 첫 작업

가상 예시 얼굴과 체형을 기준으로 닮음, 목·어깨·팔 연결, 편집 미리보기의 일관성을 개선합니다.

## 담당 파일

- `src/anatomical-player.js`
- `src/anatomy-data.js`
- `src/body-rig.js`
- `src/body-shape.js`
- `src/body-studio.js`
- `src/default-face.js`
- `src/face-assets.js`
- `src/face-fit-worker.js`
- `src/face-fit.js`
- `src/face-identity.js`
- `src/face-settings.js`
- `src/face-studio.js`
- `src/human-head.js`
- `src/player-editor.js`
- `src/player-portrait.js`
- `src/player-ratings.js`
- `src/player.js`
- `src/sculpted-head.js`
- `src/skinned-player.js`
- `src/squads.js`
- `src/assets/**`

## 담당 검사 파일

- `tests/body-customization.test.mjs`
- `tests/faces.test.mjs`
- `tests/identity-and-keeper-v2.test.mjs`

검사 파일에 다른 분야의 사례가 포함돼 있으면 그 분야 담당자의 확인도 받습니다. 다른 파트는 이 파일을 직접 고치기보다 추가할 사례를 담당자에게 전달합니다.

## 완료 기준

- 정면·측면의 동일한 카메라 전후 사진을 비교합니다.
- 키 155~210 cm와 체중 45~125 kg, 팔다리 비율 극단값에서도 관절 연결을 확인합니다.
- 편집 적용·취소·저장·새로고침과 이전 선수 저장 파일 호환을 확인합니다.

공통 선수 필드를 바꾸면 04번의 경기 계산과 05번의 온라인 전달에 영향을 알립니다. 모션 계산은 02번 담당입니다.

## Claude에 그대로 전달하기

> 이 저장소의 CLAUDE.md, COLLABORATION.md, collaboration/01-players.md를 읽으세요. 내 담당은 01번 선수·얼굴·체형입니다. 가상 예시 얼굴과 체형을 기준으로 닮음, 목·어깨·팔 연결, 편집 미리보기의 일관성을 개선합니다. 먼저 현재 코드와 재현 장면을 확인하고 작은 수정부터 하세요. 위 담당 파일을 중심으로 작업하고 다른 담당 파일이 필요하면 변경 이유와 연결 규격을 먼저 공유하세요. 실제 사용자 선수나 사진 저장소를 초기화하지 마세요. 관련 검사, 전체 검사 183개 이상의 결과와 웹 빌드, 전후 비교, 확인하지 못한 점을 기록하세요. 작업 브랜치에 커밋하고 main을 대상으로 PR을 제출하세요. main 직접 푸시와 운영 배포는 하지 마세요.

전체 실행·업데이트·PR 순서는 [공동작업 안내](../COLLABORATION.md)를 따릅니다.
