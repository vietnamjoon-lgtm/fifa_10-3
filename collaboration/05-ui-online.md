# 05번 — 화면·온라인·통합

작업 브랜치: `work/05-ui-online`. 저장소 전체를 받아 실행하되 아래 담당 파일을 중심으로 수정합니다. 다른 사람 파일은 먼저 해당 담당자와 변경 범위를 정합니다.

## 첫 작업

친구 대전 연결·재접속, 경기 설정 표시, 화면 편의성과 렌더링을 개선하고 각 담당자의 PR을 순서대로 통합합니다.

## 담당 파일

- `src/audio.js`
- `src/camera.js`
- `src/control-help.js`
- `src/gameplay-panel.js`
- `src/geometry-lod.js`
- `src/geometry.js`
- `src/goal-net.js`
- `src/main.js`
- `src/net-state.js`
- `src/online-config.js`
- `src/online.js`
- `src/qa.js`
- `src/render-state.js`
- `src/replay.js`
- `src/research-library.js`
- `src/settings.js`
- `src/stadium.js`
- `src/ui.js`
- `index.html`
- `style.css`
- `server/**`
- `server.mjs`
- `tools/build-web.mjs`
- `tools/check-online.mjs`
- `package.json`
- `vercel.json`
- `.nojekyll`
- `.vercelignore`
- `BUILD.ps1`
- `PLAY.cmd`
- `README.md`
- `COLLABORATION.md`
- `CLAUDE.md`
- `.github/**`
- `collaboration/**`

## 담당 검사 파일

- `tests/online-room.test.mjs`
- `tests/online.test.mjs`
- `tests/research-and-squads.test.mjs`

검사 파일에 다른 분야의 사례가 포함돼 있으면 그 분야 담당자의 확인도 받습니다. 다른 파트는 이 파일을 직접 고치기보다 추가할 사례를 담당자에게 전달합니다.

## 완료 기준

- 두 클라이언트의 같은 프레임 경기 상태와 방장 설정이 일치해야 합니다.
- 방 만들기·입장·준비·재접속·나가기를 확인합니다.
- 설정 적용·취소·저장과 메뉴 키보드 조작을 확인합니다.
- 통합 후 전체 검사·웹 빌드·실제 경기를 확인합니다.

main.js, index.html, style.css는 이 담당자 한 명이 통합합니다. 다른 파트의 화면 연결 요청을 반영합니다. 개인 선수 사진·인증 정보는 저장소에 넣지 않습니다.

## Claude에 그대로 전달하기

> 이 저장소의 CLAUDE.md, COLLABORATION.md, collaboration/05-ui-online.md를 읽으세요. 내 담당은 05번 화면·온라인·통합입니다. 친구 대전 연결·재접속, 경기 설정 표시, 화면 편의성과 렌더링을 개선하고 각 담당자의 PR을 순서대로 통합합니다. 먼저 현재 코드와 재현 장면을 확인하고 작은 수정부터 하세요. 위 담당 파일을 중심으로 작업하고 다른 담당 파일이 필요하면 변경 이유와 연결 규격을 먼저 공유하세요. 실제 사용자 선수나 사진 저장소를 초기화하지 마세요. 관련 검사, 전체 검사 183개 이상의 결과와 웹 빌드, 전후 비교, 확인하지 못한 점을 기록하세요. 작업 브랜치에 커밋하고 main을 대상으로 PR을 제출하세요. main 직접 푸시와 운영 배포는 하지 마세요.

전체 실행·업데이트·PR 순서는 [공동작업 안내](../COLLABORATION.md)를 따릅니다.
