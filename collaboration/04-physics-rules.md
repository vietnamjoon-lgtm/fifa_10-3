# 04번 — 물리·판정·경기 엔진

작업 브랜치: `work/04-physics-rules`. 저장소 전체를 받아 실행하되 아래 담당 파일을 중심으로 수정합니다. 다른 사람 파일은 먼저 해당 담당자와 변경 범위를 정합니다.

## 첫 작업

빠른 공의 충돌, 몸싸움, 볼 선접촉/몸 선접촉 태클, 오프사이드와 경기 재개를 재현 장면별로 개선합니다.

## 담당 파일

- `src/ball-contact.js`
- `src/collision-math.js`
- `src/config.js`
- `src/contacts.js`
- `src/duel.js`
- `src/gameplay-settings.js`
- `src/match.js`
- `src/physics.js`
- `src/player-contact.js`
- `src/post-contact.js`
- `src/referee.js`
- `src/rules.js`
- `tools/soak.mjs`

## 담당 검사 파일

- `tests/engine-improvements.test.mjs`
- `tests/gameplay-overhaul.test.mjs`
- `tests/match.test.mjs`
- `tests/physics.test.mjs`
- `tests/rules.test.mjs`

검사 파일에 다른 분야의 사례가 포함돼 있으면 그 분야 담당자의 확인도 받습니다. 다른 파트는 이 파일을 직접 고치기보다 추가할 사례를 담당자에게 전달합니다.

## 완료 기준

- 태클 경로 밖의 상대에게 파울을 주지 않고 실제 몸 선접촉은 판정합니다.
- 공 먼저 접촉한 위험 태클과 페널티 지역 판정을 따로 확인합니다.
- 온라인과 오프라인이 같은 판정 모듈을 사용하고 양 팀에서 대칭으로 동작해야 합니다.
- 자동 경기의 종료, 유한한 좌표, 공의 지면 관통 여부를 확인합니다.

match.js와 duel.js는 이 담당자 한 명이 통합합니다. 02·03번이 연결 코드를 요구하면 담당자가 반영합니다. 온라인 메시지 포맷 변경은 05번과 조율합니다.

## Claude에 그대로 전달하기

> 이 저장소의 CLAUDE.md, COLLABORATION.md, collaboration/04-physics-rules.md를 읽으세요. 내 담당은 04번 물리·판정·경기 엔진입니다. 빠른 공의 충돌, 몸싸움, 볼 선접촉/몸 선접촉 태클, 오프사이드와 경기 재개를 재현 장면별로 개선합니다. 먼저 현재 코드와 재현 장면을 확인하고 작은 수정부터 하세요. 위 담당 파일을 중심으로 작업하고 다른 담당 파일이 필요하면 변경 이유와 연결 규격을 먼저 공유하세요. 실제 사용자 선수나 사진 저장소를 초기화하지 마세요. 관련 검사, 전체 검사 183개 이상의 결과와 웹 빌드, 전후 비교, 확인하지 못한 점을 기록하세요. 작업 브랜치에 커밋하고 main을 대상으로 PR을 제출하세요. main 직접 푸시와 운영 배포는 하지 마세요.

전체 실행·업데이트·PR 순서는 [공동작업 안내](../COLLABORATION.md)를 따릅니다.
