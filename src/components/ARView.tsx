import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Crosshair, Layers3, RefreshCw, ScanLine, X } from 'lucide-react'

const PipeScene = lazy(() => import('./PipeScene'))

export default function ARView({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const requestRef = useRef(0)
  const [camera, setCamera] = useState<'off' | 'loading' | 'on'>('off')
  const [message, setMessage] = useState('카메라 없이도 AR 배관 배치를 시연할 수 있습니다.')
  const [reset, setReset] = useState(0)
  const [zones, setZones] = useState(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current += 1
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function stopCamera() {
    requestRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamera('off')
    setMessage('시뮬레이션 화면으로 전환했습니다.')
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setMessage('카메라는 HTTPS 또는 localhost에서 사용할 수 있습니다. 시뮬레이션으로 계속하세요.')
      return
    }
    setCamera('loading')
    const request = ++requestRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      })
      if (!mountedRef.current || request !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if (mountedRef.current && request === requestRef.current) {
        setCamera('on')
        setMessage('실제 카메라 위에 가상 배관을 표시합니다. 위치 정합은 시뮬레이션입니다.')
      }
    } catch {
      if (!mountedRef.current || request !== requestRef.current) return
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setCamera('off')
      setMessage('카메라에 접근할 수 없습니다. 권한을 확인하거나 시뮬레이션으로 계속하세요.')
    }
  }

  return (
    <div className={`ar-screen ${camera === 'on' ? 'camera-active' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="ar-camera"
        aria-label="현장 카메라 화면"
      />
      <div className="ar-sim-background">
        <div className="ar-sim-sky" />
        <div className="ar-sim-building left" />
        <div className="ar-sim-building right" />
        <div className="ar-sim-road" />
      </div>
      <div className="ar-scene">
        <Suspense fallback={<div className="scene-loading">AR 장면을 준비하고 있습니다</div>}>
          <PipeScene mode="ar" showPipes showZones={zones} showLabels resetKey={reset} />
        </Suspense>
      </div>
      <header className="ar-top">
        <div>
          <span className="ar-tag">
            <ScanLine size={15} /> AR SIMULATION
          </span>
          <h1>현장 위에, 배관을 보다</h1>
          <p><span className="private-place">여수산단 A-12 구역</span> · YS-001</p>
        </div>
        <button className="ar-round" onClick={onClose} aria-label="AR 닫기">
          <X />
        </button>
      </header>
      <div className="ar-crosshair">
        <Crosshair size={42} strokeWidth={1} />
      </div>
      <div className="ar-side">
        <button
          className="ar-round"
          onClick={() => setReset((value) => value + 1)}
          aria-label="AR 시점 초기화"
        >
          <RefreshCw size={19} />
        </button>
        <button
          className={`ar-round ${zones ? 'selected' : ''}`}
          onClick={() => setZones((value) => !value)}
          aria-label="AR 위험구역 표시"
          aria-pressed={zones}
        >
          <Layers3 size={19} />
        </button>
      </div>
      <div className="ar-bottom">
        <div className="ar-measure">
          <span>
            <i /> GAS PIPE
          </span>
          <strong>
            1.2 <small>m 깊이</small>
          </strong>
          <strong>
            300 <small>mm 직경</small>
          </strong>
        </div>
        <p className="ar-status" role="status">
          {message}
        </p>
        <button
          className="button ar-camera-button"
          disabled={camera === 'loading'}
          onClick={camera === 'on' ? stopCamera : startCamera}
        >
          {camera === 'on' ? <CameraOff size={19} /> : <Camera size={19} />}
          {camera === 'loading'
            ? '카메라 연결 중…'
            : camera === 'on'
              ? '시뮬레이션으로 전환'
              : '현장 카메라 켜기'}
        </button>
        <p className="ar-caption">AR 시연 · 실제 배관 위치와 일치하지 않는 가상 화면</p>
      </div>
    </div>
  )
}
