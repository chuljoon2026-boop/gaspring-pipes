import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileWarning,
  HardHat,
  Info,
  Layers3,
  LocateFixed,
  LockKeyhole,
  LogOut,
  MapPin,
  Maximize,
  Navigation,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  ShieldEllipsis,
  Smartphone,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import QRCode from 'qrcode'
import {
  clearSession,
  getReports,
  getSession,
  LOCATION,
  FACILITIES,
  makeReportId,
  saveReport,
  saveSession,
} from './data'
import type { Page, Report, Session } from './data'
import demoSite from './assets/demo-site.svg'
import ARView from './components/ARView'

const PipeScene = lazy(() => import('./components/PipeScene'))
const pageNames: Record<Page, string> = {
  home: '현장 조회',
  report: '현장 신고',
  complete: '신고 접수 완료',
  login: '작업자 로그인',
  worker: '지하 배관 3D 뷰어',
  ar: '현장 AR 보기',
  qr: 'QR 마커',
  guide: '이용 안내',
  history: '나의 신고 내역',
}
const readPage = (): Page => {
  const hash = location.hash.replace('#', '')
  return Object.hasOwn(pageNames, hash) ? (hash as Page) : 'home'
}
type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <ShieldCheck size={26} strokeWidth={2} />
      </div>
      <div>
        <strong>
          현장 조회
          </strong>
      </div>
    </div>
  )
}

