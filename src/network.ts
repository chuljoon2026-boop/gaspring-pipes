export type Vec3 = [number, number, number]
export type Facility = {
  name: string; kind: string; diameter: number; depth: number; material: string
  joint: string; detail: string; color: string; layer: 'gas' | 'utilities' | 'structures'
  anchor: Vec3; dimensions?: string
}

export const FACILITIES: Record<string, Facility> = {
  'GP-001': { name: '중압 도시가스 주배관', kind: '주배관', diameter: 300, depth: 1.2, material: 'PE 피복 강관', joint: '용접 + 이음부 피복', detail: '직선 구간, 90° 곡관, 두 개의 분기점을 연결합니다.', color: '#e6a52d', layer: 'gas', anchor: [-4.1, -1.2, 0.5] },
  'GP-002': { name: '중압 도시가스 분기관', kind: '분기관', diameter: 200, depth: 1.2, material: 'PE 피복 강관', joint: '용접 + 이음부 피복', detail: '주배관에서 밸브실과 건물 입상관으로 분기됩니다.', color: '#d7aa44', layer: 'gas', anchor: [-1.6, -1.2, -0.7] },
  'GP-003': { name: '건물 인입 입상관', kind: '입상관', diameter: 100, depth: 1.2, material: '피복 강관 / 노출 강관', joint: '용접 · 밸브부 플랜지', detail: '지하 -1.2m에서 지상 +1.1m로 연결되는 수직 구간입니다.', color: '#cfa142', layer: 'gas', anchor: [-1.6, 0.65, -2.45] },
  'GP-004': { name: 'PE 인입 분기관', kind: 'PE관', diameter: 110, depth: 0.9, material: '가스용 폴리에틸렌(PE)', joint: '융착 · 강관 전환 이음', detail: '주배관에서 분기해 전면 건물 방향으로 이어집니다.', color: '#ffc34a', layer: 'gas', anchor: [-6.3, -0.9, 1.9] },
  'V-001': { name: '분기관 차단 밸브', kind: '차단 밸브', diameter: 200, depth: 1.2, material: '강재 밸브 본체', joint: '정비용 접합부', detail: '밸브실 안의 차단 밸브와 조작 핸들입니다.', color: '#e78738', layer: 'gas', anchor: [-1.6, -0.65, -1.85] },
  'WP-001': { name: '상수도 본관', kind: '상수관', diameter: 250, depth: 1.65, material: '덕타일 주철관', joint: '소켓 이음', detail: '가스 분기관 아래를 지나며 오른쪽에서 방향을 바꿉니다.', color: '#3b9fd0', layer: 'utilities', anchor: [2.3, -1.65, -1.05] },
  'SW-001': { name: '우수 배수관', kind: '배수관', diameter: 450, depth: 1.9, material: '콘크리트관', joint: '소켓 이음', detail: '도로 전면을 따라 이어지는 대구경 배수관입니다.', color: '#82978b', layer: 'utilities', anchor: [4.3, -1.9, 1.85] },
  'EL-001': { name: '전력 보호관 4열', kind: '전력관', diameter: 80, depth: 0.6, material: '합성수지 보호관', joint: '커플링 이음', detail: '가스·상수관과 다른 깊이에 놓인 4열 관로입니다.', color: '#cb675e', layer: 'utilities', anchor: [-5.2, -0.6, -2.05] },
  'PL-001': { name: '배관 상부 보호판', kind: '보호판', diameter: 0, depth: 0.62, material: '강재 판', joint: '분할 배치', detail: '주배관 위를 덮는 판입니다. 분해 보기를 누르면 위로 들어 올립니다.', color: '#709ca8', layer: 'structures', anchor: [1, -0.62, 0.5], dimensions: '1.55 × 0.95 × 0.06 m' },
  'PL-002': { name: '도로 복공판', kind: '복공판', diameter: 0, depth: 0, material: '강재 판 + 보강 리브', joint: '지지보 위 거치', detail: '굴착부 상부에 놓인 도로용 판과 하부 보강재입니다.', color: '#6c7d86', layer: 'structures', anchor: [-7.8, 0.12, 0], dimensions: '2.1 × 5.2 × 0.12 m' },
  'SH-001': { name: '굴착면 지지판', kind: '지지판', diameter: 0, depth: 1.15, material: '강재 패널 + H형 지지대', joint: '패널 · 보강대 조합', detail: '굴착부 측면의 판과 수직 보강대를 표시합니다.', color: '#a28c74', layer: 'structures', anchor: [2.5, -1.1, -2.7], dimensions: '패널 높이 2.1 m' },
}

export const PIPE_ROUTES: { id: string; points: Vec3[]; radius: number }[] = [
  { id: 'GP-001', radius: 0.15, points: [[-9.4,-1.2,0.5],[3.8,-1.2,0.5],[5.1,-1.2,0.5],[5.1,-1.2,-2.45]] },
  { id: 'GP-002', radius: 0.1, points: [[-1.6,-1.2,0.5],[-1.6,-1.2,-2.45]] },
  { id: 'GP-003', radius: 0.05, points: [[-1.6,-1.2,-2.45],[-1.6,1.1,-2.45],[0.1,1.1,-2.45]] },
  { id: 'GP-004', radius: 0.055, points: [[-6.3,-1.2,0.5],[-6.3,-1.2,1.25],[-6.3,-0.9,1.65],[-6.3,-0.9,2.4],[-3.5,-0.9,2.4]] },
  { id: 'WP-001', radius: 0.125, points: [[-9.4,-1.65,-1.05],[7.1,-1.65,-1.05],[7.1,-1.65,2.4],[9.4,-1.65,2.4]] },
  { id: 'SW-001', radius: 0.225, points: [[-9.4,-1.9,1.85],[9.4,-1.9,1.85]] },
  ...[0,1,2,3].map(i => ({ id: 'EL-001', radius: 0.04, points: [[-9.4,-0.6,-2.35+i*0.18],[8.4,-0.6,-2.35+i*0.18],[8.4,-0.6,0.3+i*0.18],[9.4,-0.6,0.3+i*0.18]] as Vec3[] })),
]
