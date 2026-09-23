# 현장 공사 조회 · 여수산단

공개 사이트: https://chuljoon2026-boop.github.io/gaspring-pipes/?location=YS-001
보조 주소: https://claude.ai/code/artifact/9cf8f711-c223-4fab-9f77-13b4946837d9 (단일 파일 아티팩트, 공유 설정 필요)
이전 주소: https://site-ys001.sapp05034.chatgpt.site/?location=YS-001 (codex Sites, 이전 버전)

QR 현장 진입, 시민 신고 작성, 지하 관로 3D·AR 조회를 제공합니다. 첫 화면은 기존 EOCS 작업 시작 신고 화면의 흰색·남색 구성과 파란 원형 버튼을 참고했습니다. ‘굴착현장 확인’은 공식 EOCS를 열며 시민 신고·3D·AR은 확장 메뉴로 배치했습니다.

## 화면

- 전체 3D: 도로 종방향 산업배관과 기반시설 배치
- 평면: 분기·도로 횡단 위치
- 도로 단면: 관경과 중심 심도 비교
- 교차부: 용수 횡단관과 산업배관의 상하 관계
- 시설 선택: 관종·재질·접합·심도·외경 또는 구조물 규격
- 보호판 분리 및 관종별 표시, 노면 불투명도 조절

모델 범위는 길이 64m, 차도 폭 24m입니다. 15개 관로 계통을 24개 구간으로 표현하고 밸브·보호판·복공판·흙막이·맨홀을 포함해 20개 시설을 선택할 수 있습니다. 렌더링 반지름은 표시 외경과 일치합니다. `depth`는 관 중심 깊이이며 일부 횡단관·자연유하 관로는 경로에 따라 깊이가 달라집니다.

## 자료와 범위

`src/sources.ts`에 에어리퀴드의 여수 수소·일산화탄소 공급망, GS의 여수 MFC 지하배관 증설, K-water의 여수 생활·공업용수 공급 자료를 연결했습니다. 관종과 공급구조를 참고한 재구성이며 특정 도로의 실측 좌표·관경·심도를 나타내지 않습니다. 건물·도로 이름은 선명하게 표시합니다. 첫 화면의 ‘미신고 지역’은 화면에 설정된 상태이며 기관의 실시간 신고 정보와 연결되어 있지 않습니다.

공사 등록 조회와 기관 신고 전송은 연결되지 않았습니다. 신고 내용은 현재 브라우저의 `localStorage`에 저장되고 사진은 선택·미리보기만 제공합니다. 열람용 접속 코드는 프론트엔드 확인이며 서버 인증을 대신하지 않습니다. 실제 작업 시작 신고·본인 인증은 공식 EOCS에서 진행합니다. 각 연결 상태는 관련 화면에서 표시합니다.

## 지하 투시 AR

WebXR 지원 휴대전화에서는 실제 카메라 위치·방향과 수평면 hit-test를 사용합니다. 기준 배관을 선택하고 카메라에서 지면을 맞추면, 인식한 지면을 0m로 삼아 원래 매설 심도 아래에 배관을 표시합니다. 수소관 GP-001은 기준 지면 아래 1.85m, 공업용수 WP-001은 2.65m입니다. 배율은 1:1로 고정하며 모형의 최하단을 지면 위로 올리는 처리는 사용하지 않습니다.

배관은 월드 좌표에 고정되고 카메라만 기기 움직임에 따라 바뀝니다. anchors 지원 기기에서는 앵커로 추적하고, 미지원 기기는 같은 세션의 local reference space에 고정합니다. 추적이 끊기면 관로를 숨기고 위치 재인식을 안내합니다. 기준점에 맞춘 후에는 기준 관로 선택을 잠그며, 변경하려면 기준점을 다시 맞춥니다. 관종 표시, 지면·심도 가이드, 방향 및 매설 깊이 보정을 제공합니다.

AR 장면 배경은 투명하고 가상의 불투명 지면이나 실제 지면의 depth occlusion을 적용하지 않아, 카메라의 지표면을 통해 지하 관로를 볼 수 있습니다. 지상으로 돌출되는 부분은 기준 지면에서 잘라내며, 가림이 큰 보호 구조물은 투시 화면에서 제외합니다. 기준점·방향은 수동 정렬이며 실제 지하 매설물 탐지나 실측 좌표에 대한 자동 정합은 아닙니다.

지하 투시는 AR 지원 Android 기기의 Chrome에서 제공합니다. Quick Look의 지하 배치·가림 동작을 이 기능과 동일하게 보장할 수 없어 투시 메뉴에서 제외했습니다. iPhone 및 미지원 브라우저에서는 3D 조회를 제공합니다.