function SceneLoading() {
  return (
    <div className="scene-loading">
      <Box size={26} />
      <span>현장 모델을 불러오고 있습니다</span>
    </div>
  )
}
function Tag({
  children,
  tone = 'green',
}: {
  children: ReactNode
  tone?: 'green' | 'red' | 'neutral' | 'orange'
}) {
  return <span className={`tag tag-${tone}`}>{children}</span>
}
function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState<Page>(readPage)
  const [session, setSession] = useState<Session | null>(getSession)
  const [reports, setReports] = useState<Report[]>(getReports)
  const [receipt, setReceipt] = useState<Report | null>(null)
  const [toast, setToast] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [installHelp, setInstallHelp] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const locationId = new URLSearchParams(location.search).get('location') ?? LOCATION.id
  const validLocation = locationId === LOCATION.id
  const protectedRoute = route === 'worker' || route === 'ar'
  const page: Page = protectedRoute && !session ? 'login' : route

  useEffect(() => {
    const hashChange = () => {
      setRoute(readPage())
      window.scrollTo(0, 0)
    }
    const onInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPrompt)
    }
    const installed = () => {
      setInstallPrompt(null)
      setToast('홈 화면에 바로가기를 추가했습니다.')
    }
    const changeOnline = () => setOnline(navigator.onLine)
    window.addEventListener('hashchange', hashChange)
    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('appinstalled', installed)
    window.addEventListener('online', changeOnline)
    window.addEventListener('offline', changeOnline)
    return () => {
      window.removeEventListener('hashchange', hashChange)
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('appinstalled', installed)
      window.removeEventListener('online', changeOnline)
      window.removeEventListener('offline', changeOnline)
    }
  }, [])
  useEffect(() => {
    document.title = `${pageNames[page]}`
  }, [page])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 4200)
    return () => clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!installHelp) return
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInstallHelp(false)
      if (event.key !== 'Tab') return
      const dialog = document.querySelector('[aria-labelledby="install-title"]')
      const buttons = dialog?.querySelectorAll<HTMLButtonElement>('button')
      if (!buttons?.length) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeys)
    return () => document.removeEventListener('keydown', handleKeys)
  }, [installHelp])

  function go(next: Page) {
    if (location.hash === `#${next}`) setRoute(next)
    else location.hash = next
    window.scrollTo(0, 0)
  }
  async function install() {
    if (!installPrompt) {
      setInstallHelp(true)
      return
    }
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
    } catch {
      setInstallHelp(true)
    }
  }
  function logout() {
    try {
      clearSession()
    } catch {
      /* Memory session still clears. */
    }
    setSession(null)
    go('home')
    setToast('작업자 모드에서 로그아웃했습니다.')
  }

  if (page === 'ar' && validLocation && session) return <ARView onClose={() => go('worker')} />

  return (
    <div className={`app-shell ${page === 'worker' ? 'viewer-shell' : ''}`}>
      <div className="main-shell">
        <header className="app-header">
          <button className="app-brand-button" aria-label="현장 조회 홈" onClick={() => go('home')}>
            <Brand />
          </button>
          <nav className="app-nav" aria-label="메뉴">
            <button
              className={['home', 'report', 'complete'].includes(page) ? 'active' : ''}
              onClick={() => go('home')}
            >
              현장 조회
            </button>
            <button
              className={['login', 'worker'].includes(page) ? 'active' : ''}
              onClick={() => go(session ? 'worker' : 'login')}
            >
              {session ? '배관 보기' : '작업자 로그인'}
            </button>
            <button className={page === 'qr' ? 'active' : ''} onClick={() => go('qr')}>
              QR
            </button>
          </nav>
        </header>
        {!online && (
          <div className="offline-banner">
            <Info size={15} />
            오프라인 데모 모드 · 저장된 화면과 가상 데이터를 표시합니다.
          </div>
        )}
        <main className={`main-content page-${page}`}>
          {!validLocation ? (
            <EmptyState
              icon={<QrCode size={34} />}
              title="등록되지 않은 QR 마커입니다"
              description={`마커 ${locationId.slice(0, 60)}의 현장 정보를 찾을 수 없습니다. 현장의 QR을 다시 확인해 주세요.`}
            >
              <a className="button primary" href={`${import.meta.env.BASE_URL}?location=YS-001`}>
                YS-001 데모 현장 열기
                <ArrowRight size={17} />
              </a>
            </EmptyState>
          ) : (
            <>
              {page === 'home' && <HomePage go={go} />}
              {page === 'report' && (
                <ReportPage
                  onBack={() => go('home')}
                  onComplete={(report) => {
                    setReceipt(report)
                    setReports(getReports())
                    go('complete')
                  }}
                />
              )}
              {page === 'complete' && (
                <CompletePage report={receipt || reports[0] || null} go={go} />
              )}
              {page === 'login' && (
                <LoginPage
                  onSuccess={(next) => {
                    setSession(next)
                    go('worker')
                  }}
                  onBack={() => go('home')}
                />
              )}
              {page === 'worker' && session && (
                <WorkerPage session={session} go={go} logout={logout} notify={setToast} />
              )}
              {page === 'history' && (
                <HistoryPage
                  reports={reports.filter((report) => report.locationId === locationId)}
                  go={go}
                />
              )}
              {page === 'qr' && <QRPage notify={setToast} />}
              {page === 'guide' && <GuidePage go={go} install={install} />}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>가상 현장 · 시연용</span>
          <div>
            <button onClick={() => go('history')}>신고 내역</button>
            <button onClick={install}>홈 화면에 추가</button>
            <button onClick={() => go('guide')}>이용 안내</button>
          </div>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {installHelp && (
        <div className="modal-backdrop" onClick={() => setInstallHelp(false)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="설치 안내 닫기"
              onClick={() => setInstallHelp(false)}
              autoFocus
            >
              <X size={20} />
            </button>
            <div className="feature-icon">
              <Smartphone size={27} />
            </div>
            <h2 id="install-title">홈 화면에 추가</h2>
            <p>홈 화면에 이 페이지의 바로가기를 추가합니다.</p>
            <div className="install-instructions">
              <strong>iPhone · Safari</strong>
              <p>하단 공유 버튼 → 홈 화면에 추가</p>
              <strong>Android · Chrome</strong>
              <p>우측 상단 메뉴 ⋮ → 홈 화면에 추가 또는 앱 설치</p>
            </div>
            <small>
              HTTPS 배포 페이지에서 설치할 수 있습니다. 개발 서버에서는 설치 메뉴가 표시되지 않을 수
              있습니다.
            </small>
            <button className="button primary full" onClick={() => setInstallHelp(false)}>
              확인했습니다
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

function ArrowUpRightIcon() {
  return <ArrowRight size={15} style={{ transform: 'rotate(-35deg)' }} />
}

function PageHeading({
  title,
  description,
  aside,
}: {
  title: string
  description: string
  aside?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {aside}
    </div>
  )
}

function HomePage({ go }: { go: (page: Page) => void }) {
  const [checkedAt, setCheckedAt] = useState(() => new Date())
  const [refreshing, setRefreshing] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    },
    [],
  )
  function refresh() {
    setRefreshing(true)
    refreshTimer.current = setTimeout(() => {
      setCheckedAt(new Date())
      setRefreshing(false)
    }, 550)
  }
  return (
    <>
      <PageHeading
        title="굴착공사 조회"
        description="QR YS-001 · 여수산단 A-12 구역의 공사 등록 상태"
      />
      <div className="location-strip">
        <div className="location-pin">
          <MapPin size={23} />
        </div>
        <div className="location-strip-text">
          <strong>{LOCATION.name}</strong>
          <span>{LOCATION.address}</span>
        </div>
        <div className="marker-chip">
          <QrCode size={17} />
          <span>QR 마커</span>
          <strong>{LOCATION.id}</strong>
        </div>
      </div>
      <div className="home-grid">
        <section className="status-card">
          <div className="card-section-top">
            <span className="section-label">굴착공사 신고 상태</span>
            <Tag tone="red">
              <i />
              확인 필요
            </Tag>
          </div>
          <div className="warning-emblem">
            <TriangleAlert size={32} strokeWidth={1.9} />
          </div>
          <h2>
            현재 굴착공사
            <br />
            신고 내역 확인 불가
          </h2>
          <p className="status-description">
            데모에 등록된 굴착공사 <strong>0건</strong>
            <br />
            작업이 진행 중이면 사진과 작업 내용을 입력하세요.
          </p>
          <div className="status-warning">
            <Info size={16} />
            <span>시연용 데이터입니다. 실제 공사 등록 여부는 조회하지 않습니다.</span>
          </div>
          <button className="button danger full report-cta" onClick={() => go('report')}>
            <FileWarning size={19} />
            미신고 굴착 신고하기
            <ArrowRight size={19} />
          </button>
          <div className="checked-at">
            <span>
              <Clock3 size={13} />
              {checkedAt.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}{' '}
              기준 · 데모 데이터
            </span>
            <button onClick={refresh} disabled={refreshing} aria-label="신고 상태 새로고침">
              <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
              {refreshing ? '확인 중' : '새로고침'}
            </button>
          </div>
        </section>
        <section className="site-card">
          <div className="site-card-heading">
            <div>
              <span className="section-label">현재 연결된 현장</span>
              <h2>
                여수산단 <span>A-12</span>
              </h2>
            </div>
          </div>
          <div className="home-scene">
            <Suspense fallback={<SceneLoading />}>
              <PipeScene
                mode="surface"
                compact
                showPipes={false}
                showZones={false}
                showLabels={false}
              />
            </Suspense>
            <div className="scene-location">
              <div className="scene-location-pin">
                <MapPin size={18} fill="currentColor" />
              </div>
              <span>
                YS-001 <small>현재 마커</small>
              </span>
            </div>
            <div className="scene-compass">
              <Navigation size={19} />
              <span>N</span>
            </div>
            <div className="scene-map-scale">
              <span />
              20 m
            </div>
          </div>
          <div className="site-card-bottom">
            <span>
              <LocateFixed size={15} />
              QR 마커로 연결된 가상 현장
            </span>
            <Tag tone="neutral">3D 미리보기</Tag>
          </div>
        </section>
      </div>
      <div className="caution-banner">
        <div className="caution-icon">
          <ShieldEllipsis size={24} />
        </div>
        <div>
          <strong>가스배관 매설 주의구역</strong>
          <p>
            주배관 GP-001 · 깊이 1.2m · 직경 300mm. 작업자 로그인 후 배관을 확인합니다.
          </p>
        </div>
        <span className="caution-pill">가상 배관 정보</span>
      </div>
      <div className="home-actions">
        <button className="button primary" onClick={() => go('login')}>
          <HardHat size={18} />
          작업자 로그인
          <ArrowRight size={17} />
        </button>
        <button className="button secondary" onClick={() => go('history')}>
          <ClipboardCheck size={17} />
          신고 내역 보기
        </button>
      </div>
    </>
  )
}

function ReportPage({
  onBack,
  onComplete,
}: {
  onBack: () => void
  onComplete: (report: Report) => void
}) {
  const [reason, setReason] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const photoRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(
    () => () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current)
    },
    [],
  )
  function clearPhoto() {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current)
    photoRef.current = null
    setPhoto(null)
    setPhotoName('')
    if (inputRef.current) inputRef.current.value = ''
  }
  function selectPhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('JPG, PNG, WEBP 또는 GIF 이미지를 선택해 주세요.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('사진은 10MB 이하로 첨부해 주세요.')
      return
    }
    clearPhoto()
    const url = URL.createObjectURL(file)
    photoRef.current = url
    setPhoto(url)
    setPhotoName(file.name)
    setError('')
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (submittingRef.current) return
    if (reason.trim().length < 5) {
      setError('신고 사유를 5자 이상 입력해 주세요.')
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    const report: Report = {
      id: makeReportId(),
      locationId: LOCATION.id,
      locationName: LOCATION.name,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
      hasPhoto: !!photo,
    }
    try {
      saveReport(report)
      onComplete(report)
    } catch {
      setError(
        '이 브라우저에 신고를 저장할 수 없습니다. 브라우저의 저장 공간 설정을 확인해 주세요.',
      )
      submittingRef.current = false
      setSubmitting(false)
    }
  }
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={17} />
        현장 안전 확인
      </button>
      <PageHeading
        title="현장 신고"
        description="위치는 QR로 자동 입력됩니다. 작업 내용은 필수, 사진은 선택입니다."
      />
      <div className="form-layout">
        <form className="form-card" onSubmit={submit}>
          <div className="form-section-title">
            <span>01</span>
            <h2>신고 위치 확인</h2>
            <Tag>
              <Check size={12} />
              자동 입력
            </Tag>
          </div>
          <label className="field-label" htmlFor="report-location">
            현재 위치
          </label>
          <div className="input-icon-wrap">
            <MapPin size={18} />
            <input id="report-location" value={LOCATION.name} readOnly />
          </div>
          <div className="field-hint">
            QR 마커 {LOCATION.id} 기준 · {LOCATION.address}
          </div>
          <div className="form-divider" />
          <div className="form-section-title">
            <span>02</span>
            <h2>사진 및 작업 내용</h2>
          </div>
          <div className="label-row">
            <label className="field-label" htmlFor="report-photo">
              현장 사진 <span className="optional">선택</span>
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                clearPhoto()
                setPhoto(demoSite)
                setPhotoName('시연용 현장 예시 이미지')
                setError('')
              }}
            >
              데모 사진 사용
            </button>
          </div>
          <input
            ref={inputRef}
            className="visually-hidden"
            id="report-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => selectPhoto(event.target.files?.[0])}
          />
          {photo ? (
            <div className="photo-preview">
              <img
                src={photo}
                alt="첨부한 현장 이미지 미리보기"
                onError={() => {
                  clearPhoto()
                  setError('이미지를 읽을 수 없습니다. 다른 사진을 선택해 주세요.')
                }}
              />
              <button
                type="button"
                className="photo-remove"
                onClick={clearPhoto}
                aria-label="첨부 사진 삭제"
              >
                <X size={17} />
              </button>
              <span>
                <Camera size={14} />
                {photoName}
              </span>
            </div>
          ) : (
            <label className="upload-area" htmlFor="report-photo">
              <span className="upload-icon">
                <Camera size={25} />
              </span>
              <strong>현장 사진을 첨부해 주세요</strong>
              <span>눌러서 사진 촬영 또는 앨범에서 선택</span>
              <small>JPG, PNG, WEBP, GIF · 최대 10MB</small>
            </label>
          )}
          <div className="label-row reason-label">
            <label className="field-label" htmlFor="report-reason">
              신고 사유 <span className="required">*</span>
            </label>
            <span className="character-count">{reason.length}/500</span>
          </div>
          <textarea
            id="report-reason"
            placeholder="예: 도로에서 굴착기가 작업 중인데 공사 안내 표지판이 보이지 않습니다."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            minLength={5}
            required
            rows={5}
          />
          <div className="suggested-reasons">
            {['굴착 작업 중, 공사 안내 없음', '가스배관 주변 무단 굴착 의심'].map((text) => (
              <button key={text} type="button" onClick={() => setReason(text)}>
                <Plus size={12} />
                {text}
              </button>
            ))}
          </div>
          {error && (
            <p className="form-error" role="alert">
              <TriangleAlert size={16} />
              {error}
            </p>
          )}
          <div className="report-demo-note">
            <Info size={16} />
            <p>
              공모전 시연용 신고입니다. 이 브라우저에 접수 내역만 저장되며, 사진은 전송·저장되지
              않습니다.
            </p>
          </div>
          <button type="submit" className="button primary full" disabled={submitting}>
            <Upload size={18} />
            {submitting ? '신고를 접수하고 있습니다…' : '신고 접수'}
            <ArrowRight size={18} />
          </button>
        </form>

      </div>
    </>
  )
}

