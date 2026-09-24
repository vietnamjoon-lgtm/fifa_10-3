# 5명이 함께 개발하기

저장소: https://github.com/vietnamjoon-lgtm/fifa_10-3
게임: https://project-touchline-three.vercel.app/

각자 저장소 전체를 한 번 받습니다. 게임을 실행하려면 모든 파트가 필요하기 때문입니다. 수정은 자기 담당 파일과 작업 브랜치에서 하고, 변경된 내용만 Git으로 올립니다. 파일을 매번 복사하거나 웹에서 수동 업로드하지 않습니다. Claude 채팅과 계정은 공유하지 않고 코드·PR·작업 지침을 공통 기준으로 사용합니다.

## 5명 배정표

| 사람 | 담당 | 작업 브랜치 | 전달할 지침 |
|---|---|---|---|
| 1번 | 선수·얼굴·체형·선수 편집 | work/01-players | [1번 작업지](collaboration/01-players.md) |
| 2번 | 애니메이션·발 디딤·공 접촉 표현 | work/02-animation | [2번 작업지](collaboration/02-animation.md) |
| 3번 | 패스·슛·AI·골키퍼·조작 | work/03-gameplay | [3번 작업지](collaboration/03-gameplay.md) |
| 4번 | 공 물리·몸싸움·파울·오프사이드·경기 진행 | work/04-physics-rules | [4번 작업지](collaboration/04-physics-rules.md) |
| 5번 | 화면·경기장·온라인·최종 통합 | work/05-ui-online | [5번 작업지](collaboration/05-ui-online.md) |

친구마다 번호 하나와 해당 작업지 링크를 전달하면 됩니다. 각 작업지에 정확한 파일 목록, 첫 작업, 완료 기준, Claude에 복사할 요청문이 있습니다. 기계가 읽을 담당표는 [ownership.json](collaboration/ownership.json)입니다. 현재 실행 코드 80개와 테스트 파일 16개에 담당자를 하나씩 정했습니다.

## 겹치는 부분 처리

- src/match.js, src/duel.js, src/config.js, src/gameplay-settings.js는 4번이 담당합니다. 패스나 애니메이션 파트에서 경기 연결이 필요하면 4번에게 요청합니다.
- src/main.js, index.html, style.css는 5번이 담당합니다. 다른 파트에서 새 버튼이나 화면 연결이 필요하면 5번에게 요청합니다.
- src/player.js, src/squads.js와 선수 저장 형식은 1번이 담당합니다. 필드를 추가하면 4번 경기 계산·5번 온라인 전달에 알립니다.
- 판정·AI 모듈은 서로 공개 함수와 데이터 형식을 맞춥니다. 다른 담당 파일 수정이 필요하면 이유와 범위를 먼저 공유합니다. 파일 경계가 기능 개발을 막는 규칙은 아닙니다.
- 새 파일은 담당표에 추가합니다. vendor와 원본 자산은 필요한 담당자가 출처·라이선스를 확인하고 5번과 함께 반영합니다. 생성된 anatomy-data.js와 mocap-data.js를 직접 고치기보다 생성 원본·도구도 함께 맞춥니다.

이 배정은 작업 약속입니다. GitHub에서 사람별 파일 쓰기 권한을 강제로 제한하는 설정은 아닙니다. main 직접 수정 대신 PR로 합쳐야 다른 사람 변경을 확인할 수 있습니다.

## 처음 한 번

저장소 소유자가 친구 4명의 GitHub 계정을 Collaborators로 초대하고 친구가 초대를 수락해야 같은 저장소에 코드를 올릴 수 있습니다. 비밀번호를 나눌 필요가 없습니다. GitHub Desktop으로 저장소를 복제하고 Current branch에서 자기 work/번호 브랜치를 골라도 됩니다.

Git 명령을 사용하는 경우 아래에서 브랜치만 자기 번호로 바꿉니다.

```text
git clone https://github.com/vietnamjoon-lgtm/fifa_10-3.git
cd fifa_10-3
git switch work/01-players
node server.mjs
```

Node.js 22 이상이 필요합니다. 게임 실행·단위 검사·웹 빌드는 저장소의 vendor를 사용하므로 npm install 없이 실행합니다. GitHub 소스에는 Windows용 node.exe가 없고 배포 ZIP에만 들어 있습니다.

## 매번 작업할 때

1. 자기 브랜치에서 이전 수정 내용을 먼저 커밋합니다. 그다음 최신 main을 받아 합칩니다. GitHub Desktop에서는 Fetch origin 후 현재 브랜치에 main을 병합합니다.
2. 한 번에 재현 가능한 문제 하나를 맡고, 담당 작업지의 파일 중심으로 수정합니다.
3. 관련 검사·전체 검사·웹 빌드를 실행하고 전후 동작을 확인합니다.
4. GitHub Desktop의 Commit 후 Push origin을 누릅니다. 또는 수정한 파일을 골라 git add, git commit, git push를 합니다. 변경분만 전송됩니다.
5. 자기 작업 브랜치에서 main으로 Pull Request(PR, 변경 검토 요청)를 만듭니다. 변경 이유, 검사 결과, 전후 비교와 남은 한계를 적습니다.
6. 5번 통합 담당자가 관련 담당자의 확인을 받아 PR을 하나씩 합칩니다. 이번 작업 브랜치는 다음 작업에도 사용할 수 있도록 삭제하지 않습니다.
7. 전원이 최신 main을 자기 브랜치에 합친 뒤 다음 작업을 시작합니다. 충돌은 겹친 파일 담당자와 해결하고, 전체 파일 덮어쓰기나 강제 푸시로 없애지 않습니다.

업데이트 명령 예시(현재 수정 내용을 먼저 커밋한 상태):

```text
git fetch origin
git merge origin/main
git push
```

GitHub 업로드와 현재 Vercel 게임의 자동 배포는 연결하지 않았습니다. main에 합친 변경을 확인한 뒤 별도로 배포합니다.

## 검사

```text
node --test --experimental-test-isolation=none tests/*.test.mjs
node tools/build-web.mjs
```

현재 기준은 자동 검사 183개 통과입니다. 골키퍼 담당은 같은 조건에서 node tools/check-keeper-v2.mjs --balanced도 실행합니다. 물리·판정 담당은 node tools/soak.mjs로 자동 경기 종료와 좌표를 확인합니다. 이 검사는 상용 FC와 동일한 완성도를 뜻하지 않습니다.

http://localhost:4173/에서 실행합니다. http://127.0.0.1:4173/?qa=1은 별도 브라우저 저장소로 개발 장면을 확인할 때 사용합니다. 실제 사용자 선수·사진 저장소를 초기화하지 않습니다.

tools/check-online.mjs는 현재 통합 담당의 저장소 밖 배포 도구와 ws에 의존합니다. 친구의 새 체크아웃에서 바로 실행되는 검사라고 가정하지 않습니다. BUILD.ps1의 Windows ZIP 제작에는 tools/node.exe가 필요합니다.

## 업로드 범위

src, server, vendor, tests, licenses, 도구 소스, 작업 문서를 버전 관리합니다. 인증 토큰, .env, .vercel, .wrangler, .deploy-tools, 개인 사진과 선수 내보내기 파일은 올리지 않습니다. 얼굴 검사는 저장소의 가상 예시만 사용합니다. 제삼자 자산의 출처와 라이선스를 유지합니다.
