import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FilePenLine,
  Layers3,
  LogOut,
  Maximize,
  Map,
  MapPin,
  Printer,
  QrCode,
  RotateCcw,
  ScanLine,
  ShieldCheck,
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
import ARView from './components/ARView'
import { MODEL_SOURCES } from './sources'
import { PIPE_ROUTES } from './network'

const PipeScene = lazy(() => import('./components/PipeScene'))
const EOCS_URL = 'https://app.eocs.or.kr/'
const pages: Page[] = ['home', 'worker', 'login', 'report', 'complete', 'ar', 'qr']
const readPage = (): Page => {
  const p = location.hash.slice(1) as Page
  return pages.includes(p) ? p : 'home'
}
const Loading = () => (
  <div className="model-loading">
    <Box size={26} />
    <span>배관 불러오는 중</span>
  </div>
)
function Sources() {
  return (
    <details className="source-disclosure">
      <summary>
        자료 출처 <ChevronDown size={13} />
      </summary>
      <p>
        여수산단 공개자료의 관종과 구조를 재구성했습니다. 관로 좌표·관경·심도는 개별 사업자의 실측
        도면과 연결되지 않았습니다. ‘미신고 지역’은 화면에 설정된 구간 상태이며, 기관의 실시간
        공사 신고 내역과 연결되어 있지 않습니다.
      </p>
      {MODEL_SOURCES.map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
          {s.title}
          <span>{s.fact}</span>
        </a>
      ))}
    </details>
  )
}
export default function App() {
  const [route, setRoute] = useState<Page>(readPage),
    [session, setSession] = useState<Session | null>(getSession),
    [receipt, setReceipt] = useState<Report | null>(null),
    [toast, setToast] = useState('')
  const locationId = new URLSearchParams(location.search).get('location') ?? LOCATION.id
  const page = (route === 'worker' || route === 'ar') && !session ? 'login' : route
  const valid = locationId === LOCATION.id
  useEffect(() => {
    const change = () => {
      setRoute(readPage())
      window.scrollTo(0, 0)
    }
    const suppress = (e: Event) => e.preventDefault()
    window.addEventListener('hashchange', change)
    window.addEventListener('beforeinstallprompt', suppress)
    return () => {
      window.removeEventListener('hashchange', change)
      window.removeEventListener('beforeinstallprompt', suppress)
    }
  }, [])
  useEffect(() => {
    document.title = '굴착 현장 안전정보 · 여수산단 YS-001'
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])
  function go(next: Page) {
    location.hash = next
    setRoute(next)
    window.scrollTo(0, 0)
  }
  function logout() {
    clearSession()
    setSession(null)
    go('home')
  }
  if (valid && page === 'ar' && session) return <ARView onClose={() => go('worker')} />
  return (
    <div className="field-app">
      <header className="field-header">
        <button className="field-brand" onClick={() => go('home')} aria-label="현장 처음으로">
          <span>
            <Layers3 size={21} />
          </span>
          <strong>현장 조회</strong>
          <small>여수산단</small>
        </button>
        <nav aria-label="메뉴">
          <button className={page === 'home' ? 'is-active' : ''} onClick={() => go('home')}>
            현장
          </button>
          <button
            className={page === 'worker' || page === 'login' ? 'is-active' : ''}
            onClick={() => go('worker')}
          >
            3D 배관
          </button>
          <button className={page === 'report' ? 'is-active' : ''} onClick={() => go('report')}>
            시민 신고
          </button>
          <button
            className={page === 'qr' ? 'is-active' : ''}
            onClick={() => go('qr')}
            aria-label="QR"
          >
            <QrCode size={18} />
          </button>
        </nav>
      </header>
      <main className={`field-main field-main--${page}`}>
        {!valid ? (
          <section className="compact-card">
            <QrCode size={30} />
            <h1>등록되지 않은 QR입니다</h1>
            <p>{locationId.slice(0, 60)}</p>
            <a className="action primary" href={`${import.meta.env.BASE_URL}?location=YS-001`}>
              YS-001 열기
            </a>
          </section>
        ) : (
          <>
            {page === 'home' && <Home go={go} />}
            {page === 'worker' && session && (
              <Workbench session={session} go={go} logout={logout} notify={setToast} />
            )}
            {page === 'login' && (
              <Login
                onBack={() => go('home')}
                onSuccess={(s) => {
                  setSession(s)
                  go(route === 'ar' ? 'ar' : 'worker')
                }}
              />
            )}
            {page === 'report' && (
              <ReportForm
                onBack={() => go('home')}
                onComplete={(r) => {
                  setReceipt(r)
                  go('complete')
                }}
              />
            )}
            {page === 'complete' && <Receipt report={receipt || getReports()[0] || null} go={go} />}
            {page === 'qr' && <QRPanel notify={setToast} />}
          </>
        )}
      </main>
      {toast && (
        <div className="field-toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  )
}
function Home({ go }: { go: (p: Page) => void }) {
  return (
    <>
      <section className="citizen-home" aria-labelledby="site-lookup-title">
        <div className="citizen-title">
          <span className="eyebrow">현장 공사 조회 · 여수산단</span>
          <h1 id="site-lookup-title">미신고 지역</h1>
          <p>굴착 작업이 보이면 현장 정보를 알려주세요.</p>
        </div>
        <div className="location-card">
          <div>
            <span>조회 구간</span>
            <strong>{LOCATION.id}</strong>
          </div>
          <span className="location-name"><MapPin size={17} /> 여수산단</span>
        </div>
        <div className="excavation-entry">
          <p className="excavation-instruction">현장에서 공사 정보를 확인하세요.</p>
          <a className="excavation-circle" href={EOCS_URL} target="_blank" rel="noreferrer" aria-label="굴착현장 확인">
            <MapPin size={30} />
            <strong>굴착현장 확인</strong>
            <span>EOCS 열기 <ExternalLink size={13} /></span>
          </a>
          <p className="eocs-note">작업 시작 신고는 기존 EOCS에서 진행합니다.</p>
        </div>
        <div className="service-shortcuts" aria-label="현장 서비스">
          <button onClick={() => go('report')}>
            <span><FilePenLine size={24} /></span>
            <strong>시민 신고</strong>
            <small>현장 내용 남기기</small>
          </button>
          <button onClick={() => go('worker')}>
            <span><Box size={24} /></span>
            <strong>3D 배관</strong>
            <small>배관·단면 열람</small>
          </button>
          <button onClick={() => go('ar')}>
            <span><ScanLine size={24} /></span>
            <strong>바닥 AR</strong>
            <small>내 공간에 배치</small>
          </button>
        </div>
        <section className="site-information" aria-labelledby="site-information-title">
          <h2 id="site-information-title">굴착 현장 안전정보</h2>
          <a href={EOCS_URL} target="_blank" rel="noreferrer">
            <span className="information-icon"><ShieldCheck size={22} /></span>
            <span><strong>현장 안전정보</strong><small>안전 안내·매설물 관리기관을 EOCS에서 확인</small></span>
            <ExternalLink size={16} />
          </a>
          <a href={EOCS_URL} target="_blank" rel="noreferrer">
            <span className="information-icon"><Map size={22} /></span>
            <span><strong>인근 굴착지도</strong><small>EOCS에서 주변 굴착공사 확인</small></span>
            <ExternalLink size={16} />
          </a>
          <button onClick={() => go('worker')}>
            <span className="information-icon"><Layers3 size={22} /></span>
            <span><strong>지하매설물 현황</strong><small>YS-001 구간의 배관 배치·단면 보기</small></span>
            <ArrowRight size={17} />
          </button>
        </section>
      </section>
      <div className="entry-grid citizen-worker">
        <section className="entry-scene" aria-label="도로 하부 배관 개요">
          <Suspense fallback={<Loading />}>
            <PipeScene
              mode="underground"
              showLabels={false}
              showZones={false}
              surfaceOpacity={0.08}
            />
          </Suspense>
          <div className="scene-caption">산업배관 · 공업용수 · 하수 · 전력·통신</div>
        </section>
        <aside className="entry-actions">
          <div>
            <span className="eyebrow">YS-001 · 지하매설물</span>
            <h2>도로 아래 배관 확인</h2>
            <p>3D 배치와 도로 단면, 교차부 정보를 확인합니다.</p>
            <button className="action secondary" onClick={() => go('worker')}>
              <Box size={18} />
              3D 배관 열기
              <ArrowRight size={18} />
            </button>
          </div>
        </aside>
      </div>
      <Sources />
    </>
  )
}
type View = 'perspective' | 'top' | 'section' | 'crossing'
function Workbench({
  session,
  go,
  logout,
  notify,
}: {
  session: Session
  go: (p: Page) => void
  logout: () => void
  notify: (t: string) => void
}) {
  const [view, setView] = useState<View>('perspective'),
    [selected, setSelected] = useState('GP-001'),
    [gas, setGas] = useState(true),
    [utilities, setUtilities] = useState(true),
    [structures, setStructures] = useState(true),
    [context, setContext] = useState(true),
    [labels, setLabels] = useState(true),
    [exploded, setExploded] = useState(false),
    [opacity, setOpacity] = useState(0.08),
    [reset, setReset] = useState(0),
    [filter, setFilter] = useState('all')
  const stage = useRef<HTMLDivElement>(null),
    f = FACILITIES[selected] ?? FACILITIES['GP-001']
  const items = Object.entries(FACILITIES).filter(
    ([, item]) => filter === 'all' || item.layer === filter,
  )
  function select(id: string) {
    setSelected(id)
    const layer = FACILITIES[id].layer
    if (layer === 'gas') setGas(true)
    if (layer === 'utilities') setUtilities(true)
    if (layer === 'structures') setStructures(true)
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await stage.current?.requestFullscreen()
    } catch {
      notify('전체화면을 열 수 없습니다.')
    }
  }
  const pipeCount = new Set(PIPE_ROUTES.map((route) => route.id)).size
  return (
    <>
      <div className="field-title">
        <div>
          <span className="eyebrow">YS-001 · 여수산단</span>
          <h1>도로 하부 배관</h1>
        </div>
        <div className="worker-id">
          <span>{session.name}</span>
          <button onClick={logout} aria-label="로그아웃">
            <LogOut size={17} />
          </button>
        </div>
      </div>
      <div className="workbench">
        <section className="model-stage" ref={stage}>
          <div className="model-toolbar">
            <div className="model-views" aria-label="보기 방식">
              {(
                [
                  ['perspective', '전체 3D'],
                  ['top', '평면'],
                  ['section', '도로 단면'],
                  ['crossing', '교차부'],
                ] as [View, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={view === id}
                  className={view === id ? 'is-active' : ''}
                  onClick={() => {
                    setView(id)
                    if (id === 'crossing') {
                      select('WP-003')
                      setContext(false)
                    } else if (id === 'perspective') {
                      setContext(true)
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="ar-open" onClick={() => go('ar')}>
              <ScanLine size={16} />
              AR
            </button>
          </div>
          <div className="model-canvas">
            <Suspense fallback={<Loading />}>
              <PipeScene
                mode="underground"
                view={view}
                selectedId={selected}
                onSelectPipe={select}
                showPipes={gas}
                showUtilities={utilities}
                showStructures={structures}
                showContext={context}
                showLabels={labels}
                showZones={false}
                exploded={exploded}
                surfaceOpacity={opacity}
                resetKey={reset}
              />
            </Suspense>
          </div>
          <div className="model-scale">
            <span>
              도로 폭 <b>24 m</b>
            </span>
            <i />
            <span>
              구간 길이 <b>64 m</b>
            </span>
          </div>
          <div className="model-tools">
            <button aria-label="시점 초기화" onClick={() => setReset((v) => v + 1)}>
              <RotateCcw size={18} />
            </button>
            <button aria-label="전체화면" onClick={fullscreen}>
              <Maximize size={18} />
            </button>
          </div>
          <div className="model-bottom">
            <span>
              {view === 'section'
                ? '도로 횡단면 · 관로의 높이와 직경 비교'
                : view === 'crossing'
                  ? '교차 구간 · 상하 통과 관계'
                  : view === 'top'
                    ? '평면 배치 · 도로 횡단과 분기'
                    : '드래그 회전 · 휠 또는 두 손가락 확대'}
            </span>
            <button
              aria-pressed={exploded}
              className={exploded ? 'is-active' : ''}
              onClick={() => {
                setExploded(!exploded)
                setStructures(true)
              }}
            >
              <Layers3 size={15} />
              보호판 분리
            </button>
          </div>
        </section>
        <aside className="inspector">
          <div className="inspector-top">
            <h2>관로 선택</h2>
            <span>{pipeCount}개 관로</span>
          </div>
          <div className="system-filter" aria-label="시설 종류">
            {[
              ['all', '전체'],
              ['gas', '산업배관'],
              ['utilities', '기반시설'],
              ['structures', '구조물'],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                className={filter === id ? 'is-active' : ''}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            className="facility-picker"
            aria-label="시설 선택"
            value={selected}
            onChange={(e) => select(e.target.value)}
          >
            {Object.entries(FACILITIES).map(([id, item]) => (
              <option key={id} value={id}>
                {id} · {item.kind}
              </option>
            ))}
          </select>
          <div className="facility-list">
            {items.map(([id, item]) => (
              <button
                key={id}
                className={selected === id ? 'is-selected' : ''}
                aria-pressed={selected === id}
                onClick={() => select(id)}
              >
                <i style={{ background: item.color }} />
                <span>
                  {item.kind}
                  <small>{id}</small>
                </span>
                <b>
                  {item.layer === 'structures'
                    ? '구조물'
                    : item.dimensions
                      ? '관군'
                      : `${item.diameter} mm`}
                </b>
              </button>
            ))}
          </div>
          <section className="facility-info" aria-label="선택한 시설">
            <div className="selected-heading">
              <i style={{ background: f.color }} />
              <div>
                <span>{selected}</span>
                <h3>{f.name}</h3>
              </div>
            </div>
            <div className="facility-metrics">
              <div>
                <span>중심 심도</span>
                <strong>
                  {f.depth}
                  <small>m</small>
                </strong>
              </div>
              <div>
                <span>{f.dimensions ? '규격' : '외경'}</span>
                {f.dimensions ? (
                  <b className="plate-dimension">{f.dimensions}</b>
                ) : (
                  <strong>
                    {f.diameter}
                    <small>mm</small>
                  </strong>
                )}
              </div>
            </div>
            <dl>
              <div>
                <dt>재질</dt>
                <dd>{f.material}</dd>
              </div>
              <div>
                <dt>접합</dt>
                <dd>{f.joint}</dd>
              </div>
            </dl>
            <p>{f.detail}</p>
          </section>
          <details className="layer-panel" open>
            <summary>
              표시 설정
              <ChevronDown size={14} />
            </summary>
            <Switch label="산업배관" value={gas} change={setGas} />
            <Switch label="상하수·전력·통신" value={utilities} change={setUtilities} />
            <Switch label="보호판·구조물" value={structures} change={setStructures} />
            <Switch label="주변 건물·도로" value={context} change={setContext} />
            <Switch label="선택 정보" value={labels} change={setLabels} />
            <label className="opacity-control">
              노면 표시<span>{Math.round(opacity * 100)}%</span>
              <input
                aria-label="노면 표시"
                type="range"
                min="0"
                max="0.85"
                step="0.01"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
            </label>
          </details>
        </aside>
      </div>
      <Sources />
    </>
  )
}
function Switch({
  label,
  value,
  change,
}: {
  label: string
  value: boolean
  change: (v: boolean) => void
}) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <button
        role="switch"
        aria-label={label}
        aria-checked={value}
        className={`toggle ${value ? 'on' : ''}`}
        onClick={() => change(!value)}
      >
        <i />
      </button>
    </div>
  )
}
function Login({ onBack, onSuccess }: { onBack: () => void; onSuccess: (s: Session) => void }) {
  const [name, setName] = useState(''),
    [permit, setPermit] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (
      permit.trim().toUpperCase() !== LOCATION.permit ||
      password !== LOCATION.password ||
      !name.trim()
    ) {
      setError('접속 코드와 비밀번호를 확인하세요.')
      return
    }
    const next = { name: name.trim(), permit: LOCATION.permit, locationId: LOCATION.id }
    try {
      saveSession(next)
      onSuccess(next)
    } catch {
      setError('접속 정보를 저장할 수 없습니다.')
    }
  }
  return (
    <section className="compact-card login-access">
      <button className="quiet-back" onClick={onBack}>
        <ArrowLeft size={15} />
        현장
      </button>
      <span className="eyebrow">YS-001</span>
      <h1>배관 · AR 열람</h1>
      <p className="login-intro-copy">이 구간의 배관을 3D와 AR로 확인하세요.</p>
      <button
        className="action primary prefill-button"
        type="button"
        onClick={() => {
          const next = { name: '열람자', permit: LOCATION.permit, locationId: LOCATION.id }
          try {
            saveSession(next)
            onSuccess(next)
          } catch {
            setError('접속 정보를 저장할 수 없습니다.')
          }
        }}
      >
        <Box size={19} />
        바로 열람
        <ArrowRight size={18} />
      </button>
      {error && (
        <p className="field-error login-error" role="alert">{error}</p>
      )}
      <a className="login-eocs-link" href={EOCS_URL} target="_blank" rel="noreferrer">
        <span><strong>작업 시작 신고</strong><small>휴대전화 인증과 신고는 EOCS에서 진행합니다.</small></span>
        <ExternalLink size={17} />
      </a>
      <details className="access-note login-credentials">
        <summary>접속 코드로 열람 <ChevronDown size={15} /></summary>
        <p>{LOCATION.permit} / 1234 · 기관 계정 연동 전 열람용 접속입니다.</p>
        <form onSubmit={submit}>
          <label>
            접속 코드
            <input
              autoComplete="username"
              value={permit}
              onChange={(e) => setPermit(e.target.value)}
              placeholder="YS-2026-001"
              required
              maxLength={50}
            />
          </label>
          <label>
            이름
            <input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={30}
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={30}
            />
          </label>
          <button className="action secondary" type="submit">
            배관 조회
            <ArrowRight size={17} />
          </button>
        </form>
      </details>
    </section>
  )
}
function ReportForm({
  onBack,
  onComplete,
}: {
  onBack: () => void
  onComplete: (r: Report) => void
}) {
  const [reason, setReason] = useState(''),
    [photo, setPhoto] = useState(''),
    [photoName, setPhotoName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const photoRef = useRef(''),
    submitted = useRef(false),
    input = useRef<HTMLInputElement>(null)
  useEffect(
    () => () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current)
    },
    [],
  )
  function clear() {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current)
    photoRef.current = ''
    setPhoto('')
    setPhotoName('')
    if (input.current) input.current.value = ''
  }
  function select(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('JPG, PNG, WEBP 또는 GIF 이미지를 선택하세요.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('10MB 이하의 사진을 선택하세요.')
      return
    }
    clear()
    photoRef.current = URL.createObjectURL(file)
    setPhoto(photoRef.current)
    setPhotoName(file.name)
    setError('')
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (submitted.current) return
    if (reason.trim().length < 5) {
      setError('작업 내용을 5자 이상 입력하세요.')
      return
    }
    const report = {
      id: makeReportId(),
      locationId: LOCATION.id,
      locationName: LOCATION.name,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
      hasPhoto: !!photo,
    }
    submitted.current = true
    setBusy(true)
    try {
      saveReport(report)
      onComplete(report)
    } catch {
      setError('저장 공간을 확인하세요.')
      submitted.current = false
      setBusy(false)
    }
  }
  return (
    <section className="compact-card report-card">
      <button className="quiet-back" onClick={onBack}>
        <ArrowLeft size={15} />
        현장
      </button>
      <span className="eyebrow">YS-001</span>
      <h1>시민 신고</h1>
      <form onSubmit={submit}>
        <label>
          위치
          <input readOnly value={`${LOCATION.id} · 여수산단`} />
        </label>
        <label>
          현장 사진 <small>선택</small>
          <input
            ref={input}
            className="photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => select(e.target.files?.[0])}
          />
        </label>
        {photo ? (
          <div className="report-photo">
            <img
              src={photo}
              alt="선택한 현장 사진"
              onError={() => {
                clear()
                setError('사진을 읽을 수 없습니다.')
              }}
            />
            <button type="button" onClick={clear} aria-label="사진 삭제">
              <X size={18} />
            </button>
            <span>{photoName}</span>
          </div>
        ) : (
          <button className="photo-pick" type="button" onClick={() => input.current?.click()}>
            <Camera size={25} />
            사진 선택
          </button>
        )}
        <label>
          작업 내용
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="장비, 작업 위치, 진행 상황을 입력하세요."
            required
            minLength={5}
            maxLength={500}
          />
        </label>
        <div className="report-shortcuts">
          {['굴착 작업 중, 공사 안내 없음', '배관 주변 굴착 확인 요청'].map((text) => (
            <button key={text} type="button" onClick={() => setReason(text)}>
              {text}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <p className="storage-note">
          기관 전송 미연결 · 내용은 이 기기에 저장되며 사진 파일은 보관하지 않습니다.
        </p>
        <button className="action primary" disabled={busy} type="submit">
          {busy ? '저장 중' : '신고 내용 저장'}
          <ArrowRight size={17} />
        </button>
      </form>
    </section>
  )
}
function Receipt({ report, go }: { report: Report | null; go: (p: Page) => void }) {
  return (
    <section className="compact-card receipt">
      <div className="receipt-check">
        <Check size={28} />
      </div>
      <h1>{report ? '신고 내용 저장 완료' : '저장된 내용이 없습니다'}</h1>
      {report && (
        <>
          <p className="receipt-id">{report.id}</p>
          <dl>
            <div>
              <dt>위치</dt>
              <dd>{report.locationId} · 여수산단</dd>
            </div>
            <div>
              <dt>저장 시각</dt>
              <dd>{new Date(report.createdAt).toLocaleString('ko-KR')}</dd>
            </div>
          </dl>
          <p className="saved-reason">{report.reason}</p>
          <p className="storage-note receipt-note">이 기기에 저장되었습니다. 기관으로 전송되지는 않았습니다.</p>
        </>
      )}
      <button className="action primary" onClick={() => go('home')}>
        현장으로 돌아가기
        <ArrowRight size={17} />
      </button>
    </section>
  )
}
function QRPanel({ notify }: { notify: (t: string) => void }) {
  const initial = new URL('https://chuljoon2026-boop.github.io/gaspring-pipes/')
  const defaultTarget = new URL(initial.href)
  defaultTarget.searchParams.set('location', LOCATION.id)
  const [base, setBase] = useState(initial.href),
    [target, setTarget] = useState(() => {
      initial.searchParams.set('location', LOCATION.id)
      return initial.href
    }),
    [qr, setQr] = useState(''),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setQr('')
    QRCode.toDataURL(target, {
      width: 1200,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: '#142b50', light: '#ffffff' },
    })
      .then((data) => {
        if (active) setQr(data)
      })
      .catch(() => {
        if (active) setError('주소 길이를 확인하세요.')
      })
    return () => {
      active = false
    }
  }, [target])
  function generate(e: FormEvent) {
    e.preventDefault()
    try {
      const url = new URL(base.trim())
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error()
      url.hash = ''
      url.searchParams.set('location', LOCATION.id)
      setTarget(url.href)
      setError('')
    } catch {
      setError('http:// 또는 https:// 주소를 입력하세요.')
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(target)
      notify('주소를 복사했습니다.')
    } catch {
      setError('아래 주소를 선택해 복사하세요.')
    }
  }
  return (
    <section className="compact-card qr-panel">
      <span className="eyebrow">YS-001</span>
      <h1>현장 접속 QR</h1>
      <div className="qr-display">
        {qr ? <img src={qr} alt="현장 접속 QR" /> : <QrCode size={100} />}
      </div>
      <p>현장 공사 조회 · 시민 신고 · 배관 정보</p>
      <div className="qr-address">
        <code>{target}</code>
        <button onClick={copy} aria-label="주소 복사">
          <Copy size={17} />
        </button>
      </div>
      <a
        className={`action primary ${!qr ? 'disabled' : ''}`}
        href={qr || undefined}
        download="QR-YS-001.png"
      >
        <Download size={17} />
        QR 저장
      </a>
      {target === defaultTarget.href && (
        <div className="qr-marker-actions">
          <a className="action secondary" href={`${import.meta.env.BASE_URL}qr/YS-001-marker.png`} download="YS-001-현장안내판.png">
            <Download size={17} />
            안내판 저장
          </a>
          <a className="action secondary" href={`${import.meta.env.BASE_URL}qr/YS-001.html`} target="_blank" rel="noreferrer">
            <Printer size={17} />
            인쇄용 안내판
          </a>
        </div>
      )}
      <details className="qr-settings">
        <summary>연결 주소 변경</summary>
        <form onSubmit={generate}>
          <label>
            웹페이지 주소
            <input type="url" value={base} onChange={(e) => setBase(e.target.value)} required />
          </label>
          <button className="action secondary" type="submit">
            QR 생성
          </button>
        </form>
      </details>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
