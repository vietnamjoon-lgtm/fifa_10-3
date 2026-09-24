# 친구들과 공동 개발하기

이 문서는 로컬 협업 준비본입니다. 아직 GitHub 저장소를 만들거나 코드를 올리지 않았습니다. 저장소를 만든 뒤 이 문서와 README를 친구에게 전달하세요.

## 역할 나누기

| 담당 | 첫 작업 | 주로 수정할 파일 | 완료 기준 |
|---|---|---|---|
| 얼굴·체형 | 정면 사진의 눈·코·턱 특징과 체형 연결부 개선 | src/face-identity.js, sculpted-head.js, body-shape.js, body-rig.js, anatomical-player.js | 가상 사진으로 전후 비교, 키·체중·극단 비율에서 얼굴/목/팔다리 연결 유지 |
| 애니메이션 | 걷기·달리기·정지·턴·킥의 연결과 발 미끄러짐 개선 | src/motion.js, motion-planner.js, inertial-motion.js, foot-plant.js, hand-contact.js | 같은 카메라의 전후 영상, 양발·양방향·몸 비율 변경에서도 접촉 검증 |
| 경기 플레이 | 패스 도착·가로채기·수신자 커서·GK 밸런스 개선 | src/guided-pass.js, ball-assistance.js, ai.js, assists.js, keeper-balance.js, keeper-tuning.js | tests/guided-pass.test.mjs 통과, GK 고정 장면 전후 비교, 양 팀 검사 |
| 화면·온라인 | 편집 화면 편의성 또는 친구 대전 연결 문제 개선 | src/player-editor.js, body-studio.js, face-studio.js, online.js, server/room.js, style.css | 저장/취소/재접속 확인, 두 클라이언트에서 같은 상태 확인 |

인원이 3명이면 화면·온라인은 통합 담당이 맡고 나머지 세 분야를 나눕니다. 5명 이상이면 화면과 온라인을 분리합니다. 같은 파일을 여러 명이 고치게 되면 먼저 담당자를 정합니다.

통합 담당은 src/match.js, src/main.js, src/player.js, src/squads.js, src/duel.js, index.html과 공통 데이터 형식 변경을 조율합니다. 다른 담당도 필요한 수정을 제안할 수 있지만, 공통 파일 변경 범위를 PR에 별도로 표시하세요. 경기 수치를 여러 사람이 동시에 조절하지 않습니다.

## 작업 순서

1. 비공개 저장소를 만들고 친구들의 GitHub 계정을 초대합니다. 각자 자신의 컴퓨터와 Claude 계정을 사용합니다.
2. 한 작업을 이슈 하나로 적습니다. 재현 장면, 기대 동작, 담당 파일, 완료 기준을 명시합니다.
3. 최신 main에서 feature/face-likeness, feature/run-transitions 같은 별도 브랜치를 만듭니다.
4. 작은 기능 하나를 완성하고 관련 검사, 전체 검사, 웹 빌드를 실행합니다.
5. PR에 변경 이유·검사 결과·전후 화면을 남깁니다. 아직 못 한 부분도 적습니다.
6. 통합 담당이 검토하고 합칩니다. 합친 뒤 실제 경기와 친구 대전을 확인하고 배포합니다.

게임 코드는 자동으로 서로 동기화되지 않습니다. Claude의 채팅도 공유되지 않으므로 저장소의 코드·이슈·PR이 공통 기준입니다. 계정 비밀번호를 공유할 필요는 없습니다.

## 친구의 Claude에 전달할 작업문

아래 공통 문장에 위 표의 담당 분야와 첫 작업을 붙여 전달하세요.

> 이 저장소의 README.md와 COLLABORATION.md를 읽고 내가 맡은 이슈만 구현해 주세요. 먼저 관련 파일과 현재 동작을 확인하고, 담당 파일 중심으로 작은 변경을 만드세요. 공통 데이터 형식이나 통합 담당 파일의 변경이 필요하면 이유와 영향을 PR에 명시하세요. 기존 능력치 저장 파일, 온라인 프로필 전달, 양 팀 조작을 유지하세요. 사진은 저장소의 가상 예시만 사용하세요. 실제 사용자 저장소를 초기화하지 마세요. 관련 검사와 전체 검사, 웹 빌드 결과 및 확인하지 못한 점을 남기세요. main에 직접 푸시하거나 운영 배포하지 말고 작업 브랜치의 PR로 제출하세요.

## 로컬 실행과 검사

GitHub 소스에는 Windows용 node.exe를 넣지 않습니다. Node.js 22 이상을 설치한 환경에서 실행합니다. 게임 실행·단위 검사·웹 빌드는 저장소의 vendor를 사용하므로 npm install 없이 실행할 수 있습니다.

```text
node server.mjs
node --test --experimental-test-isolation=none tests/*.test.mjs
node tools/build-web.mjs
node tools/check-keeper-v2.mjs --balanced
```

http://localhost:4173/에서 실행합니다. http://127.0.0.1:4173/?qa=1은 개인 선수 저장소와 분리된 개발 검사에 사용할 수 있습니다. 기존 localhost 저장소에 사용자 선수가 있으면 덮어쓰지 마세요.

tools/check-online.mjs는 현재 통합 담당 컴퓨터 밖의 배포 도구와 ws에 의존합니다. 친구의 새 체크아웃에서 바로 실행되는 검사라고 가정하지 마세요. 배포 전 서버 검사는 통합 담당이 실행합니다. BUILD.ps1의 Windows ZIP 제작에는 tools/node.exe가 필요합니다.

## 저장소에 넣을 것

src, server, vendor, tests, licenses, 도구 소스, README 및 작업 문서는 버전 관리합니다. 제삼자 자산의 출처와 라이선스를 유지합니다. 사용자 사진·개인 선수 내보내기 파일·인증 토큰·.env·.vercel·.wrangler·.deploy-tools는 업로드하지 않습니다. .gitignore는 기본 제외만 하므로 처음 올리기 전 실제 파일 목록도 확인합니다. 원본 사진과 사용자 선수는 브라우저 저장소에 있으며 게임 소스와 별개입니다.

현재 기록의 자동 검사 183개는 기본 출발점입니다. 영상 자료의 항목 수와 실제로 검증한 동작 수를 혼동하지 마세요. 상용 게임과 완전히 동일하다고 적는 대신 구현·검증한 범위를 적습니다.

브랜치와 PR 흐름 참고: https://docs.github.com/en/pull-requests/get-started/about-pull-requests
