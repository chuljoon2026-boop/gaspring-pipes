# 지하 배관 AR 데모

QR 진입 → 공사 조회(공개) / 작업 시작 신고(접수번호 확인) → 지하 투시 AR / 3D 배관 보기.
첫 화면은 한빛산단 앞 도로라는 예시 현장입니다. 도로/보도/건물로 구성한 지형에서 지상/지하를 전환합니다. 실제 공사 사이트 연결 및 기관 신고 전송은 없습니다. 공사 조회/미접수 공사 신고는 누구나 이용하고, 배관 3D/AR은 접수번호 확인 후 이용합니다. 시험 정보는 `2026-001-001` / `1234`이며 자동입력 후 현장 확인 버튼으로 진입합니다. 이 확인 화면은 클라이언트 데모이며 서버 인증이 아닙니다.

기존 QR 주소의 `?location=YS-001`은 호환성을 위해 유지합니다. 현장명은 가상의 이름이며 배관 좌표/깊이/규격은 데모 값입니다. 신고 체험은 브라우저에만 저장됩니다.

## 현장 확인 / 용어 근거

EOCS 공식 FAQ는 굴착예정지별로 접수번호를 부여하고, 같은 공사의 여러 장소를 -001/-002 등 하위 번호로 구분한다고 설명합니다.
- https://www.eocs.or.kr/jsp/center/faq/list.jsp
- https://www.eocs.or.kr/jsp/apply/progress/list.jsp

공식 웹 로그인은 아이디/비밀번호입니다. 접수번호별 비밀번호를 발급하는 제도는 확인되지 않았습니다. 이 데모의 **작업 현장 확인**은 공사 신고 접수번호 `2026-001-001` / 현장 비밀번호 `1234`로 기능을 여는 제안 화면입니다. 실제 번호 형식이나 EOCS 인증을 재현한 것이 아닙니다. 접속 정보 자동입력 후 현장 확인을 누르면 **지하 투시 AR / 3D 배관 보기**를 선택합니다. 직접 주소도 같은 확인을 거칩니다.

공개 메뉴는 **공사 조회**, 시민 버튼은 **미접수 공사 신고**, 작업 메뉴는 **작업 시작 신고**입니다. 안전신문고의 안전신고 용어를 참고했습니다: https://www.mois.go.kr/frt/sub/a06/b10/safetyReport/screen.do

## 지하 투시 AR

시작 시 보는 사람의 위치를 가상 GIS 원점으로 삼습니다. `src/ar/demoGIS.ts`는 미터 단위 로컬 좌표와 도면 오프셋을 정의합니다. 실제 GPS나 실측 좌표를 요구하지 않습니다. 최초 시선의 수평 방향을 앞쪽으로 고정하고, 기준 관로는 앞쪽 4 m / 지면 아래 1.85 m에 둡니다. 선택이나 카메라 이동에 따라 도면 좌표가 재설정되지 않습니다.

WebXR 지원 기기: 지면 hit-test 높이가 450 ms 동안 안정되면 자동 등록합니다. 터치로 기준점을 찍는 단계는 없습니다. 수평면과 카메라 아래 0.6–2.2 m 범위만 인정하며, hit 지점의 수평 위치가 아닌 최초 사용자 위치에 GIS 원점을 고정합니다. 추적 중에는 카메라만 움직이고 관로는 월드 좌표에 남습니다. 앵커를 사용할 수 있으면 사용하며 추적 소실 시 숨기고 복구합니다. 탁자와 바닥의 의미를 구분하는 기능은 아니므로 바닥을 비춰야 합니다.

WebXR 미지원 기기: 후면 카메라 / 방향 센서로 **간편 AR**을 제공합니다. 카메라 높이 1.4 m와 평평한 지면을 가정하고 아래를 비추면 자동 표시합니다. 회전은 반영하지만 실제 평면 인식 / 보행 위치 추적은 지원하지 않으며, 이 차이를 화면에 표시합니다. iOS 동작 권한은 버튼을 누르는 시점에 요청합니다. 센서가 없거나 권한이 거부되면 원인을 안내하고 3D 기능을 제공합니다. 카메라 종료 / 화면 이탈 시 스트림을 해제합니다.

배관 불투명도는 48%로 시작하며 15–80% 사이 조절합니다. 배경은 투명하며 가상 지면이나 건물을 카메라 위에 덮지 않습니다. 구조물을 제외하고 지상 부분을 잘라 땅 아래 배관만 투시합니다. 실제 매설물 탐지나 정밀 현장 정합 기능이 아닙니다.

검증: XR 모의 포즈/지면/앵커로 자동 등록, 미터 단위 깊이, 이동/회전 시 좌표 고정, 복구 및 해제를 검사합니다. 간편 모드는 가상 카메라 영상과 방향 이벤트로 자동 표시 / 회전 / 투명도 / 종료 / 센서 부재를 검사합니다. 실제 휴대전화의 추적 정확도와 카메라 화각은 실기기 검증이 필요합니다.

