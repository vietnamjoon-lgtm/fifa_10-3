# GitHub Pages 게임

주소: https://vietnamjoon-lgtm.github.io/fifa_10-3/

저장소 Settings → Pages에서 Deploy from a branch, main, / (root)를 사용합니다. main에 합친 소스는 GitHub의 Pages 배포 작업을 거쳐 이 주소에 반영됩니다. 담당별 work/ 브랜치에 올린 변경은 main에 합치기 전까지 반영되지 않습니다. .nojekyll은 게임 자산을 정적 파일로 그대로 제공합니다.

게임 화면·단일 플레이는 Pages에서 제공하고, 친구 대전은 기존 Cloudflare 서버에 연결합니다. server/wrangler.jsonc의 ALLOWED_ORIGINS에 https://vietnamjoon-lgtm.github.io를 추가했습니다. Pages는 경로가 붙는 주소이므로 자산은 기존 상대 경로를 사용합니다.

Vercel 주소도 유지합니다. Vercel 자동 배포는 연결하지 않았습니다. 개인 선수와 사진은 브라우저의 사이트별 저장소에 있으므로 기존 Vercel 주소의 저장 데이터가 Pages 주소로 자동 이동하지 않습니다. 필요한 선수는 게임의 내보내기·가져오기로 옮길 수 있습니다.

2026-09-24 Pages 시작 화면과 실제 3D 훈련 실행을 브라우저에서 확인했습니다. 방 생성과 WebSocket 연결 완료, 초대 링크의 Pages 경로 유지도 확인했고 테스트 방을 종료했습니다. 온라인 검사: ONLINE_ORIGIN을 https://vietnamjoon-lgtm.github.io로 설정한 뒤 node tools/check-online.mjs 실행. 해당 검사는 통합 담당의 저장소 밖 ws 설치를 사용합니다.

설정 참고: [GitHub Pages 게시 소스](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

두 테스트 클라이언트가 각 99개 상태를 수신했고, 공통 프레임 일치·D 수비 유지/해제·방장 설정·선수 체형/가상 얼굴 전달·재접속을 통과했습니다. 결과: online-pages-check.json (2026-09-24T07:10:24.120Z). 검사 도구의 고정 250 ms 대기와 임의의 최근 프레임 선택이 네트워크 지연에서 실패해, 새 상태 도착을 제한 시간 안에 기다리고 양쪽에 도착한 공통 프레임 20개 이상을 비교하도록 수정했습니다. 경기 동작을 바꾸거나 검증 조건을 제거하지 않았습니다.
