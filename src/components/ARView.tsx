import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Move3D, RotateCcw, ScanLine, X } from 'lucide-react'
import type { ARPhase, FloorARHandle, UndergroundSettings } from './FloorARScene'
import type { CameraARHandle } from './CameraARScene'
import './ARView.css'
import { GroundMask, type MaskMode } from '../ar/GroundMask'
import { FACILITIES, PIPE_ROUTES } from '../network'

const CameraARScene = lazy(() => import('./CameraARScene'))
const FloorARScene = lazy(() => import('./FloorARScene'))
type Capability = 'checking' | 'webxr' | 'camera' | 'unsupported'
const phaseText: Record<ARPhase, string> = {
  idle: '카메라를 켜고 지면을 비추세요.',
  searching: '지면을 비추며 휴대전화를 천천히 움직이세요.',
  surface: '지면을 확인했습니다. 배관을 자동으로 표시합니다.',
  placed: '가상 GIS 배관을 표시하고 있습니다.',
  lost: '위치를 다시 찾고 있습니다. 주변 지면을 비춰주세요.',
}
const initialSettings: UndergroundSettings = {
  facilityId: 'GP-001', heading: 0, depthOffset: 0, gas: true, utilities: false, guides: false, opacity: 0.48,
}

export default function ARView({ onClose }: { onClose: () => void }) {
  const groundMask = useMemo(() => new GroundMask(), [])
  const [maskMode, setMaskMode] = useState<MaskMode>('pending')
  const autoCamera = useRef(false)
  useEffect(() => {
    groundMask.onChange = setMaskMode
    const resize = () => groundMask.clear()
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); groundMask.onChange = undefined; groundMask.dispose() }
  }, [groundMask])
  const overlay = useRef<HTMLDivElement>(null)
  const scene = useRef<FloorARHandle>(null)
  const cameraScene = useRef<CameraARHandle>(null)
  const session = useRef<XRSession | null>(null)
  const mounted = useRef(true)
  const [capability, setCapability] = useState<Capability>('checking')
  const [phase, setPhase] = useState<ARPhase>('idle')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(initialSettings)
  const selected = FACILITIES[settings.facilityId]
  const pipeIds = [...new Set(PIPE_ROUTES.map(route => route.id))]
  const active = phase !== 'idle'
  const registered = phase === 'placed' || phase === 'lost'
  const change = <K extends keyof UndergroundSettings,>(key: K, value: UndergroundSettings[K]) =>
    setSettings(current => ({ ...current, [key]: value }))
  const onPhase = useCallback((next: ARPhase) => {
    if (!mounted.current) return
    setPhase(next)
    if (next === 'idle') { session.current = null; setBusy(false) }
  }, [])
  const onReady = useCallback(() => setReady(true), [])
  useEffect(() => {
    if (capability === 'camera' && ready && autoCamera.current) {
      autoCamera.current = false
      cameraScene.current?.start().catch(caught => setError(caught instanceof Error ? caught.message : '카메라를 시작하지 못했습니다.'))
    }
  }, [capability, ready])

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    Promise.resolve(window.isSecureContext && navigator.xr
      ? navigator.xr.isSessionSupported('immersive-ar').catch(() => false)
      : false).then(supported => {
      if (!cancelled) setCapability(supported ? 'webxr' : window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'camera' : 'unsupported')
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
    if (!ready || !overlay.current || busy) return
    setBusy(true)
    setError('')
    try {
      if (capability === 'camera') { await cameraScene.current?.start(); return }
      if (!scene.current || !navigator.xr) return
      const next = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        optionalFeatures: ['anchors', 'depth-sensing'],
        depthSensing: { usagePreference: ['cpu-optimized'], dataFormatPreference: ['float32', 'luminance-alpha'] },
        domOverlay: { root: overlay.current },
      })
      if (!mounted.current || !scene.current) { await next.end(); return }
      if (next.depthUsage !== 'cpu-optimized') {
        await next.end()
        setReady(false); autoCamera.current = true; setCapability('camera')
        return
      }
      session.current = next
      await scene.current.start(next)
    } catch (caught) {
      if (!mounted.current) return
      if (capability === 'webxr' && !(caught instanceof DOMException && caught.name === 'NotAllowedError') && typeof navigator.mediaDevices?.getUserMedia === 'function') {
        setReady(false); autoCamera.current = true; setCapability('camera')
        return
      }
      setError(caught instanceof DOMException && caught.name === 'NotAllowedError'
        ? '카메라와 AR 사용 권한을 허용한 뒤 다시 시작해 주세요.'
        : capability === 'camera' && caught instanceof Error ? caught.message : '지면 추적을 시작하지 못했습니다. 카메라 권한과 AR 지원 여부를 확인해 주세요.')
    } finally { if (mounted.current) setBusy(false) }
  }
  async function close() {
    try { await (capability === 'camera' ? cameraScene.current?.end() : scene.current?.end()) } catch { /* The browser may already have ended the session. */ }
    onClose()
  }
  async function stop() {
    try { await (capability === 'camera' ? cameraScene.current?.end() : scene.current?.end()) } catch { setError('브라우저의 AR 종료 버튼으로 닫아주세요.') }
  }

  return <div ref={overlay} className={'floor-ar underground-ar ' + (active ? 'is-active ' : '') + (capability === 'camera' ? 'camera-mode' : '')} data-ar-phase={phase} data-ar-mode="underground" data-ar-backend={capability} data-ground-mask={maskMode}>
    <div className="floor-ar-stage" aria-label="지면 아래 배관 미리보기">
      <Suspense fallback={<div className="floor-ar-loading">배관을 준비하고 있습니다</div>}>
        {capability === 'camera' ? <CameraARScene ref={cameraScene} groundMask={groundMask} settings={settings} onPhase={onPhase} onReady={onReady} onError={setError} />
          : capability !== 'checking' && <FloorARScene ref={scene} groundMask={groundMask} settings={settings} onPhase={onPhase} onReady={onReady} />}
      </Suspense>
    </div>
    <header className="floor-ar-header">
      <div><span><ScanLine size={15} /> GIS 배관 정보</span><h1>지하 투시 AR</h1><p>{active && maskMode === 'depth' ? '지면 인식 / 사물 가림' : '지면 자동 인식 / 지하 배관'}</p></div>
      <button className="floor-ar-close" onClick={close} aria-label="AR 닫기"><X size={22} /></button>
    </header>
    {!active && <div className="floor-ar-guide"><Move3D size={22} /><span>현재 위치를 기준으로 배관을 표시합니다.<br />지면을 비춰 배관의 위치와 심도를 확인하세요.</span></div>}
    {registered && <section className="ar-pipe-info" aria-label="배관 정보">
      <label htmlFor="ar-pipe">관로</label>
      <select id="ar-pipe" value={settings.facilityId} onChange={event => {
        const id = event.target.value
        setSettings(current => ({ ...current, facilityId: id, [FACILITIES[id].layer]: true }))
      }}>{pipeIds.map(id => <option key={id} value={id}>{FACILITIES[id].name} / {id}</option>)}</select>
      <div><strong>중심 심도 {selected.depth.toFixed(2)} m</strong><span>{selected.dimensions || `관경 ${selected.diameter} mm`}</span></div>
      <p>{selected.material}</p>
    </section>}
    <section className="floor-ar-panel">
      <p className="floor-ar-status" role="status">{error || (capability === 'unsupported'
        ? '카메라를 사용할 수 없습니다. 3D 배관 보기를 이용하세요.'
        : registered && (maskMode === 'pending' || maskMode === 'searching') ? '지면을 인식하고 있습니다.' : capability === 'camera' && phase === 'searching' ? '휴대전화를 아래로 기울여 지면을 비추세요.' : phaseText[phase])}</p>
      {active && <>
        <div className="underground-layers" aria-label="배관 표시">
          <button aria-pressed={settings.gas} onClick={() => change('gas', !settings.gas)}><i className="gas-dot" />가스 / 제품관</button>
          <button aria-pressed={settings.utilities} onClick={() => change('utilities', !settings.utilities)}><i className="utility-dot" />상하수 / 전력 / 통신</button>
        </div>
        <label className="ar-opacity" htmlFor="ar-opacity">배관 선명도 <input id="ar-opacity" type="range" min={0.15} max={0.8} step={0.05} value={settings.opacity} onChange={event => change('opacity', Number(event.target.value))} /></label>
      </>}
      {active ? <div className="floor-ar-actions">
        <button className="floor-ar-secondary" onClick={() => { setError(''); if (capability === 'camera') cameraScene.current?.reset(); else scene.current?.reset() }}><RotateCcw size={16} />현재 위치로 다시 보기</button>
        <button className="floor-ar-primary" onClick={stop}>종료</button>
      </div> : capability === 'webxr' || capability === 'camera' ?
        <button className="floor-ar-primary" disabled={!ready || busy} onClick={start}><ScanLine size={19} />{busy ? '카메라 시작 중…' : '카메라 켜기'}</button>
      : capability === 'checking' ? <button className="floor-ar-primary" disabled>카메라 확인 중…</button>
      : <button className="floor-ar-primary" onClick={close}><ArrowLeft size={19} />기능 선택으로</button>}
      <p className="floor-ar-note">{capability === 'camera' ? '간편 AR: 카메라 높이 1.4 m 가정 / 이동 추적 미지원' : '지면 인식 후 위치 고정 / 가상 배관 데이터'}<br />실제 매설물 탐지 기능이 아닙니다.</p>
    </section>
  </div>
}
