# 가스온 GAS:ON

**스마트 마커(QR) 기반 가스배관 AR 뷰어 및 무단 타공사 시민 감시 시스템**

가스안전공사 공모전 발표용 모바일 웹 프로토타입입니다. QR로 현장에 접속해 굴착공사 신고 상태를 확인하고, 시민 신고를 접수한 뒤, 작업자 인증을 거쳐 지하 가스배관의 3D/AR 데모를 살펴볼 수 있습니다.

모든 현장·공사·배관 정보는 **가상 데이터**입니다. 실제 공공 API, 기관 신고 전송, 실명 확인, 실제 매설물 측량 기능은 연결되어 있지 않습니다. 실제 현장의 작업 판단에 사용할 수 없습니다.

## 1. 바로 실행

Node.js **22.12 이상** 또는 24 LTS와 npm이 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:5173/?location=YS-001
```

잠금 파일이 있는 환경/CI에서 동일한 의존성을 설치할 때는 `npm ci`를 사용합니다. 아이콘 PNG는 프로젝트에 포함되어 있으므로 별도의 생성 없이 실행됩니다.

| 항목 | 데모 값 |
| --- | --- |
| 위치 | 여수산단 A-12 구역 |
| QR 마커 | YS-001 |
| 등록된 굴착공사 | 없음 — 가상 데이터 기준 |
| 배관 깊이 | 1.2m |
| 배관 직경 | 300mm |
| 작업자 허가번호 | **YS-2026-001** |
| 작업자명/대표자명 | 공백이 아닌 이름, 예: **김안전** |
| 데모 비밀번호 | **1234** |

허가번호는 **작업자 화면을 여는 데모 인증값**입니다. 로그인이나 시민 신고를 해도 현장의 가상 공사 등록 상태가 자동으로 허가 상태로 바뀌지 않습니다.

## 2. 스마트폰으로 확인

PC와 스마트폰을 같은 Wi-Fi에 연결한 뒤 PC의 로컬 IPv4 주소를 확인합니다. Windows에서는 `ipconfig`의 현재 Wi-Fi 어댑터 IPv4 값을 사용합니다.

```bash
npm run dev
npm run qr -- --url http://192.168.0.10:5173/ --location YS-001
```

`192.168.0.10`을 실제 PC 주소로 바꾸고, 휴대폰에서 생성된 QR을 스캔합니다. 개발 서버는 `0.0.0.0:5173`에 열리며, Windows 방화벽에서 해당 포트의 개인 네트워크 접근이 허용되어야 합니다. 게스트 Wi-Fi 등 기기 간 연결이 차단된 네트워크에서는 접근할 수 없습니다.

**`localhost`는 QR을 읽는 스마트폰 자체를 뜻하므로 PC 서버로 연결되지 않습니다.** 발표에는 배포된 HTTPS 주소를 권장합니다. 일반 LAN HTTP 주소에서도 화면 시연은 가능하지만, 모바일 카메라 접근과 PWA 설치는 HTTPS에서 확인해야 합니다.

## 3. 주요 화면과 조작

| 화면 | 구현 내용 |
| --- | --- |
| 현장 홈 | 경고 상태 카드, 시민 신고 진입, QR 현장명, 매설 주의구역 안내, 작업자 로그인 |
| 시민 신고 | QR의 현재 위치 자동 입력, 사진 선택/현장 촬영, 간단한 사유, 접수 완료 및 접수번호 |
| 작업자 로그인 | 허가번호·이름·데모 비밀번호 검사 후 작업자 전용 화면 진입 |
| 3D 배관 뷰어 | 도로·보도·건물, 지하 직선/곡선 배관·밸브·분기부, 반투명 지표, 깊이/직경 및 위험 경계 |
| AR 보기 | 카메라 배경과 3D 배관 오버레이를 활용하는 발표용 시뮬레이션 |
| QR 안내 | 현재 접속 주소와 위치 ID로 QR 생성 및 공유 |
| PWA | 홈 화면 설치, 독립된 앱 창, 빌드 파일의 오프라인 캐시 |

3D 화면은 마우스 드래그로 회전하고, 휠로 확대/축소하며, 우클릭 드래그로 이동합니다. 모바일에서는 한 손가락 드래그로 회전하고 두 손가락으로 확대/축소 및 이동합니다. 화면의 보기 조작을 이용해 지하 구조를 강조할 수 있습니다.

발표를 빠르게 진행하려면 신고 화면의 **데모 사진 사용**과 추천 신고 사유 버튼, 로그인 화면의 **데모 계정 입력**을 이용하세요. 실제 사진은 선택 사항이며 JPG·PNG·WEBP·GIF 형식, 최대 10MB를 지원합니다. 신고 사유는 5~500자를 입력합니다. 접수 완료 화면의 **이어서 작업자 3D·AR 시연하기** 버튼으로 로그인 단계에 바로 연결됩니다.

배관 화면에는 **3D 뷰 / 평면 뷰**, 시점 초기화, 전체화면, 가스배관·주의 영역·정보 라벨 표시 스위치, 지표면 불투명도 조절이 있습니다. 화면 전환은 `#report`, `#login`, `#worker`, `#ar`, `#qr` 등의 해시 주소를 사용하고, `?location=YS-001`은 유지합니다. 로그인하지 않고 작업자/AR 주소를 열면 인증 화면이 표시됩니다.

