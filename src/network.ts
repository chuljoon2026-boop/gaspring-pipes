export type Vec3 = [number, number, number]
export type Facility = {
  name: string; kind: string; diameter: number; depth: number; material: string
  joint: string; detail: string; color: string; bodyColor?: string
  layer: 'gas' | 'utilities' | 'structures'; anchor: Vec3; dimensions?: string
}

// Metres, depth to pipe centre. Product types follow public Yeosu examples.
// Dimensions and routes are representative; they are not surveyed utility records.
export const FACILITIES: Record<string, Facility> = {
  'GP-001': { name: '수소 이송관', kind: '수소', diameter: 300, depth: 1.85, material: '외면 방식 강관', joint: '맞대기 용접 · 이음부 방식', detail: '도로 종방향 본관. 밸브실에서 공장 인입관으로 분기합니다.', color: '#c5a64d', bodyColor: '#696b58', layer: 'gas', anchor: [-7, -1.85, -7] },
  'GP-002': { name: '수소 공장 인입관', kind: '수소 분기', diameter: 200, depth: 1.85, material: '외면 방식 강관', joint: '용접 티 · 밸브 플랜지', detail: '본관에서 보도 아래 전력관로를 지나 공장 측으로 연결됩니다.', color: '#c5a64d', bodyColor: '#777965', layer: 'gas', anchor: [-13, -1.85, -11.5] },
  'GP-003': { name: '일산화탄소 이송관', kind: '일산화탄소', diameter: 250, depth: 2.1, material: '외면 방식 강관', joint: '맞대기 용접', detail: '수소 본관과 별도 관로. 공업용수 횡단관은 이 관 아래로 통과합니다.', color: '#a48ac3', bodyColor: '#756f80', layer: 'gas', anchor: [-4, -2.1, -5.55] },
  'GP-004': { name: '나프타 이송관', kind: '나프타', diameter: 400, depth: 2.3, material: '외면 방식 강관', joint: '맞대기 용접', detail: '제품 이송관 가운데 관경이 큰 관로로, 보호판 아래에 배치했습니다.', color: '#bc9171', bodyColor: '#827060', layer: 'gas', anchor: [0, -2.3, -4.1] },
  'GP-005': { name: 'LPG 이송관', kind: 'LPG', diameter: 300, depth: 1.9, material: '외면 방식 강관', joint: '용접 · 공장 인입부 분기', detail: '종방향 본관에서 분기한 관은 용수관 아래, 우수관 위를 지나 맞은편으로 연결됩니다.', color: '#ce9270', bodyColor: '#856853', layer: 'gas', anchor: [-8, -1.9, -2.65] },
  'GP-006': { name: '에틸렌 이송관', kind: '에틸렌', diameter: 250, depth: 1.7, material: '외면 방식 강관', joint: '맞대기 용접', detail: 'LPG·프로필렌 관로와 평행하게 놓인 독립된 제품 이송관입니다.', color: '#78a095', bodyColor: '#607d76', layer: 'gas', anchor: [4, -1.7, -1.2] },
  'GP-007': { name: '프로필렌 이송관', kind: '프로필렌', diameter: 200, depth: 2, material: '외면 방식 강관', joint: '맞대기 용접', detail: '같은 도로를 지나지만 인접 이송관과 매설 높이가 다릅니다.', color: '#bc8595', bodyColor: '#876973', layer: 'gas', anchor: [10, -2, 0.25] },
  'GP-008': { name: 'LPG 도로 횡단관', kind: 'LPG 횡단', diameter: 200, depth: 3.55, material: '외면 방식 강관', joint: '용접 엘보 · 수직 굴곡', detail: '용수관 아래로 깊이를 낮춘 뒤 우수관 앞에서 상승하는 입체 횡단 구간입니다. 중심 깊이 1.9–3.55 m.', color: '#ce9270', bodyColor: '#856853', layer: 'gas', anchor: [-19, -3.55, 3.1] },
  'V-001': { name: '수소 분기 차단밸브', kind: '차단밸브', diameter: 200, depth: 1.85, material: '강재 밸브 · 강재 플랜지', joint: '볼트 체결 플랜지', detail: '콘크리트 밸브실 내부의 분기 차단밸브. 조작축이 지표 점검구로 이어집니다.', color: '#c5a64d', bodyColor: '#7d827a', layer: 'gas', anchor: [-13, -1.3, -8.5] },
  'WP-001': { name: '공업용수 본관', kind: '공업용수', diameter: 800, depth: 2.65, material: '도복장 강관', joint: '용접 · 관 받침', detail: '제품관과 다른 깊이의 대구경 용수관. 횡단관이 아래에서 올라와 연결됩니다.', color: '#6dacc2', bodyColor: '#547783', layer: 'utilities', anchor: [6, -2.65, 4.4] },
  'WP-002': { name: '회수 용수관', kind: '회수용수', diameter: 500, depth: 2.25, material: '도복장 강관', joint: '맞대기 용접', detail: '공업용수 본관 옆의 별도 회수 관로. 관경과 중심 깊이가 다릅니다.', color: '#6eb0a0', bodyColor: '#537f72', layer: 'utilities', anchor: [10, -2.25, 6.15] },
  'WP-003': { name: '공업용수 횡단관', kind: '용수 횡단', diameter: 600, depth: 3.55, material: '도복장 강관', joint: '용접 엘보 · 본관 티', detail: '6개 제품관 아래를 가로질러 본관에 접속합니다. 나프타관과 수직 순이격 0.75 m.', color: '#6dacc2', bodyColor: '#547783', layer: 'utilities', anchor: [6, -3.55, -3.2] },
  'SW-001': { name: '우수 간선관', kind: '우수', diameter: 1200, depth: 4.05, material: '철근 콘크리트관', joint: '소켓 · 고무링', detail: '도로 측면의 대구경 중력식 관로. 길이 방향 경사 0.4%, 중심 깊이 3.92–4.18 m.', color: '#9da991', bodyColor: '#8d9682', layer: 'utilities', anchor: [18, -4.12, 9.35] },
  'SW-002': { name: '오수관', kind: '오수', diameter: 500, depth: 3.3, material: '내식성 하수관', joint: '소켓 · 고무링', detail: '우수와 분리된 오수 관로. 점검 맨홀 사이에 완만한 구배를 둡니다.', color: '#a79678', bodyColor: '#88795f', layer: 'utilities', anchor: [-6, -3.28, 11.2] },
  'EL-001': { name: '전력 관로 6공', kind: '전력 6공', diameter: 150, depth: 1.05, material: '합성수지관 · 콘크리트 관로', joint: '3열 × 2단 덕트', detail: '150 mm 보호관 6공. 위아래 2단으로 배치하고 콘크리트로 보호합니다.', color: '#c47f70', bodyColor: '#936c5e', layer: 'utilities', anchor: [-3, -1.05, -10.25], dimensions: '150 mm × 6공' },
  'TC-001': { name: '통신 관로 4공', kind: '통신 4공', diameter: 100, depth: 0.7, material: '합성수지 보호관', joint: '2열 × 2단 덕트', detail: '보도 아래 얕은 깊이의 통신관. 제품관·배수관과 별도 높이에 놓입니다.', color: '#85a88c', bodyColor: '#768568', layer: 'utilities', anchor: [2, -0.7, 13], dimensions: '100 mm × 4공' },
  'PL-001': { name: '배관 상부 보호판', kind: '보호판', diameter: 0, depth: 0.95, material: '철근 콘크리트', joint: '분절 배치', detail: '제품관 위에 설치한 분절 보호판. 판 분해로 가려진 관로를 확인할 수 있습니다.', color: '#a8aca3', layer: 'structures', anchor: [0, -0.95, -4.1], dimensions: '2.0 × 2.3 × 0.18 m' },
  'PL-002': { name: '도로 복공판', kind: '복공판', diameter: 0, depth: 0, material: '강판 · 하부 보강 리브', joint: '지지보 위 거치', detail: '굴착부 위의 강재 복공판. 하부 리브와 받침보까지 표시합니다.', color: '#7c8a91', layer: 'structures', anchor: [12.2, 0.18, -3.8], dimensions: '2.0 × 8.8 × 0.18 m' },
  'SH-001': { name: '굴착부 흙막이', kind: '흙막이', diameter: 0, depth: 1.8, material: 'H형강 · 강재 패널', joint: '패널 · 띠장 · 버팀보', detail: '도로 복공판 아래 굴착부 양측을 지지하는 구조입니다.', color: '#99897b', layer: 'structures', anchor: [15, -1.8, -8.55], dimensions: '높이 3.6 m' },
  'MH-001': { name: '우수 점검 맨홀', kind: '맨홀', diameter: 2000, depth: 4.05, material: '철근 콘크리트 · 주철 뚜껑', joint: '관로 접속 · 점검 사다리', detail: '대구경 우수관의 중간 점검구. 뚜껑, 맨홀 벽과 바닥의 관계를 표시합니다.', color: '#9baba4', layer: 'structures', anchor: [20, -1.5, 9.35], dimensions: '내경 2.0 m' },
}