자동 검증은 XR 기기 포즈·비영점 높이의 평면·앵커를 모의해 지하 심도, 카메라 이동·회전, 관로 고정, 추적 소실·복구와 세션 해제를 확인합니다. 실제 휴대전화의 센서 정확도와 장시간 드리프트는 실기기 확인이 필요합니다.

## 실행

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm run test:e2e
```

Node.js 22.12 이상. `http://localhost:5173/?location=YS-001`로 접속합니다.

작업자 접속 화면의 **바로 열람**으로 입력 없이 배관을 볼 수 있습니다. 수동 접속 시 접속 코드 `YS-2026-001`, 비밀번호 `1234`, 이름은 빈 값이 아니면 됩니다.

## QR

```bash
npm run qr -- --publish
```

기본 연결 주소는 현재 공개 사이트입니다. `artifacts/qr/`에 QR PNG(1200×1200), SVG, 안내판 PNG(1500×2000), 인쇄 HTML(150×200mm), 연결 주소 JSON을 생성합니다. `--publish`는 공개 주소용 파일 4종을 `public/qr/`에도 복사하여 사이트에서 내려받을 수 있게 합니다. 공개 주소는 PC 실행 여부와 관계없이 열립니다. 생성에는 로컬 Playwright Chromium이 필요합니다.

- QR 이미지: https://chuljoon2026-boop.github.io/gaspring-pipes/qr/YS-001.png
- 안내판: https://chuljoon2026-boop.github.io/gaspring-pipes/qr/YS-001-marker.png
- 인쇄: https://chuljoon2026-boop.github.io/gaspring-pipes/qr/YS-001.html

별도 주소용 QR은 `npm run qr -- --url https://your-site.example/`로 생성합니다. `가스프링_part 7,8_ver1.pptx`와 완성본에는 현재 공개 주소의 QR을 삽입했습니다.

## 배포

공개 사이트는 GitHub Pages(`chuljoon2026-boop/gaspring-pipes`)입니다. `main`에 push하면 `.github/workflows/deploy.yml`이 하위 경로(`BASE_PATH=/gaspring-pipes/`)로 빌드해 배포합니다. 로컬 원격 이름은 `github`입니다.

```bash
git push github main
gh run watch --repo chuljoon2026-boop/gaspring-pipes
```

로컬에서 같은 빌드를 확인하려면 `BASE_PATH=/gaspring-pipes/ npm run build`를 실행합니다(Git Bash에서는 `MSYS_NO_PATHCONV=1` 추가). `gh-pages` 브랜치는 Actions 권한이 없던 첫 배포의 산출물이며 더 이상 사용하지 않습니다.

보조 주소인 claude.ai 아티팩트는 앱 전체를 한 HTML 파일로 묶어 올립니다.

```bash
npx vite build --config scripts/artifact.vite.config.ts
node scripts/inline-artifact.mjs   # artifacts/yeosu-pipes.html
```

`artifacts/yeosu-pipes.html`을 같은 아티팩트 주소에 다시 게시하면 QR은 그대로 유지됩니다. 아티팩트는 기본 비공개이므로 게시 후 공유 메뉴에서 공개로 바꿔야 QR 접속이 됩니다. 단일 파일 페이지에는 서비스 워커·설치 매니페스트가 없고, 호스트 프레임 정책에 따라 AR 카메라가 열리지 않을 수 있습니다.

이전 codex Sites 배포 절차는 다음과 같습니다. Sites 프로젝트는 `.openai/hosting.json`의 `project_id`를 재사용합니다. 검증한 소스를 원격에 push하고 `git rev-parse --verify HEAD`의 전체 SHA를 사용합니다. 빌드 성공 후 `.openai/hosting.json`과 `dist/`만 tar로 묶어 버전을 저장하고 공개 배포합니다. 현재 접근 범위는 public입니다. 사용자 문서나 로컬 산출물을 소스 배포에 포함하지 않습니다.

## 주요 파일

- `src/App.tsx`, `src/interface.css`: 간결한 현장·신고·작업자·QR UI
- `src/network.ts`: 시설 정보와 관로 경로
- `src/components/PipeScene.tsx`: 도로·주변 구조와 카메라·단면
- `src/components/UtilityNetwork.tsx`: 관로·이음부·판·맨홀·이격 표시
- `src/components/ARView.tsx`, `FloorARScene.tsx`: WebXR 지면 정렬·지하 투시·심도 표시
- `src/ar/createPipeModel.ts`: 지표면 y=0과 원래 매설 깊이를 보존하는 배관 모형
- `tests/demo.spec.ts`: 모바일·PC의 핵심 기능과 3D 화면 검증
- `tests/ar.spec.ts`, `tests/xr-mock.ts`: 공간 고정·추적 복구·세션 수명 검증

React, TypeScript, Vite, Three.js, React Three Fiber를 사용합니다. Pretendard 글꼴은 저장소에 포함되어 있으며 SIL OFL 라이선스를 따릅니다.