AR 화면은 시뮬레이션 배경으로 시작하며 **현장 카메라 켜기** 버튼을 누르면 기기 카메라 사용 권한을 요청합니다. 실제 배관의 공간 위치를 측량하거나 QR 자세를 추적하는 WebXR 기능이 아닙니다. 카메라 사용이 불가능하거나 권한이 거부되면 데모 배경으로 흐름을 이어갈 수 있습니다. 카메라 영상은 서버로 업로드되지 않습니다.

## 4. QR 이미지와 인쇄 안내판 생성

실제 배포 주소가 정해지면 아래 명령으로 다시 생성하세요.

```bash
npm run qr -- --url https://your-project.vercel.app/ --location YS-001
```

GitHub Pages 저장소 경로도 그대로 유지합니다.

```bash
npm run qr -- --base-url https://your-name.github.io/gas-on/ --location YS-001
```

두 번째 명령이 인코딩하는 주소는 `https://your-name.github.io/gas-on/?location=YS-001`입니다. 기존 쿼리 매개변수는 유지하고 `location`만 지정한 값으로 설정합니다. 현재 데모에서 인식하는 마커 ID는 `YS-001` 하나이며, 다른 ID는 생성 단계에서 거부합니다.

| 생성 파일 | 용도 |
| --- | --- |
| `artifacts/qr/YS-001.png` | 1200px QR 이미지, 발표 슬라이드 삽입 |
| `artifacts/qr/YS-001.svg` | 확대 인쇄용 벡터 QR |
| `artifacts/qr/YS-001.html` | QR·현장명·접속 URL이 포함된 A4 인쇄 안내판 |
| `artifacts/qr/urls.json` | 위치 ID와 최종 인코딩 URL 기록 |

`YS-001.html`을 브라우저에서 열어 **QR 안내판 인쇄 / PDF 저장**을 누릅니다. 명령의 URL을 생략하면 `http://localhost:5173/`를 사용하고 **스마트폰에서 접속할 수 없는 PC 로컬 QR**이라는 경고를 명령 출력과 안내판에 표시합니다. `npm run qr -- --help`로 사용법을 확인할 수 있습니다.

생성물은 `.gitignore`에서 제외됩니다. 발표용 QR은 HTTPS 배포 주소로 재생성하고, 실제 스마트폰으로 한 번 스캔한 뒤 인쇄하세요. 웹앱의 QR 화면은 처음에 **그 화면을 연 주소**를 사용하므로, PC의 localhost에서 열면 localhost QR이 생성됩니다. 화면의 **웹페이지 주소**에 배포 주소를 입력하고 **이 주소로 QR 생성**을 눌러 변경한 뒤 PNG를 다운로드할 수도 있습니다.

## 5. 프로덕션 빌드와 PWA

