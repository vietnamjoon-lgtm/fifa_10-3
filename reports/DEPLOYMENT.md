# 웹·친구 대전 배포

2026-09-24: 신체 상세 편집, 수신자 추적 패스와 중간 골키퍼 조정, 이동·물리·파울·오프사이드 개선 및 공통 경기 설정.

- 게임: https://project-touchline-three.vercel.app/
- Vercel 프로젝트: jwkc/project-touchline
- 배포 ID: dpl_26zJ3UnadgEN4NNSK5YFcN1uE247
- 배포 확인: https://vercel.com/jwkc/project-touchline/26zJ3UnadgEN4NNSK5YFcN1uE247
- 정적 파일 103개, 22,716,823 bytes. 개발 장면 도구·인증 정보·사용자 저장 사진 제외.
- 서버: https://project-touchline-arena.project-touchline.workers.dev
- Cloudflare 버전: ecf795e2-86a6-42da-b165-9b828d9eb950

자동 검사 183개 통과. 전체 결과: latest-tests.txt. 이번 변경과 한계: GAMEPLAY-OVERHAUL.md. 체형 편집: BODY-CUSTOMIZATION.md. 패스 및 252회 골키퍼 비교: GUIDED-PASS-AND-KEEPER.md.

실제 서버에서 테스트 클라이언트 2개가 각각 98개 상태를 받았습니다. 같은 프레임 상태 일치, 방장 공통 경기 설정 전달, D 수비 유지·해제, 커스텀 팀·체형·54개 얼굴 기준점 전달, 가상 인물 11명의 얼굴 표면 전달, 반복 상태에 사진이 없음, 연결 해제·재접속을 확인했습니다. 검사 시각 2026-09-24T06:40:55.232Z. 테스트 방은 종료했고 개인 사진을 사용하지 않았습니다. 결과: online-live-check.json.

별도 로컬 브라우저 저장소에서 가상 선수의 키·체중·체형 저장과 복원, 경기 설정 적용·취소·기본값 복원, 달리기 자세를 확인했습니다. 최신 브라우저 검사에서 패스 수신·첫 터치 성공, 방향 전환 드리블 공 소유 유지(관측 최대 거리 0.88 m), 오류 로그 없음. 사용자 선수 및 개인 사진 저장소는 변경하지 않았습니다.

이번 검사에서 전체 22명 경기의 활성 화면 성능을 별도로 계측하지 않았습니다. 단일 프레임이나 비활성 탭 FPS를 실제 경기 성능으로 해석하지 않습니다. 실제 인물의 닮음이나 상용 FC 수준의 동일한 애니메이션·판정을 보장하지 않습니다. 정면 사진 한 장으로 숨겨진 두상·코 깊이·머리 모양을 모두 복원하지 않으며 옆·뒤 사진은 수동 조절 참고입니다.

배포는 tools/build-web.mjs 이후 Vercel CLI prebuilt production, 서버는 server/wrangler.jsonc를 사용합니다. 인증은 프로젝트 밖에 보관하며 빌드·Git·ZIP에 넣지 않습니다. GitHub 업로드와 자동 배포를 연결하지 않았습니다.