export type PipeRoute = { id: string; points: Vec3[]; radius: number; duct?: boolean }
const longitudinal = (id: string, z: number, depth: number): PipeRoute => ({ id, radius: FACILITIES[id].diameter / 2000, points: [[-32, -depth, z], [32, -depth, z]] })
export const PIPE_ROUTES: PipeRoute[] = [
  longitudinal('GP-001', -7, 1.85),
  { id: 'GP-002', radius: 0.1, points: [[-13, -1.85, -7], [-13, -1.85, -16.5], [-9, -1.85, -16.5], [-9, 1.2, -16.5]] },
  longitudinal('GP-003', -5.55, 2.1), longitudinal('GP-004', -4.1, 2.3),
  longitudinal('GP-005', -2.65, 1.9), longitudinal('GP-006', -1.2, 1.7), longitudinal('GP-007', 0.25, 2),
  { id: 'GP-008', radius: 0.1, points: [[-19, -1.9, -2.65], [-19, -3.55, -0.7], [-19, -3.55, 6.95], [-19, -2, 8.1], [-19, -2, 17], [-15, -2, 17]] },
  longitudinal('WP-001', 4.4, 2.65), longitudinal('WP-002', 6.15, 2.25),
  { id: 'WP-003', radius: 0.3, points: [[6, -3.55, -17], [6, -3.55, 2.4], [6, -2.65, 3.65], [6, -2.65, 4.4]] },
  { id: 'SW-001', radius: 0.6, points: [[-32, -3.922, 9.35], [18.9, -4.1256, 9.35]] },
  { id: 'SW-001', radius: 0.6, points: [[21.1, -4.1344, 9.35], [32, -4.178, 9.35]] },
  { id: 'SW-002', radius: 0.25, points: [[-32, -3.236, 11.2], [32, -3.364, 11.2]] },
  ...Array.from({ length: 6 }, (_, i): PipeRoute => ({ id: 'EL-001', radius: 0.075, duct: true, points: [[-32, -0.91 - Math.floor(i / 3) * 0.28, -10.53 + (i % 3) * 0.28], [32, -0.91 - Math.floor(i / 3) * 0.28, -10.53 + (i % 3) * 0.28]] })),
  ...Array.from({ length: 4 }, (_, i): PipeRoute => ({ id: 'TC-001', radius: 0.05, duct: true, points: [[-32, -0.6 - Math.floor(i / 2) * 0.2, 12.9 + (i % 2) * 0.2], [32, -0.6 - Math.floor(i / 2) * 0.2, 12.9 + (i % 2) * 0.2]] })),
]
export const SECTION_X = -5
export const CROSSING_CLEARANCE = 0.75
