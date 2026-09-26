# 03번 — 패스·슛·AI·골키퍼

작업 브랜치: `work/03-gameplay`. 저장소 전체를 받아 실행하되 아래 담당 파일을 중심으로 수정합니다. 다른 사람 파일은 먼저 해당 담당자와 변경 범위를 정합니다.

## 첫 작업

접촉 전 패스 조준 지원과 출발 후 물리 궤적을 유지하면서 수신 커서, 패스 속도, 공격·수비 AI와 골키퍼 밸런스를 개선합니다.

## 담당 파일

- `src/crossing.js`


- `src/ai.js`
- `src/assists.js`
- `src/attributes.js`
- `src/auto-defence.js`
- `src/ball-assistance.js`
- `src/commands.js`
- `src/control-assist.js`
- `src/guided-pass.js`
- `src/input.js`
- `src/keeper-balance.js`
- `src/keeper-tuning.js`
- `src/setpiece-styles.js`
- `src/skills.js`
- `tools/assist-check.mjs`
- `tools/check-balance.mjs`
- `tools/check-keeper-v2.mjs`

## 담당 검사 파일

- `tests/assists.test.mjs`
- `tests/balance-and-ratings.test.mjs`
- `tests/control-assist.test.mjs`
- `tests/guided-pass.test.mjs`

검사 파일에 다른 분야의 사례가 포함돼 있으면 그 분야 담당자의 확인도 받습니다. 다른 파트는 이 파일을 직접 고치기보다 추가할 사례를 담당자에게 전달합니다.

## 완료 기준

- 정지 수신자에게 선수가 쫓아가지 않고 공이 도착하는지 양 팀에서 확인합니다.
- 출발 후 공을 수신자에게 강제로 유도하지 않고 상대의 가로채기가 가능해야 합니다.
- 골키퍼 변경은 같은 고정 슈팅 장면의 전후 득점·선방 수를 함께 기록합니다.

공의 적분·충돌·파울은 04번, 킥 자세와 타이밍 표현은 02번 담당입니다. 골키퍼 수치를 여러 사람이 동시에 고치지 않습니다.

## Claude에 그대로 전달하기

> 이 저장소의 CLAUDE.md, COLLABORATION.md, collaboration/03-gameplay.md를 읽으세요. 내 담당은 03번 패스·슛·AI·골키퍼입니다. 접촉 전 패스 조준 지원과 출발 후 물리 궤적을 유지하면서 수신 커서, 패스 속도, 공격·수비 AI와 골키퍼 밸런스를 개선합니다. 먼저 현재 코드와 재현 장면을 확인하고 작은 수정부터 하세요. 위 담당 파일을 중심으로 작업하고 다른 담당 파일이 필요하면 변경 이유와 연결 규격을 먼저 공유하세요. 실제 사용자 선수나 사진 저장소를 초기화하지 마세요. 관련 검사, 전체 검사 183개 이상의 결과와 웹 빌드, 전후 비교, 확인하지 못한 점을 기록하세요. 작업 브랜치에 커밋하고 main을 대상으로 PR을 제출하세요. main 직접 푸시와 운영 배포는 하지 마세요.

전체 실행·업데이트·PR 순서는 [공동작업 안내](../COLLABORATION.md)를 따릅니다.
