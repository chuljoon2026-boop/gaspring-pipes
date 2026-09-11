# 여수산단 배관 조회

공개 사이트: https://site-ys001.sapp05034.chatgpt.site/?location=YS-001

QR 현장 진입, 현장 신고 작성, 작업자 접속, 지하 관로 3D·AR 조회를 제공합니다.

## 화면

- 전체 3D: 도로 종방향 산업배관과 기반시설 배치
- 평면: 분기·도로 횡단 위치
- 도로 단면: 관경과 중심 심도 비교
- 교차부: 용수 횡단관과 산업배관의 상하 관계
- 시설 선택: 관종·재질·접합·심도·외경 또는 구조물 규격
- 보호판 분리 및 관종별 표시, 노면 불투명도 조절

모델 범위는 길이 64m, 차도 폭 24m입니다. 15개 관로 계통을 24개 구간으로 표현하고 밸브·보호판·복공판·흙막이·맨홀을 포함해 20개 시설을 선택할 수 있습니다. 렌더링 반지름은 표시 외경과 일치합니다. `depth`는 관 중심 깊이이며 일부 횡단관·자연유하 관로는 경로에 따라 깊이가 달라집니다.

## 자료와 범위

`src/sources.ts`에 에어리퀴드의 여수 수소·일산화탄소 공급망, GS의 여수 MFC 지하배관 증설, K-water의 여수 생활·공업용수 공급 자료를 연결했습니다. 관종과 공급구조를 참고한 재구성이며 특정 도로의 실측 좌표·관경·심도를 나타내지 않습니다. 건물명·도로명은 흐리게 표시합니다.

공사 등록 조회와 기관 신고 전송은 연결되지 않았습니다. 신고 내용은 현재 브라우저의 `localStorage`에 저장되고 사진은 선택·미리보기만 제공합니다. 작업자 접속은 프론트엔드의 열람용 확인이며 서버 인증을 대신하지 않습니다. AR은 카메라 영상 위에 모델을 표시하며 공간 정합은 연결되지 않았습니다. 각 연결 상태는 관련 화면에서 짧게 표시합니다.

## 실행

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm run test:e2e
```

Node.js 22.12 이상. `http://localhost:5173/?location=YS-001`로 접속합니다.

작업자 접속 화면의 **열람 정보 채우기 → 배관 조회**로 진입합니다. 접속 코드 `YS-2026-001`, 비밀번호 `1234`, 이름은 빈 값이 아니면 됩니다.

## QR

```bash
npm run qr -- --url https://site-ys001.sapp05034.chatgpt.site/ --location YS-001
```

`artifacts/qr/`에 PNG, SVG, 인쇄 HTML, 연결 주소 JSON을 생성합니다. 공개 주소는 PC 실행 여부와 관계없이 열립니다.

## 배포

Sites 프로젝트는 `.openai/hosting.json`의 `project_id`를 재사용합니다. 검증한 소스를 원격에 push하고 `git rev-parse --verify HEAD`의 전체 SHA를 사용합니다. 빌드 성공 후 `.openai/hosting.json`과 `dist/`만 tar로 묶어 버전을 저장하고 공개 배포합니다. 현재 접근 범위는 public입니다. 사용자 문서나 로컬 산출물을 소스 배포에 포함하지 않습니다.

## 주요 파일

- `src/App.tsx`, `src/interface.css`: 간결한 현장·신고·작업자·QR UI
- `src/network.ts`: 시설 정보와 관로 경로
- `src/components/PipeScene.tsx`: 도로·주변 구조와 카메라·단면
- `src/components/UtilityNetwork.tsx`: 관로·이음부·판·맨홀·이격 표시
- `src/components/ARView.tsx`: 카메라와 배관 겹쳐 보기
- `tests/demo.spec.ts`: 모바일·PC의 핵심 기능과 3D 화면 검증

React, TypeScript, Vite, Three.js, React Three Fiber를 사용합니다. Pretendard 글꼴은 저장소에 포함되어 있으며 SIL OFL 라이선스를 따릅니다.