function CompletePage({ report, go }: { report: Report | null; go: (page: Page) => void }) {
  if (!report)
    return (
      <EmptyState
        icon={<ClipboardCheck size={34} />}
        title="아직 접수된 신고가 없습니다"
        description="현장 상황을 알려주시면 이곳에서 접수 내용을 확인할 수 있습니다."
      >
        <button className="button primary" onClick={() => go('report')}>
          현장 신고하기
          <ArrowRight size={17} />
        </button>
      </EmptyState>
    )
  return (
    <div className="completion-wrapper">
      <div className="completion-icon">
        <Check size={42} strokeWidth={2.3} />
      </div>
      <Tag>현장 신고 · 데모 접수 완료</Tag>
      <h1>신고가 접수되었습니다</h1>
      <p className="completion-subtitle">
        접수 번호와 신고 내용을 확인하세요.
        <br />
        신고 내역은 이 브라우저에 저장됩니다.
      </p>
      <div className="receipt-card">
        <div className="receipt-heading">
          <span>신고 접수증</span>
          <CheckCircle2 size={21} />
        </div>
        <dl>
          <div>
            <dt>접수 번호</dt>
            <dd className="mono">{report.id}</dd>
          </div>
          <div>
            <dt>신고 위치</dt>
            <dd>{report.locationName}</dd>
          </div>
          <div>
            <dt>접수 시각</dt>
            <dd>{new Date(report.createdAt).toLocaleString('ko-KR')}</dd>
          </div>
          <div>
            <dt>사진 첨부</dt>
            <dd>{report.hasPhoto ? '이미지 확인 완료 · 파일 미보관' : '첨부 없음'}</dd>
          </div>
        </dl>
        <div className="receipt-reason">
          <span>신고 내용</span>
          <p>{report.reason}</p>
        </div>
        <div className="receipt-demo">
          <Info size={15} />
          실제 기관에 전송되지 않은 브라우저 내 데모 접수입니다.
        </div>
      </div>
      <div className="completion-actions">
        <button className="button secondary" onClick={() => go('history')}>
          나의 신고 내역
        </button>
        <button className="button primary" onClick={() => go('home')}>
          현장으로 돌아가기
          <ArrowRight size={17} />
        </button>
      </div>
      <button className="completion-worker text-button" onClick={() => go('login')}>
        <HardHat size={17} />
        이어서 작업자 3D·AR 시연하기
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

function LoginPage({
  onSuccess,
  onBack,
}: {
  onSuccess: (session: Session) => void
  onBack: () => void
}) {
  const [permit, setPermit] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  function login(event: FormEvent) {
    event.preventDefault()
    if (
      permit.trim().toUpperCase() !== LOCATION.permit ||
      password !== LOCATION.password ||
      !name.trim()
    ) {
      setError('허가번호 또는 비밀번호를 확인해 주세요. 아래 데모 계정으로 시연할 수 있습니다.')
      return
    }
    const session: Session = { name: name.trim(), permit: LOCATION.permit, locationId: LOCATION.id }
    try {
      saveSession(session)
      onSuccess(session)
    } catch {
      setError('인증 정보를 저장할 수 없습니다. 브라우저의 세션 저장 설정을 확인해 주세요.')
    }
  }
  return (
    <>
      <div className="login-layout">
        <form className="login-card" onSubmit={login}>
          <div className="login-lock">
            <LockKeyhole size={25} />
          </div>
          <h2>작업자 로그인</h2>
          <p>허가된 작업자만 배관 정보를 조회할 수 있습니다.</p>
          <div className="login-location">
            <MapPin size={16} />
            {LOCATION.name}
            <span>{LOCATION.id}</span>
          </div>
          <label className="field-label" htmlFor="permit">
            굴착공사 허가번호
          </label>
          <input
            id="permit"
            value={permit}
            onChange={(event) => setPermit(event.target.value)}
            autoCapitalize="characters"
            placeholder="예: YS-2026-001"
            autoComplete="username"
            required
            maxLength={50}
          />
          <label className="field-label" htmlFor="worker-name">
            대표자명 또는 작업자명
          </label>
          <input
            id="worker-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="성함을 입력해 주세요"
            autoComplete="name"
            required
            maxLength={30}
          />
          <label className="field-label" htmlFor="password">
            데모 비밀번호
          </label>
          <div className="password-field">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호 4자리"
              autoComplete="current-password"
              required
              maxLength={30}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              <TriangleAlert size={16} />
              {error}
            </p>
          )}
          <button type="submit" className="button primary full login-submit">
            작업자 인증 후 입장
            <ArrowRight size={18} />
          </button>
          <div className="demo-credentials">
            <div>
              <span>
                <Info size={15} />
                발표용 데모 계정
              </span>
              <button
                type="button"
                onClick={() => {
                  setPermit(LOCATION.permit)
                  setName('김안전')
                  setPassword(LOCATION.password)
                  setError('')
                }}
              >
                데모 계정 입력
                <ArrowDownToLine size={13} />
              </button>
            </div>
            <p>
              허가번호 <strong>{LOCATION.permit}</strong>{' '}
              <span>
                비밀번호 <strong>1234</strong>
              </span>
            </p>
          </div>
          <p className="login-disclaimer">
            <LockKeyhole size={12} />
            시연용 인증입니다. 실제 허가 내역과 연결되지 않습니다.
          </p>
        </form>
      </div>
    </>
  )
}