```bash
npm run typecheck
npm run build
npm run preview
```

미리보기 주소는 `http://localhost:4173/?location=YS-001`이며 배포 파일은 `dist/`에 생성됩니다. `vite preview`는 로컬 검토용 서버입니다.

`vite-plugin-pwa`가 매니페스트와 서비스 워커를 빌드하고 등록 스크립트를 자동으로 삽입합니다. JS·CSS·HTML·SVG·PNG·WOFF2를 캐시하므로 지연 로딩되는 3D 번들도 포함됩니다. 캐시 가능한 개별 파일의 최대 크기는 5MB입니다. 외부 지도, 글꼴 CDN, API 캐시에 의존하지 않습니다.

- Android Chrome: 배포 HTTPS 주소를 열고 브라우저 메뉴의 **앱 설치 / 홈 화면에 추가**를 이용합니다.
- iPhone Safari: 공유 메뉴에서 **홈 화면에 추가**를 선택합니다.
- 설치 뒤에는 `standalone` 앱 창으로 열립니다. 완전한 OS 전체화면 동작은 기기와 브라우저에 따라 다릅니다.
- 최초 접속과 서비스 워커 설치가 끝나야 오프라인 실행이 가능합니다. 발표 전에 HTTPS 배포 페이지와 3D 화면을 한 번 열어 확인하세요.
- 개발 모드에서는 서비스 워커를 끕니다. 설치·오프라인 확인은 빌드 미리보기 또는 HTTPS 배포에서 진행합니다.
- 새 빌드를 배포하면 서비스 워커가 자동 갱신됩니다. 이전 화면이 남으면 탭을 모두 닫고 다시 열거나 브라우저 개발자 도구에서 해당 사이트 서비스 워커를 해제합니다.

아이콘을 변경한 뒤 PNG와 마스크 아이콘을 재생성하려면 `public/favicon.svg`를 수정하고 `npm run icons`를 실행합니다. 마스크 아이콘은 중앙 안전 영역에 심벌을 배치합니다.

## 6. Vercel 배포

백엔드 서버와 유료 API 키 없이 정적 사이트로 배포할 수 있습니다. 계정 생성과 배포는 사용자가 진행하며, 이 프로젝트에는 외부 계정에 자동 배포하는 비밀키가 포함되지 않습니다.

1. 프로젝트를 GitHub 저장소에 올립니다.
2. Vercel에서 해당 저장소를 Import합니다.
3. Framework는 **Vite**, Build Command는 **npm run build**, Output Directory는 **dist**를 사용합니다. `vercel.json`에도 설정되어 있습니다.
4. Vercel 루트 도메인에 배포할 때 `BASE_PATH`는 `/`로 두거나 생략합니다.
5. 배포된 HTTPS 주소에 `?location=YS-001`을 붙여 확인합니다.
6. **배포 주소로 QR을 다시 생성**하고 휴대폰에서 스캔합니다.

