export const LOCATION = {
  id: 'YS-001',
  name: '한빛산단 앞 도로',
  address: '한빛산단 앞 도로 / 보도 정비 구간',
  coordinates: '실측 좌표 미사용',
  depth: 1.2,
  diameter: 300,
  permit: 'YS-2026-001',
  receiptNumber: '2026-001-001',
  password: '1234',
}

export type Page =
  | 'home'
  | 'report'
  | 'complete'
  | 'login'
  | 'worker'
  | 'viewer'
  | 'ar'
  | 'guide'
  | 'history'

export { FACILITIES } from './network'
export type Report = {
  id: string
  locationId: string
  locationName: string
  reason: string
  createdAt: string
  hasPhoto: boolean
}
export type Session = { name: string; permit: string; locationId: string; workStatus?: 'active' | 'paused'; startedAt?: string; updatedAt?: string }
const REPORT_KEY = 'gason.reports.v1'
const AUTH_KEY = 'gason.worker-session.v2'

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
  const now = new Date().toISOString()
  const next = { ...session, workStatus: session.workStatus || 'active', startedAt: session.startedAt || now, updatedAt: now }
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(next))
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