function WorkerPage({
  session,
  go,
  logout,
  notify,
}: {
  session: Session
  go: (page: Page) => void
  logout: () => void
  notify: (text: string) => void
}) {
  const [zones, setZones] = useState(true)
  const [labels, setLabels] = useState(true)
  const [pipes, setPipes] = useState(true)
  const [opacity, setOpacity] = useState(0.16)
  const [view, setView] = useState<'perspective' | 'top'>('perspective')
  const [reset, setReset] = useState(0)
  const [selected, setSelected] = useState('GP-001')
  const facility = FACILITIES[selected] ?? FACILITIES['GP-001']
  const stageRef = useRef<HTMLDivElement>(null)
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (stageRef.current?.requestFullscreen) await stageRef.current.requestFullscreen()
      else
        notify('이 브라우저에서는 전체화면이 지원되지 않습니다. AR 보기로 확장해서 볼 수 있습니다.')
    } catch {
      notify('현재 브라우저에서 전체화면을 열 수 없습니다.')
    }
  }
  return (
    <>
      <PageHeading
        title="지하 배관 3D 뷰어"
        description="보이지 않는 지하 배관을 살펴보고, 안전한 작업 범위를 확인하세요."
        aside={
          <div className="worker-auth">
            <Tag>
              <ShieldCheck size={13} />
              작업자 인증됨
            </Tag>
            <button className="icon-button" onClick={logout} aria-label="작업자 로그아웃">
              <LogOut size={17} />
            </button>
          </div>
        }
      />
      <div className="viewer-location">
        <span>
          <MapPin size={17} />
          <strong>{LOCATION.name}</strong>
          <Tag tone="neutral">{LOCATION.id}</Tag>
        </span>
        <small>
          {session.name} · {session.permit}
        </small>
      </div>
      <div className="viewer-grid">
        <section className="viewer-stage" ref={stageRef}>
          <div className="viewer-toolbar">
            <div className="view-toggle">
              <button
                className={view === 'perspective' ? 'active' : ''}
                onClick={() => setView('perspective')}
                aria-pressed={view === 'perspective'}
              >
                <Box size={16} />
                3D 뷰
              </button>
              <button
                className={view === 'top' ? 'active' : ''}
                onClick={() => setView('top')}
                aria-pressed={view === 'top'}
              >
                <Layers3 size={16} />
                평면 뷰
              </button>
            </div>
            <button className="ar-view-button" onClick={() => go('ar')}>
              <ScanLine size={17} />
              AR 보기
              <ArrowUpRightIcon />
            </button>
          </div>
          <div className="worker-scene">
            <Suspense fallback={<SceneLoading />}>
              <PipeScene
                mode="underground"
                showPipes={pipes}
                showZones={zones}
                showLabels={labels && pipes}
                surfaceOpacity={opacity}
                view={view}
                resetKey={reset}
                onSelectPipe={setSelected}
              />
            </Suspense>
          </div>
          <div className="viewer-floating-controls">
            <button
              className="icon-button"
              onClick={() => {
                setView('perspective')
                setReset((value) => value + 1)
              }}
              aria-label="3D 시점 초기화"
              title="시점 초기화"
            >
              <Crosshair size={19} />
            </button>
            <button
              className="icon-button"
              onClick={fullscreen}
              aria-label="3D 전체화면"
              title="전체화면"
            >
              <Maximize size={18} />
            </button>
          </div>
          <div className="viewer-legend">
            <span>
              <i className="pipe-dot" />
              가스배관
            </span>
            <span>
              <i className="danger-dot" />
              굴착 주의 영역
            </span>
            <span>
              <i className="surface-dot" />
              지표면
            </span>
          </div>
          <div className="viewer-gesture">
            <span>드래그 회전</span>
            <i />두 손가락 이동·확대<span className="desktop-gesture"> · 휠 확대/축소</span>
          </div>
          <span className="viewer-demo-mark">가상 현장 모델 · 실측 데이터 아님</span>
        </section>
        <aside className="viewer-panel">
          <div className="panel-heading">
            <h2>배관 상세 정보</h2>
            <select
              className="facility-select"
              aria-label="시설 선택"
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value)
                setPipes(true)
              }}
            >
              {Object.entries(FACILITIES).map(([id, item]) => (
                <option key={id} value={id}>
                  {item.kind}
                </option>
              ))}
            </select>
          </div>
          <button
            className="selected-pipe"
            onClick={() => {
              setPipes(true)
              setLabels(true)
              setReset((value) => value + 1)
            }}
          >
            <span className="selected-pipe-icon">
              <Layers3 size={22} />
            </span>
            <span>
              <strong>{selected}</strong>
              <small>{facility.name}</small>
            </span>
            <Crosshair size={16} />
          </button>
          <div className="pipe-measurements">
            <div>
              <span>배관 깊이</span>
              <strong>
                1.2 <small>m</small>
              </strong>
              <p>지표면 기준 중심 깊이</p>
            </div>
            <div>
              <span>배관 직경</span>
              <strong>
                {facility.diameter} <small>mm</small>
              </strong>
              <p>{selected === 'V-001' ? '연결 분기관 외경' : '배관 외경'}</p>
            </div>
          </div>
          <dl className="pipe-details">
            <div>
              <dt>배관 재질</dt>
              <dd>탄소강관 (Steel)</dd>
            </div>
            <div>
              <dt>시설 구분</dt>
              <dd>{facility.kind}</dd>
            </div>
            <div>
              <dt>운영 상태</dt>
              <dd>
                <Tag>
                  <i />
                  정상 · 가상 데이터
                </Tag>
              </dd>
            </div>
          </dl>
          <div className="layer-controls">
            <h3>
              <Layers3 size={17} />
              표시 레이어
            </h3>
            <LayerToggle label="가스배관" on={pipes} change={setPipes} color="yellow" />
            <LayerToggle label="굴착 주의 영역" on={zones} change={setZones} color="orange" />
            <LayerToggle label="배관 정보 라벨" on={labels} change={setLabels} color="green" />
            <div className="opacity-label">
              <label htmlFor="surface-opacity">지표면 불투명도</label>
              <span>{Math.round(opacity * 100)}%</span>
            </div>
            <input
              id="surface-opacity"
              type="range"
              min="0.05"
              max="0.85"
              step="0.01"
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
              aria-valuetext={`${Math.round(opacity * 100)}%`}
            />
            <div className="range-captions">
              <span>지하가 선명하게</span>
              <span>지표면이 선명하게</span>
            </div>
          </div>
          <div className="viewer-safety">
            <TriangleAlert size={18} />
            <div>
              <strong>굴착 주의 영역</strong>
              <p>
                배관 주변 표시 영역 내 굴착에 주의하세요. 경계는 시연용이며 실제 안전거리를 뜻하지
                않습니다.
              </p>
            </div>
          </div>
        </aside>
      </div>
      <div className="viewer-bottom-note">
        <Info size={16} />
        <span>
          이 3D 모델은 공모전 시연용입니다. 실제 굴착 판단에는 현장 실측과 관계 기관의 확인이
          필요합니다.
        </span>
      </div>
    </>
  )
}

