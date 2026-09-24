# 02번 — 애니메이션·발 디딤

작업 브랜치: `work/02-animation`. 저장소 전체를 받아 실행하되 아래 담당 파일을 중심으로 수정합니다. 다른 사람 파일은 먼저 해당 담당자와 변경 범위를 정합니다.

## 첫 작업

걷기→달리기→정지→180도 턴과 패스·슛 동작의 연결, 발 미끄러짐을 우선 개선합니다.

## 담당 파일

- `src/celebrations.js`
- `src/contact-model.js`
- `src/foot-plant.js`
- `src/gait.js`
- `src/hand-contact.js`
- `src/inertial-motion.js`
- `src/mocap-data.js`
- `src/motion-planner.js`
- `src/motion-preview.js`
- `src/motion.js`
- `src/receive-control.js`
- `tools/convert-mocap.mjs`
- `assets-source/09.asf`
- `assets-source/09_01.amc`
- `assets-source/10.asf`
- `assets-source/10_01.amc`

## 담당 검사 파일

- `tests/human-motion-and-defence.test.mjs`

검사 파일에 다른 분야의 사례가 포함돼 있으면 그 분야 담당자의 확인도 받습니다. 다른 파트는 이 파일을 직접 고치기보다 추가할 사례를 담당자에게 전달합니다.

## 완료 기준

- 같은 속도·카메라·선수로 전후 동작을 비교합니다.
- 좌우 발과 양 팀 공격 방향, 긴 다리·짧은 다리에서도 발·공 접촉을 확인합니다.
- 관절이 꺾이거나 손·발이 몸에서 분리되지 않는지 확인합니다.

선수 메시·관절 길이는 01번, 공의 실제 소유권과 패스 목표는 03번, 이동 속도·경기 진행은 04번 담당입니다. 외형으로만 공 위치를 바꾸지 않습니다.

## Claude에 그대로 전달하기

> 이 저장소의 CLAUDE.md, COLLABORATION.md, collaboration/02-animation.md를 읽으세요. 내 담당은 02번 애니메이션·발 디딤입니다. 걷기→달리기→정지→180도 턴과 패스·슛 동작의 연결, 발 미끄러짐을 우선 개선합니다. 먼저 현재 코드와 재현 장면을 확인하고 작은 수정부터 하세요. 위 담당 파일을 중심으로 작업하고 다른 담당 파일이 필요하면 변경 이유와 연결 규격을 먼저 공유하세요. 실제 사용자 선수나 사진 저장소를 초기화하지 마세요. 관련 검사, 전체 검사 183개 이상의 결과와 웹 빌드, 전후 비교, 확인하지 못한 점을 기록하세요. 작업 브랜치에 커밋하고 main을 대상으로 PR을 제출하세요. main 직접 푸시와 운영 배포는 하지 마세요.

전체 실행·업데이트·PR 순서는 [공동작업 안내](../COLLABORATION.md)를 따릅니다.
