import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Crosshair, Layers3, Move3D, RotateCcw, ScanLine, Settings2, X } from 'lucide-react'
import type { ARPhase, FloorARHandle, UndergroundSettings } from './FloorARScene'
import { FACILITIES } from '../network'
import './ARView.css'

const FloorARScene = lazy(() => import('./FloorARScene'))
type Capability = 'checking' | 'webxr' | 'unsupported'
const phaseText: Record<ARPhase, string> = {
  idle: '카메라로 지면을 인식하고, 기준 배관이 지나는 지점을 맞춰주세요.',
  searching: '도로 또는 지면을 비추며 휴대전화를 천천히 움직이세요.',
  surface: '원이 표시된 지면 아래에 기준 배관을 맞춥니다.',
  placed: '지하 배관을 투시하고 있습니다. 휴대전화를 움직여 확인하세요.',
  lost: '위치를 다시 찾고 있습니다. 기준으로 맞춘 지면을 비춰주세요.',
}
const initialSettings: UndergroundSettings = {
  facilityId: 'GP-001', heading: 0, depthOffset: 0, gas: true, utilities: true, guides: true,
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
  const [settings, setSettings] = useState(initialSettings)
  const active = phase !== 'idle'
  const registered = phase === 'placed' || phase === 'lost'
  const selected = FACILITIES[settings.facilityId]
  const depth = -selected.anchor[1] + settings.depthOffset
  const change = <K extends keyof UndergroundSettings,>(key: K, value: UndergroundSettings[K]) =>
    setSettings(current => ({ ...current, [key]: value }))
  const onPhase = useCallback((next: ARPhase) => {
    if (!mounted.current) return
    setPhase(next)
    if (next === 'idle') { session.current = null; setBusy(false) }
  }, [])
  const onReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    Promise.resolve(window.isSecureContext && navigator.xr
      ? navigator.xr.isSessionSupported('immersive-ar').catch(() => false)
      : false).then(supported => {
      if (!cancelled) setCapability(supported ? 'webxr' : 'unsupported')
    })
    const root = overlay.current
    const preventUIPlacement = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('button, a, select, input, summary, label')) event.preventDefault()
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
        ? '카메라와 AR 사용 권한을 허용한 뒤 다시 시작해 주세요.'
        : '지면 추적을 시작하지 못했습니다. AR 지원 Android 기기의 Chrome에서 열어주세요.')
    } finally { if (mounted.current) setBusy(false) }
  }
  async function close() {
    try { await scene.current?.end() } catch { /* The browser may already have ended the session. */ }
    onClose()
  }
  async function stop() {
    try { await scene.current?.end() } catch { setError('브라우저의 AR 종료 버튼으로 닫아주세요.') }
  }

  return <div ref={overlay} className={'floor-ar underground-ar ' + (active ? 'is-active' : '')} data-ar-phase={phase} data-ar-mode="underground">
    <div className="floor-ar-stage" aria-label="지면 아래 배관 미리보기">
      <Suspense fallback={<div className="floor-ar-loading">지하 배관을 준비하고 있습니다</div>}>
        <FloorARScene ref={scene} settings={settings} onPhase={onPhase} onReady={onReady} />
      </Suspense>
    </div>
    <header className="floor-ar-header">
      <div><span><ScanLine size={15} /> YS-001 · 1:1</span><h1>지하 투시 AR</h1><p>{active ? '카메라 · 지면 아래 배관' : '카메라로 지면 아래 확인'}</p></div>
      <button className="floor-ar-close" onClick={close} aria-label="AR 닫기"><X size={22} /></button>
    </header>
    {!active && <div className="floor-ar-guide">
      <Move3D size={22} /><span>인식한 지면은 0 m<br />배관은 실제 크기로 매설 깊이 아래에 표시합니다.</span>
    </div>}
    {registered && <div className="underground-depth-badge"><span className="depth-dot" />{selected.kind}<strong>지하 {depth.toFixed(2)} m</strong></div>}
    <section className="floor-ar-panel">
      <div className="underground-reference">
        <label htmlFor="ar-reference-pipe">기준 배관</label>
        <select id="ar-reference-pipe" value={settings.facilityId} disabled={registered || busy} onChange={event => {
          const id = event.target.value
          setSettings(current => ({ ...current, facilityId: id, [FACILITIES[id].layer]: true }))
        }}>
          {Object.entries(FACILITIES).filter(([, item]) => item.layer !== 'structures').map(([id, item]) =>
            <option key={id} value={id}>{item.name} · {(-item.anchor[1]).toFixed(2)} m</option>)}
        </select>
      </div>
      <div className="underground-layers" aria-label="투시 관종">
        <button aria-pressed={settings.gas} onClick={() => change('gas', !settings.gas)}><i className="gas-dot" />산업배관</button>
        <button aria-pressed={settings.utilities} onClick={() => change('utilities', !settings.utilities)}><i className="utility-dot" />용수·하수·전력·통신</button>
      </div>
      <p className="floor-ar-status" role="status">{error || (capability === 'unsupported'
        ? '이 브라우저는 지하 투시 AR을 지원하지 않습니다. AR 지원 Android 기기의 Chrome에서 열어주세요. iPhone에서는 3D 배관을 확인할 수 있습니다.'
        : phaseText[phase])}</p>
      {active ? <div className="floor-ar-actions">
        {registered ?
          <button className="floor-ar-primary" onClick={() => scene.current?.reset()}><RotateCcw size={18} />기준점 다시 맞추기</button> :
          <button className="floor-ar-primary" disabled={phase !== 'surface'} onClick={() => scene.current?.place()}><Crosshair size={19} />{phase === 'surface' ? '이 지면에 맞춰 투시' : '지면을 찾는 중'}</button>}
        <button className="floor-ar-secondary" onClick={stop}>AR 종료</button>
      </div> : capability === 'webxr' ?
        <button className="floor-ar-primary" disabled={!ready || busy} onClick={start}><ScanLine size={19} />{busy ? '카메라 시작 중…' : '카메라로 지하 투시'}</button>
      : capability === 'checking' ? <button className="floor-ar-primary" disabled>AR 지원 확인 중…</button>
      : <button className="floor-ar-primary" onClick={close}><ArrowLeft size={19} />3D 배관 보기</button>}
      <details className="underground-adjustments">
        <summary><Settings2 size={14} />방향·깊이 맞춤</summary>
        <label htmlFor="ar-heading">배관 방향 <output>{settings.heading}°</output></label>
        <input id="ar-heading" type="range" min={-180} max={180} step={5} value={settings.heading} onChange={event => change('heading', Number(event.target.value))} />
        <label htmlFor="ar-depth-offset">매설 깊이 보정 <output>{settings.depthOffset > 0 ? '+' : ''}{settings.depthOffset.toFixed(2)} m</output></label>
        <input id="ar-depth-offset" type="range" min={-0.5} max={0.5} step={0.05} value={settings.depthOffset} onChange={event => change('depthOffset', Number(event.target.value))} />
        <button className="depth-guide-toggle" aria-pressed={settings.guides} onClick={() => change('guides', !settings.guides)}><Layers3 size={15} />지면·심도 표시</button>
      </details>
      <p className="floor-ar-note">지면 기준 수동 정렬 · 실측 도면 좌표 미연계</p>
    </section>
  </div>
}