function LayerToggle({
  label,
  on,
  change,
  color,
}: {
  label: string
  on: boolean
  change: (value: boolean) => void
  color: string
}) {
  return (
    <div className="layer-row">
      <span>
        <i className={`layer-dot ${color}`} />
        {label}
      </span>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`switch ${on ? 'on' : ''}`}
        onClick={() => change(!on)}
      >
        <span />
      </button>
    </div>
  )
}

function HistoryPage({ reports, go }: { reports: Report[]; go: (page: Page) => void }) {
  return (
    <>
      <PageHeading
        title="나의 신고 내역"
        description="이 브라우저에 저장된 접수 번호, 시각, 신고 내용입니다."
        aside={
          <button className="button primary" onClick={() => go('report')}>
            <Plus size={17} />새 신고 작성
          </button>
        }
      />
      {reports.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={35} />}
          title="아직 신고 내역이 없습니다"
          description="미신고 굴착이 의심되면 현장 상황을 알려주세요."
        >
          <button className="button primary" onClick={() => go('report')}>
            현장 신고하기
            <ArrowRight size={17} />
          </button>
        </EmptyState>
      ) : (
        <>
          <div className="history-summary">
            <span>
              전체 신고 <strong>{reports.length}</strong>건
            </span>
            <small>실제 기관 전송 없이 기기에 저장된 데모 내역</small>
          </div>
          <div className="history-list">
            {reports.map((report) => (
              <article className="history-card" key={report.id}>
                <div className="history-icon">
                  <FileCheck2 size={24} />
                </div>
                <div className="history-content">
                  <div className="history-title">
                    <h2>{report.locationName || LOCATION.name}</h2>
                    <Tag>데모 접수 완료</Tag>
                  </div>
                  <p>{report.reason}</p>
                  <div className="history-meta">
                    <span className="mono">{report.id}</span>
                    <span>{new Date(report.createdAt).toLocaleString('ko-KR')}</span>
                    {report.hasPhoto && (
                      <span>
                        <Camera size={13} />
                        이미지 확인
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function QRPage({ notify }: { notify: (text: string) => void }) {
  const initial = new URL(location.href)
  initial.search = ''
  initial.hash = ''
  const [baseUrl, setBaseUrl] = useState(initial.href)
  const [target, setTarget] = useState(() => {
    initial.searchParams.set('location', LOCATION.id)
    return initial.href
  })
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setQr('')
    QRCode.toDataURL(target, {
      width: 640,
      margin: 3,
      color: { dark: '#172c2a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((data) => {
        if (active) setQr(data)
      })
      .catch(() => {
        if (active) setError('QR 이미지를 만들 수 없습니다. 주소 길이를 확인해 주세요.')
      })
    return () => {
      active = false
    }
  }, [target])
  function generate(event: FormEvent) {
    event.preventDefault()
    try {
      const url = new URL(baseUrl.trim())
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
        throw new Error()
      if (!url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += '/'
      url.hash = ''
      url.searchParams.set('location', LOCATION.id)
      setTarget(url.href)
      setError('')
      notify('현재 주소로 QR 마커를 생성했습니다.')
    } catch {
      setError('로그인 정보가 포함되지 않은 http:// 또는 https:// 웹 주소를 입력해 주세요.')
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(target)
      notify('QR 연결 주소를 복사했습니다.')
    } catch {
      setError('주소를 길게 누르거나 선택하여 직접 복사해 주세요.')
    }
  }
  const localUrl = /^(localhost|127\..*|\[::1\]|0\.0\.0\.0)$/.test(new URL(target).hostname)
  return (
    <>
      <PageHeading
        title="현장 접속 QR"
        description="스캔하면 여수산단 A-12 구역의 공사 조회 화면이 열립니다."
      />
      <div className="qr-layout">
        <section className="qr-print-card">
          <Brand />
          <div className="qr-card-title">
            <span>현장 ID · YS-001</span>
            <h2>가스배관 매설 주의구역</h2>
          </div>
          <div className="qr-image">
            {qr ? (
              <img src={qr} alt={`여수산단 YS-001 현장 접속 QR 코드: ${target}`} />
            ) : (
              <QrCode size={150} />
            )}
          </div>
          <div className="qr-marker-id">
            QR ID <strong>YS-001</strong>
          </div>
          <h3>{LOCATION.name}</h3>
          <div className="qr-card-instruction">
            <ScanLine size={17} />
            QR 스캔 → 공사 조회 · 현장 신고
          </div>
          <small>가스안전 공모전 데모 · 가상 현장 정보</small>
        </section>
        <section className="qr-config">
          <div className="feature-icon">
            <QrCode size={28} />
          </div>
          <h2>QR 만들기</h2>
          <p>웹페이지 주소를 입력하면 현장 YS-001에 연결되는 QR을 만듭니다.</p>
          <form onSubmit={generate}>
            <label className="field-label" htmlFor="deploy-url">
              웹페이지 주소
            </label>
            <input
              type="url"
              id="deploy-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://your-project.vercel.app/"
              required
            />
            <button className="button primary full" type="submit">
              <RefreshCw size={17} />이 주소로 QR 생성
            </button>
          </form>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="qr-target">
            <span>QR 연결 주소</span>
            <code>{target}</code>
            <button onClick={copy} aria-label="QR 주소 복사">
              <Copy size={17} />
            </button>
          </div>
          {localUrl && (
            <div className="inline-note">
              <Info size={17} />
              <p>
                현재 QR은 이 컴퓨터용 주소입니다. 스마트폰에서는 배포한 HTTPS 주소 또는 같은 Wi-Fi의
                PC IP 주소를 입력해 주세요.
              </p>
            </div>
          )}
          <a
            className={`button secondary full ${!qr ? 'disabled' : ''}`}
            href={qr || undefined}
            download={`QR-${LOCATION.id}.png`}
          >
            <Download size={17} />
            QR 이미지 다운로드
          </a>
        </section>
      </div>
    </>
  )
}

function GuidePage({ go, install }: { go: (page: Page) => void; install: () => void }) {
  return (
    <>
      <PageHeading
        title="이용 순서"
        description="QR 스캔 → 공사 조회 → 현장 신고 또는 배관 보기"
      />
      <div className="guide-timeline">
        {[
          {
            time: '00:00',
            icon: <QrCode />,
            title: 'QR로 현장 연결',
            text: '스마트폰 카메라로 YS-001 QR을 스캔하면 여수산단 A-12 구역이 열립니다.',
            action: 'QR 마커 보기',
            page: 'qr',
          },
          {
            time: '00:20',
            icon: <TriangleAlert />,
            title: '굴착공사 신고 상태 확인',
            text: '신고된 굴착공사가 없는 가상 현장입니다. 경고 카드와 위치를 확인합니다.',
            action: '현장 확인하기',
            page: 'home',
          },
          {
            time: '00:40',
            icon: <Camera />,
            title: '현장 신고',
            text: '현장 사진을 첨부하거나 데모 사진을 선택하고, 신고 사유를 작성해 접수합니다.',
            action: '현장 신고하기',
            page: 'report',
          },
          {
            time: '01:20',
            icon: <HardHat />,
            title: '작업자 인증',
            text: '데모 계정 입력을 누른 뒤 인증합니다. 허가번호 YS-2026-001, 비밀번호 1234입니다.',
            action: '작업자 로그인',
            page: 'login',
          },
          {
            time: '01:40',
            icon: <Box />,
            title: '3D 배관과 AR 현장 확인',
            text: '3D 모델을 회전하고 깊이 1.2m·직경 300mm를 확인합니다. 레이어와 AR 보기를 시연하세요.',
            action: '배관 뷰어 열기',
            page: 'worker',
          },
        ].map((step, index) => (
          <div className="guide-step" key={step.time}>
            <span className="guide-time">{step.time}</span>
            <div className="guide-step-icon">{step.icon}</div>
            <div>
              <span className="guide-number">{index + 1}</span>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </div>
            <button className="text-button" onClick={() => go(step.page as Page)}>
              {step.action}
              <ChevronRight size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="guide-install">
        <Smartphone size={27} />
        <div>
          <h2>홈 화면에 추가</h2>
          <p>홈 화면 아이콘으로 이 페이지를 바로 엽니다.</p>
        </div>
        <button className="button secondary" onClick={install}>
          설치 안내
          <ArrowRight size={17} />
        </button>
      </div>
      <div className="inline-note">
        <Info size={18} />
        <p>
          모든 현장·허가·배관 정보는 가상 데이터입니다. 신고는 이 브라우저에만 저장되고 사진은
          보관되지 않습니다. AR은 실제 위치 추적을 수행하지 않는 시뮬레이션입니다.
        </p>
      </div>
    </>
  )
}
