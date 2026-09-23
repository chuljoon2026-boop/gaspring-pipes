import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Box, Crosshair, Move3D, RotateCcw, ScanLine, X } from 'lucide-react'
import type { ARPhase, FloorARHandle } from './FloorARScene'
import './ARView.css'

const FloorARScene = lazy(() => import('./FloorARScene'))
type Capability = 'checking' | 'webxr' | 'quicklook' | 'unsupported'
const phaseText: Record<ARPhase, string> = {
  idle: '바닥을 인식한 뒤 배관을 놓고, 주변으로 움직여 확인하세요.',
  searching: '바닥을 비추며 휴대전화를 천천히 움직이세요.',
  surface: '표시된 지점에 배관을 놓을 수 있습니다.',
  placed: '배관을 바닥에 배치했습니다. 주변으로 움직여 확인하세요.',
  lost: '위치를 다시 찾고 있습니다. 배치한 바닥을 천천히 비춰주세요.',
}

export default function ARView({ onClose }: { onClose: () => void }) {
  const overlay = useRef<HTMLDivElement>(null)
  const scene = useRef<FloorARHandle>(null)
  const session = useRef<XRSession | null>(null)
  const mounted = useRef(true)
  const [capability, setCapability] = useState<Capability>('checking')
  const [phase, setPhase] = useState<ARPhase>('idle')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(0.05)
  const [quickLookUrl, setQuickLookUrl] = useState('')
  const active = phase !== 'idle'
  const onPhase = useCallback((next: ARPhase) => {
    if (!mounted.current) return
    setPhase(next)
    if (next === 'idle') { session.current = null; setBusy(false) }
  }, [])
  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    const quickLook = document.createElement('a').relList.supports?.('ar') === true
    Promise.resolve(window.isSecureContext && navigator.xr
      ? navigator.xr.isSessionSupported('immersive-ar').catch(() => false)
      : false).then((supported) => {
      if (!cancelled) setCapability(supported ? 'webxr' : quickLook ? 'quicklook' : 'unsupported')
    })
    const root = overlay.current
    const preventUIPlacement = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('button, a, select, input')) event.preventDefault()
    }
    root?.addEventListener('beforexrselect', preventUIPlacement)
    return () => {
      cancelled = true
      mounted.current = false
      root?.removeEventListener('beforexrselect', preventUIPlacement)
      session.current?.end().catch(() => {})
      session.current = null
    }
  }, [])
  useEffect(() => {
    if (capability !== 'quicklook' || !ready || !scene.current) return
    let cancelled = false
    let url = ''
    setQuickLookUrl('')
    setError('')
    scene.current.quickLook(scale).then((result) => {
      url = result
      if (cancelled) URL.revokeObjectURL(result)
      else setQuickLookUrl(result)
    }).catch(() => { if (!cancelled) setError('배관 파일을 준비하지 못했습니다. 화면을 다시 열어주세요.') })
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [capability, ready, scale])

  async function start() {
    if (!ready || !scene.current || !navigator.xr || !overlay.current || busy) return
    setBusy(true)
    setError('')
    try {
      const next = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        optionalFeatures: ['anchors'],
        domOverlay: { root: overlay.current },
      })
      if (!mounted.current || !scene.current) { await next.end(); return }
      session.current = next
      await scene.current.start(next)
    } catch (caught) {
      if (!mounted.current) return
      setError(caught instanceof DOMException && caught.name === 'NotAllowedError'
        ? 'AR 사용 권한을 허용한 뒤 다시 시작해 주세요.'
        : '바닥 추적을 시작하지 못했습니다. 지원되는 휴대전화의 기본 브라우저에서 열어주세요.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  async function close() {
    try { await scene.current?.end() } catch { /* Native browser may already have ended the session. */ }
    onClose()
  }
  async function stop() {
    try { await scene.current?.end() } catch { setError('브라우저의 AR 종료 버튼으로 닫아주세요.') }
  }

  return <div ref={overlay} className={`floor-ar ${active ? 'is-active' : ''}`} data-ar-phase={phase}>
    <div className="floor-ar-stage" aria-label="바닥 배치 배관 모형">
      <Suspense fallback={<div className="floor-ar-loading">배관을 준비하고 있습니다</div>}>
        <FloorARScene ref={scene} scale={scale} onPhase={onPhase} onReady={onReady} />
      </Suspense>
    </div>
    <header className="floor-ar-header">
      <div><span><ScanLine size={15} /> YS-001</span><h1>배관 AR</h1><p>바닥에 배관 놓기</p></div>
      <button className="floor-ar-close" onClick={close} aria-label="AR 닫기"><X size={22} /></button>
    </header>
    {!active && <div className="floor-ar-guide">
      <Move3D size={22} /><span>배치 후 휴대전화를 움직이면<br />같은 위치의 배관을 다른 각도에서 볼 수 있습니다.</span>
    </div>}
    <section className="floor-ar-panel">
      <div className="floor-ar-scale">
        <label htmlFor="ar-model-scale">모형 크기</label>
        <select id="ar-model-scale" value={scale} onChange={(event) => setScale(Number(event.target.value))} disabled={busy}>
          <option value={0.05}>1:20 · 약 3.2 m</option>
          <option value={0.1}>1:10 · 약 6.4 m</option>
          <option value={1}>실제 크기 · 약 64 m</option>
        </select>
      </div>
      <p className="floor-ar-status" role="status">{error || (capability === 'unsupported'
        ? '이 브라우저에서는 바닥 위치 추적을 사용할 수 없습니다. 지원되는 휴대전화에서 열어주세요.'
        : phaseText[phase])}</p>
      {active ? <div className="floor-ar-actions">
        {phase === 'placed' || phase === 'lost' ?
          <button className="floor-ar-primary" onClick={() => scene.current?.reset()}><RotateCcw size={18} />다시 배치</button> :
          <button className="floor-ar-primary" disabled={phase !== 'surface'} onClick={() => scene.current?.place()}><Crosshair size={19} />{phase === 'surface' ? '여기에 배관 놓기' : '바닥을 찾는 중'}</button>}
        <button className="floor-ar-secondary" onClick={stop}>AR 종료</button>
      </div> : capability === 'webxr' ?
        <button className="floor-ar-primary" disabled={!ready || busy} onClick={start}><ScanLine size={19} />{busy ? 'AR 시작 중…' : '바닥 AR 시작'}</button>
      : capability === 'quicklook' ? (quickLookUrl ?
        <a className="floor-ar-primary floor-ar-quicklook" rel="ar" href={quickLookUrl} download="YS-001-pipes.usdz">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />iPhone에서 바닥 AR 열기
        </a> : <button className="floor-ar-primary" disabled><Box size={19} />AR 파일 준비 중…</button>)
      : capability === 'checking' ? <button className="floor-ar-primary" disabled>AR 지원 확인 중…</button>
      : <button className="floor-ar-primary" onClick={close}><ArrowLeft size={19} />3D 배관 보기</button>}
      {!active && <p className="floor-ar-note">평평하고 무늬가 있는 바닥을 비춰주세요. 배관 모형의 바닥을 기준으로 배치합니다.</p>}
    </section>
  </div>
}