일반 정적 Vite 배포 방식은 [Vite 공식 배포 안내](https://vite.dev/guide/static-deploy.html#vercel)를 참고하세요. 계정의 무료 요금제 이용 조건과 한도는 배포 서비스에서 확인할 수 있습니다.

## 7. GitHub Pages 배포

`.github/workflows/deploy.yml`을 포함했습니다. `main`에 push하거나 Actions에서 수동 실행하면 정적 파일을 빌드해 Pages에 배포합니다.

1. GitHub 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
2. 잠금 파일 `package-lock.json`을 포함해 프로젝트를 `main` 브랜치에 올립니다.
3. Actions의 **Deploy GAS:ON to GitHub Pages** 실행 결과를 확인합니다.
4. 결과의 Pages URL로 접속하고 해당 URL로 QR을 생성합니다.

워크플로는 `actions/configure-pages`가 알려주는 경로를 `BASE_PATH`에 전달합니다. 저장소 Pages인 `/gas-on/`와 사용자 사이트/커스텀 도메인의 `/`를 구분하므로 매니페스트의 `start_url`, `scope`, 아이콘, 서비스 워커도 배포 경로를 따릅니다. 화면 전환에 별도 서버 경로를 요구하지 않아 Pages에서 사용 가능합니다.

로컬에서 저장소 하위 경로 빌드를 확인하려면 `.env.example`을 `.env`로 복사하고 다음 값을 지정합니다.

```dotenv
BASE_PATH=/gas-on/
```

```bash
npm run build
npm run preview
```

이때 주소는 `http://localhost:4173/gas-on/?location=YS-001`입니다. Vercel 루트 배포나 Android 빌드로 돌아갈 때는 `BASE_PATH=/`로 복원하세요. [Vite의 GitHub Pages 안내](https://vite.dev/guide/static-deploy.html#github-pages)에서 기본 경로와 배포 설정을 확인할 수 있습니다.

## 8. Android APK로 확장하기

`capacitor.config.ts`에 앱 ID `com.gason.safetydemo`, 앱 이름 `GAS:ON`, 웹 빌드 폴더 `dist`를 지정했고 Capacitor 의존성과 npm 명령을 포함했습니다. **현재 결과물은 웹/PWA이며 APK 파일은 생성하지 않았습니다.**

Android Studio와 해당 Capacitor 버전에 맞는 Android SDK/JDK를 설치한 환경에서 다음 순서로 진행합니다. `.env`의 `BASE_PATH`는 `/`로 지정합니다.

```bash
npm run build
npm run android:add
npm run android:sync
npm run android:open
```

`android:add`는 최초 한 번만 실행합니다. 생성된 Android Studio 프로젝트에서 에뮬레이터/기기를 선택해 실행하거나 **Build → Build APK(s)**에 해당하는 메뉴로 APK를 빌드합니다. 웹 코드를 변경한 뒤에는 `npm run android:sync`로 웹 빌드를 다시 복사합니다. 실제 배포용 APK/AAB는 별도의 서명 설정이 필요합니다.

Android WebView의 카메라 권한은 네이티브 프로젝트에서 추가 확인이 필요합니다. 웹의 AR 시뮬레이션은 네이티브 ARCore 기능으로 자동 변환되지 않습니다. 설정 과정은 [Capacitor 설치 문서](https://capacitorjs.com/docs/getting-started)와 [Android 문서](https://capacitorjs.com/docs/android)를 참고하세요.

## 9. 3분 발표 시나리오

발표 전: HTTPS 주소로 배포 → QR 안내판 생성 → 스마트폰에서 미리 접속 → 사진 한 장 준비 → 3D 렌더링과 카메라 권한 확인. 카메라 권한이 없을 때도 AR 데모 배경을 사용할 수 있습니다.

| 시간 | 발표자 조작 | 전달할 메시지 |
| --- | --- | --- |
| 0:00–0:20 | QR 스캔, 위치명과 경고 카드 확인 | “현장 마커를 스캔하면 이 구역의 굴착공사 신고 상태를 바로 확인합니다.” |
| 0:20–0:55 | **미신고 굴착 신고하기**, 사진 첨부 또는 **데모 사진 사용**, 사유 입력 | “시민도 위치를 다시 입력할 필요 없이 현장 사진과 상황을 전달할 수 있습니다.” |
| 0:55–1:15 | **신고 접수**, 접수 완료 및 접수번호 확인 | “현장 제보가 접수되는 과정을 보여줍니다. 현재는 가상 접수입니다.” |
| 1:15–1:40 | **이어서 작업자 3D·AR 시연하기** → **데모 계정 입력** → **작업자 인증 후 입장** | “허가된 작업자는 별도의 전용 화면에 접근합니다.” |
| 1:40–2:25 | 3D 화면 회전·확대, 지하 배관·분기부·밸브 강조 | “깊이 1.2m, 직경 300mm의 배관과 주의 영역을 입체적으로 확인합니다.” |
| 2:25–2:50 | **AR 보기**, 카메라 또는 데모 배경 확인 | “현장 위에 매설 정보를 겹쳐 보여주는 AR 활용 모습을 시연합니다.” |
| 2:50–3:00 | 현장 홈으로 돌아오기 | “시민의 제보와 작업자의 사전 확인을 하나의 스마트 마커로 연결합니다.” |

## 10. 데이터 저장과 데모 범위

- 위치는 GPS 측정값이 아니라 URL의 `location` 매개변수에 연결된 QR 마커 정보입니다.
- 신고 접수는 브라우저 `localStorage`의 `gason.reports.v1`에 최근 30건의 메타데이터만 저장합니다. 다른 기기와 공유하거나 기관으로 전송하지 않습니다.
- 사진은 현장 확인을 위한 일시적인 미리보기만 제공합니다. 이미지 파일은 업로드하거나 영구 저장하지 않고 사진 첨부 여부만 기록합니다.
- 작업자 인증은 프런트엔드에서 데모 값을 확인하고 해당 탭의 `sessionStorage`의 `gason.session.v1`에 보관합니다. 실제 보안 인증이나 서버 권한 검증이 아닙니다.
- 시연 기록을 초기화하려면 해당 사이트의 브라우저 저장 데이터를 삭제하세요. 개발자 도구에서 `localStorage.removeItem('gason.reports.v1')` 및 `sessionStorage.removeItem('gason.session.v1')` 실행 후 새로고침해도 됩니다.
- 매설물 형상·깊이·위험 경계는 설명을 위한 3D 모델이며 실제 여수산단 시설도면이 아닙니다.

## 11. 프로젝트 구조

```text
src/                       React 화면, mock 데이터, 3D/AR 뷰어
public/                    PWA 아이콘과 정적 파일
scripts/generate-qr.mjs     QR PNG/SVG/인쇄 HTML/URL 목록 생성
scripts/generate-icons.mjs  PWA 아이콘 생성
vite.config.ts             Vite, 경로, PWA/오프라인 캐시 설정
capacitor.config.ts        선택적 Android 프로젝트 설정
vercel.json                Vercel 정적 배포 설정
.github/workflows/          GitHub Pages 빌드·배포 워크플로
.env.example               BASE_PATH 예시
artifacts/qr/              생성된 QR 결과물 (git 제외)
dist/                      프로덕션 빌드 (git 제외)
```

기술 스택: React 19, TypeScript, Vite, Three.js/React Three Fiber, vite-plugin-pwa, QRCode, Capacitor. 별도 API 키나 백엔드 설정은 필요하지 않습니다.

## 12. 글꼴 및 라이선스

한국어 UI에는 [Pretendard 공식 프로젝트](https://github.com/orioncactus/pretendard)의 가변 웹폰트를 사용합니다. 폰트는 `src/assets/fonts/PretendardVariable.woff2`에 포함되어 외부 글꼴 CDN 요청 없이 로드되고, 프로덕션에서는 오프라인 캐시에 포함됩니다. SIL Open Font License 1.1 원문은 `src/assets/fonts/OFL.txt`에 함께 제공합니다.

정적 배포에도 라이선스가 포함되도록 `public/licenses/Pretendard-OFL.txt`를 제공합니다.

## 13. 브라우저 검증

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright로 모바일(390×844)과 데스크톱(1440×1000)에서 시민 신고, 이미지 첨부, 신고 내역 보존, 인증·로그아웃, 잘못된 QR, 3D 레이어·회전·확대, QR 생성·다운로드, AR 카메라 거부와 영상 스트림 해제를 검증합니다. 테스트가 개발 서버를 자동으로 실행하며, 이미 실행된 5173 포트 서버도 재사용합니다.

카메라 성공 테스트는 합성 `MediaStream`을 사용합니다. 실제 스마트폰 카메라와 PWA 설치는 HTTPS 배포 후 해당 기기에서 시연 전 확인하세요. 카메라를 사용할 수 없어도 AR 시뮬레이션을 진행할 수 있습니다.

3D 상세 패널의 시설 선택에서 주배관 GP-001(300mm), 분기관 GP-002(200mm), 차단 밸브 V-001(연결 분기관 200mm)를 바꿀 수 있습니다. 모두 지표면 기준 중심 깊이 1.2m인 가상 시설입니다.
