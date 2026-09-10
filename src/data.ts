export const LOCATION = {
  id: 'YS-001',
  name: '여수산단 A-12 구역',
  address: '전남 여수시 여수산단로 · A-12 구역',
  coordinates: '34.8258° N, 127.6671° E',
  depth: 1.2,
  diameter: 300,
  permit: 'YS-2026-001',
  password: '1234',
}

export type Page =
  | 'home'
  | 'report'
  | 'complete'
  | 'login'
  | 'worker'
  | 'ar'
  | 'qr'
  | 'guide'
  | 'history'

export const FACILITIES: Record<string, { name: string; kind: string; diameter: number }> = {
  'GP-001': { name: '중압 도시가스 주배관', kind: '주배관', diameter: 300 },
  'GP-002': { name: '중압 도시가스 분기관', kind: '분기관', diameter: 200 },
  'V-001': { name: '분기관 차단 밸브', kind: '차단 밸브', diameter: 200 },
}
export type Report = {
  id: string
  locationId: string
  locationName: string
  reason: string
  createdAt: string
  hasPhoto: boolean
}
export type Session = { name: string; permit: string; locationId: string }
const REPORT_KEY = 'gason.reports.v1'
const AUTH_KEY = 'gason.session.v1'

export function getReports(): Report[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(REPORT_KEY) || '[]')
    return Array.isArray(value)
      ? value
          .filter(
            (item): item is Report =>
              !!item &&
              typeof item.id === 'string' &&
              typeof item.locationId === 'string' &&
              typeof item.locationName === 'string' &&
              typeof item.hasPhoto === 'boolean' &&
              typeof item.reason === 'string' &&
              typeof item.createdAt === 'string' &&
              !Number.isNaN(Date.parse(item.createdAt)),
          )
          .slice(0, 30)
      : []
  } catch {
    return []
  }
}

export function saveReport(report: Report) {
  const reports = getReports()
  localStorage.setItem(REPORT_KEY, JSON.stringify([report, ...reports].slice(0, 30)))
}

export function getSession(): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null')
    return value &&
      value.permit === LOCATION.permit &&
      value.locationId === LOCATION.id &&
      typeof value.name === 'string' &&
      value.name.trim()
      ? value
      : null
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(session))
}
export function clearSession() {
  sessionStorage.removeItem(AUTH_KEY)
}
export function makeReportId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const random = crypto
    .getRandomValues(new Uint32Array(1))[0]
    .toString(36)
    .slice(0, 5)
    .toUpperCase()
  return `GS-${date}-${random}`
}
