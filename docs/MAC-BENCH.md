# 맥북(Apple Silicon)에서 성능·화면 측정하기

클라우드 작업 환경에는 GPU가 없어 SwiftShader(CPU 렌더링)로 재면 22명 경기가 2 fps 안팎입니다. 이 값은 전후 비교 용도일 뿐이고, 무엇이 실제로 무거운지는 가려집니다. M1–M4 맥북의 GPU로 재면 실제 플레이에 가까운 값이 나옵니다.

## 1. 준비 (한 번만)

```bash
# Node.js 22 이상 (없으면)
brew install node@22            # 또는 https://nodejs.org 설치 프로그램

git clone https://github.com/vietnamjoon-lgtm/fifa_10-3.git   # 이미 있으면 생략
cd fifa_10-3
git fetch origin && git switch main && git pull
```

게임 실행과 벤치에는 `npm install`이 필요 없습니다(vendor 포함).

## 2. 브라우저 벤치 (가장 간단, 약 2분)

```bash
node server.mjs
```

Chrome에서 **http://localhost:4173/?qa=1&bench=1** 을 엽니다.

- 탭을 앞에 둔 채 기다립니다. 다른 창을 누르거나 탭을 가리면 경기가 일시정지되어 값이 틀어집니다. 전원 어댑터를 연결하고 저전력 모드는 끕니다.
- 자동으로 AI 22명 경기를 시작하고 다음을 잽니다.
  - 야간·낮 × 높음·보통·낮음, 6개 조건. 조건마다 10초 동안 평균 fps와 p50/p95/p99 프레임 시간.
  - 멈춘 한 장면의 요소별 렌더 비용: 전체, 관중 끔, 그림자 맵 끔, 선수 숨김, 잔디 숨김, 스탠드 숨김, 해상도 절반.
- 끝나면 화면 왼쪽 위에 표가 나오고 **bench.json 저장**과 **JSON 복사** 버튼이 생깁니다. 이 JSON을 채팅에 붙여 주거나, `reports/bench/` 폴더에 넣어 커밋해 주세요. 맥 모델명(예: M2 Air)도 같이 알려 주시면 됩니다.

Safari에서도 동작하지만, 기준은 Chrome으로 맞춰 주세요.

## 3. 같은 장면 스크린샷·영상을 맥 GPU로 (선택)

```bash
npm i -D playwright            # node_modules는 .gitignore 대상
npx playwright install chromium
node server.mjs &              # 다른 터미널에서 실행해도 됩니다

PLAYWRIGHT_MODULE=playwright node tools/broadcast-capture.mjs http://127.0.0.1:4173 captures shots --gpu
PLAYWRIGHT_MODULE=playwright node tools/broadcast-capture.mjs http://127.0.0.1:4173 captures shots --night --gpu
PLAYWRIGHT_MODULE=playwright node tools/broadcast-capture.mjs http://127.0.0.1:4173 captures fps --quality high --night --gpu
```

`--gpu`를 주면 SwiftShader 대신 실제 GPU를 쓰는 창이 뜹니다. 가상 시간으로 돌리기 때문에 클라우드에서 찍은 장면과 같은 시뮬레이션 프레임이 나옵니다.

## 4. 카메라 떨림 측정 (CPU만 사용, 어디서나 동일)

```bash
node tools/camera-metrics.mjs --seed 7
```

## 참고

- 벤치 코드는 `src/bench.js`이며 `?qa=1&bench=1`일 때만 불러옵니다. 배포 빌드는 `qa.js`를 빈 함수로 바꾸므로 공개 게임에서는 실행되지 않습니다.
- 사용자 선수·사진 저장소는 건드리지 않습니다. 벤치 중에 바꾼 품질·시간대·적응형 해상도·그림자·관중 설정은 끝나면 원래 값으로 되돌립니다.