## 실행

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm run test:e2e
```

Node.js 22.12 이상. `http://localhost:5173/?location=YS-001`로 접속합니다.

작업 시작 신고 탭에서 접수번호 `2026-001-001`, 현장 비밀번호 `1234`를 사용합니다. **접속 정보 자동입력** 후 **현장 확인**을 누릅니다. 배관/AR 직접 주소도 현장 확인을 거치며, 로그아웃하면 다시 확인해야 합니다.

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

`artifacts/yeosu-pipes.html`을 같은 아티팩트 주소에 다시 게시하면 QR은 그대로 유지됩니다. 아티팩트는 기본 비공개이므로 게시 후 공유 메뉴에서 공개로 바꿔야 QR 접속이 됩니다. 단일 파일 페이지에는 서비스 워커/설치 매니페스트가 없고, 호스트 프레임 정책에 따라 AR 카메라가 열리지 않을 수 있습니다.

이전 codex Sites 배포 절차는 다음과 같습니다. Sites 프로젝트는 `.openai/hosting.json`의 `project_id`를 재사용합니다. 검증한 소스를 원격에 push하고 `git rev-parse --verify HEAD`의 전체 SHA를 사용합니다. 빌드 성공 후 `.openai/hosting.json`과 `dist/`만 tar로 묶어 버전을 저장하고 공개 배포합니다. 현재 접근 범위는 public입니다. 사용자 문서나 로컬 산출물을 소스 배포에 포함하지 않습니다.

## 주요 파일

- `src/App.tsx`, `src/interface.css`: 간결한 현장/신고/작업자/QR UI
- `src/network.ts`: 시설 정보와 관로 경로
- `src/components/PipeScene.tsx`: 도로/주변 구조와 카메라/단면
- `src/components/UtilityNetwork.tsx`: 관로/이음부/판/맨홀/이격 표시
- `src/components/ARView.tsx`, `FloorARScene.tsx`: WebXR 지면 정렬/지하 투시/심도 표시
- `src/ar/createPipeModel.ts`: 지표면 y=0과 원래 매설 깊이를 보존하는 배관 모형
- `tests/demo.spec.ts`: 모바일/PC의 핵심 기능과 3D 화면 검증
- `tests/ar.spec.ts`, `tests/xr-mock.ts`: 공간 고정/추적 복구/세션 수명 검증

React, TypeScript, Vite, Three.js, React Three Fiber를 사용합니다. Pretendard 글꼴은 저장소에 포함되어 있으며 SIL OFL 라이선스를 따릅니다.

## QR 첫 화면 / 2026-09-24 수정

EOCS의 파란 원형 버튼과 하늘색 정보 영역을 참고해 QR 진입 화면을 공사 조회 / 작업 시작 신고로 구성했습니다. 첫 화면의 고정 시나리오는 미접수 공사이며, 신고하기는 로컬 신고 작성 화면으로 연결됩니다. 접수번호가 있는 작업자는 작업 시작 신고에서 현장 확인 후 AR / 3D를 선택합니다. 실제 조회 결과나 기관 접수 완료를 주장하지 않습니다.

UI의 DEMO / 누구나 이용 / 예시 현장 표기와 QR 생성 화면을 제거했습니다. 접속 정보는 화면에 표시하고 자동입력 기능을 유지합니다. 번호 2026-001-001 및 비밀번호 1234는 기존과 같은 로컬 검증용 값이며 실제 기관 계정이 아닙니다. 기기에만 저장되는 신고와 실제 기관 전송의 구분은 제출 및 결과 화면에 남겼습니다. QR 이미지 파일과 연결 주소는 그대로 유지됩니다.

## PPT 화면과 명칭 통일

현장 공사 조회 / 공사 내역 미조회 / 현장 제보 / 제보 접수 / 접수 완료로 시민 흐름을 통일했습니다. 미조회는 미신고 판정과 구분됩니다. 작업자 메뉴는 작업 시작 신고, 접수번호 확인 화면은 공사 정보 확인, 기능 선택 화면은 지하매설물 조회로 표기합니다. 기능은 지하 투시 AR / 3D 배관 조회입니다. 실제 기관 전송 없이 기기에 기록되는 범위는 제출 및 결과 화면에 명시합니다.

공식 용어 확인(2026-09-24): https://app.eocs.or.kr/ 의 현장작업시작, https://www.eocs.or.kr/jsp/intro/process.jsp 의 굴착공사자, https://www.eocs.or.kr/jsp/apply/progress/list.jsp 의 굴착담당자 / 접수번호를 참고했습니다. 최종 작업자 진입 버튼은 현장 작업 시작이며 대상자 설명 문장은 표시하지 않습니다.
