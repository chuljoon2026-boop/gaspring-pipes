import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createPipeModel, disposePipeModel } from '../ar/createPipeModel'
import { DEMO_GIS } from '../ar/demoGIS'
import DepthReference from './DepthReference'
import { FACILITIES } from '../network'
import PipePicker from './PipePicker'
import { canvasEvents } from '../ar/canvasEvents'
import type { ARPhase, UndergroundSettings } from './FloorARScene'

export interface CameraARHandle { start: () => Promise<void>; end: () => Promise<void>; reset: () => void }
type Props = { onSelect: (id: string) => void; settings: UndergroundSettings; onPhase: (phase: ARPhase) => void; onReady: () => void; onError: (message: string) => void }
type OrientationAccess = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }

function OverlayWorld({ settings, orientation, active, onPhase, resetVersion, onSelect }: {
  onSelect: (id: string) => void;
  settings: UndergroundSettings; orientation: React.RefObject<THREE.Quaternion | null>;
  active: boolean; onPhase: Props['onPhase']; resetVersion: number;
}) {
  const model = useMemo(createPipeModel, [])
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => {
      // Bound overlay rendering independently of the camera stream.
      invalidate()
    }, 1000 / 30)
    return () => clearInterval(timer)
  }, [active, invalidate])
  const root = useRef<THREE.Group>(null)
  const registered = useRef(false)
  const disposal = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scratch = useMemo(() => ({ direction: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), [])
  useEffect(() => {
    clearTimeout(disposal.current)
    return () => { disposal.current = setTimeout(() => disposePipeModel(model), 0) }
  }, [model])
  useEffect(() => { registered.current = false; if (root.current) root.current.visible = false }, [active, resetVersion])
  useEffect(() => {
    model.getObjectByName('PipeNetwork')!.position.set(...DEMO_GIS.drawingOffset)
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.visible = object.userData.layer === 'gas' ? settings.gas : object.userData.layer === 'utilities' ? settings.utilities : false
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        material.opacity = object.userData.facilityId === settings.facilityId ? settings.opacity : settings.opacity * 0.22
        material.depthWrite = false
        material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.012)]
      }
    })
  }, [model, settings.facilityId, settings.gas, settings.utilities, settings.opacity])
  useFrame(({ camera }) => {
    if (!active || !orientation.current || !root.current) return
    camera.position.set(0, DEMO_GIS.cameraHeight, 0)
    camera.quaternion.copy(orientation.current)
    scratch.direction.set(0, 0, -1).applyQuaternion(camera.quaternion)
    if (!registered.current && scratch.direction.y < -0.3) {
      const yaw = Math.atan2(-scratch.direction.x, -scratch.direction.z)
      root.current.quaternion.setFromAxisAngle(scratch.up, yaw)
      registered.current = true
      root.current.visible = true
      onPhase('placed')
    }
    root.current.visible = registered.current
    camera.updateMatrixWorld()

  })
  return <><ambientLight intensity={0.8} /><directionalLight position={[-3, 7, 2]} intensity={2.6} />
    <group ref={root} name="camera-gis-origin" visible={false}><primitive object={model} dispose={null} /><PipePicker model={model} onSelect={onSelect} />{settings.guides && (FACILITIES[settings.facilityId].layer === 'gas' ? settings.gas : settings.utilities) && <DepthReference key={settings.facilityId} facilityId={settings.facilityId} />}</group></>
}

/** Camera + orientation fallback. Rotation only; ground height is assumed,
 * not detected. Explicitly labelled in UI, with no simulated walking/GPS. */
const CameraARScene = forwardRef<CameraARHandle, Props>(function CameraARScene({ settings, onPhase, onReady, onError, onSelect }, ref) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const orientation = useRef<THREE.Quaternion | null>(null)
  const alive = useRef(true)
  const generation = useRef(0)
  const sensorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [active, setActive] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const callbacks = useRef({ onPhase, onError, onReady })
  callbacks.current = { onPhase, onError, onReady }
  const stop = useCallback(async () => {
    generation.current++
    clearTimeout(sensorTimer.current)
    stream.current?.getTracks().forEach(track => { track.onended = null; track.stop() })
    stream.current = null
    if (video.current) video.current.srcObject = null
    orientation.current = null
    if (alive.current) { setActive(false); callbacks.current.onPhase('idle') }
  }, [])
  useImperativeHandle(ref, () => ({
    async start() {
      const token = ++generation.current
      // iOS requires orientation permission to be requested during the tap.
      const api = window.DeviceOrientationEvent as OrientationAccess | undefined
      if (!api) throw new Error('이 기기에는 방향 센서가 없습니다. 3D 배관 보기를 이용하세요.')
      const permission = api.requestPermission ? await api.requestPermission() : 'granted'
      if (permission !== 'granted') throw new Error('동작 및 방향 권한을 허용해 주세요.')
      if (!alive.current || token !== generation.current) return
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false })
      if (!alive.current || token !== generation.current) { next.getTracks().forEach(track => track.stop()); return }
      stream.current = next
      try {
        if (!video.current) throw new Error('카메라 화면을 준비하지 못했습니다.')
        video.current.srcObject = next
        await video.current.play()
        if (!alive.current || token !== generation.current) return
        next.getVideoTracks().forEach(track => { track.onended = () => { void stop(); callbacks.current.onError('카메라가 종료되었습니다. 다시 시작해 주세요.') } })
        setActive(true)
        callbacks.current.onPhase('searching')
        sensorTimer.current = setTimeout(() => {
          if (!orientation.current && alive.current) {
            void stop()
            callbacks.current.onError('방향 센서 정보를 받지 못했습니다. 휴대전화의 동작 권한을 확인하거나 3D 배관 보기를 이용하세요.')
          }
        }, 5000)
      } catch (error) { await stop(); throw error }
    },
    end: stop,
    reset() { setResetVersion(value => value + 1); callbacks.current.onPhase('searching') },
  }))
  useEffect(() => {
    alive.current = true
    callbacks.current.onReady()
    const euler = new THREE.Euler()
    const correction = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    const screenCorrection = new THREE.Quaternion()
    const zAxis = new THREE.Vector3(0, 0, 1)
    const handle = (event: DeviceOrientationEvent) => {
      if (!stream.current || event.alpha === null || event.beta === null || event.gamma === null) return
      const rad = Math.PI / 180
      euler.set(event.beta * rad, event.alpha * rad, -event.gamma * rad, 'YXZ')
      const angle = screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0
      orientation.current = new THREE.Quaternion().setFromEuler(euler).multiply(correction)
        .multiply(screenCorrection.setFromAxisAngle(zAxis, -angle * rad))
    }
    const visibility = () => { if (document.hidden) void stop() }
    window.addEventListener('deviceorientation', handle)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      alive.current = false
      window.removeEventListener('deviceorientation', handle)
      document.removeEventListener('visibilitychange', visibility)
      void stop()
    }
  }, [stop])
  return <div className="camera-ar-scene">
    <video ref={video} muted playsInline autoPlay aria-label="후면 카메라" />
    <Canvas events={canvasEvents} frameloop="demand" camera={{ position: [0, 1.4, 0], near: 0.05, far: 100, fov: 65 }}
      gl={{ alpha: true, antialias: true }} dpr={[1, 1.25]} onCreated={({ gl }) => { gl.setClearAlpha(0); gl.localClippingEnabled = true }}>
      <OverlayWorld onSelect={onSelect} settings={settings} orientation={orientation} active={active} onPhase={onPhase} resetVersion={resetVersion} />
    </Canvas>
  </div>
})
export default CameraARScene
