import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import './PipeScene.css'
import UtilityNetwork, { NetworkLabels } from './UtilityNetwork'
import { FACILITIES, SECTION_X, type Vec3 } from '../network'

export interface PipeSceneProps {
  mode?: 'surface' | 'underground' | 'ar'
  showPipes?: boolean; showZones?: boolean; showLabels?: boolean
  surfaceOpacity?: number; view?: 'perspective' | 'top' | 'section' | 'crossing'
  resetKey?: number; compact?: boolean; onSelectPipe?: (id: string) => void
  showUtilities?: boolean; showStructures?: boolean; exploded?: boolean
  selectedId?: string; showContext?: boolean
}

function Box({ position, size, color, opacity = 1, metalness = 0, rotation }: {
  position: Vec3; size: Vec3; color: string; opacity?: number; metalness?: number; rotation?: Vec3
}) {
  return <mesh position={position} rotation={rotation} castShadow={opacity === 1} receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} metalness={metalness} roughness={0.8} depthWrite={opacity >= 0.99} />
  </mesh>
}

function Cylinder({ position, radius, height, color, rotation, metalness = 0.1 }: {
  position: Vec3; radius: number; height: number; color: string; rotation?: Vec3; metalness?: number
}) {
  return <mesh position={position} rotation={rotation} castShadow receiveShadow>
    <cylinderGeometry args={[radius, radius, height, 20]} />
    <meshStandardMaterial color={color} metalness={metalness} roughness={0.65} />
  </mesh>
}

function Lamp({ x, z }: { x: number; z: number }) {
  const inward = z < 0 ? 1 : -1
  return <group position={[x, 0.15, z]}>
    <Cylinder position={[0, 0.2, 0]} radius={0.16} height={0.4} color="#7d8986" />
    <Cylinder position={[0, 3.8, 0]} radius={0.06} height={7.4} color="#9ba6a1" metalness={0.7} />
    <Box position={[0, 7.45, inward * 0.8]} size={[0.12, 0.12, 1.7]} color="#8a9791" metalness={0.7} />
    <Box position={[0, 7.4, inward * 1.7]} size={[0.48, 0.18, 0.8]} color="#63746e" />
  </group>
}

function Factory({ x, z, width, height, depth = 6 }: { x: number; z: number; width: number; height: number; depth?: number }) {
  return <group position={[x, 0.2, z]}>
    <Box position={[0, height / 2, 0]} size={[width, height, depth]} color="#d7dfd9" />
    <Box position={[0, 0.2, 0]} size={[width + 0.25, 0.4, depth + 0.25]} color="#b8c4ba" />
    <Box position={[0, height + 0.12, 0]} size={[width + 0.35, 0.24, depth + 0.35]} color="#a7b8b0" />
    <Box position={[0, height * 0.73, depth / 2 + 0.018]} size={[width * 0.88, 0.85, 0.04]} color="#9cb1ac" />
    <Box position={[width * -0.25, 1.5, depth / 2 + 0.025]} size={[3.1, 3, 0.06]} color="#afbbb1" />
    <Box position={[width * 0.22, height + 0.58, 0]} size={[2.4, 0.9, 1.7]} color="#c5d0c6" />
    <Html position={[0, height + 1.2, 0]} center zIndexRange={[2, 0]}><span className="private-map-name" aria-label="건물명 비공개">산단 생산시설</span></Html>
  </group>
}

function PipeRack() {
  return <group position={[-7, 0, -17.1]}>
    {[-9, -3, 3, 9].map(x => <group key={x}>
      {[-1.1, 1.1].map(z => <Box key={z} position={[x, 2.15, z]} size={[0.2, 4.3, 0.2]} color="#a7b5ad" metalness={0.4} />)}
      <Box position={[x, 3.6, 0]} size={[0.2, 0.2, 2.5]} color="#8da198" />
    </group>)}
    {[-0.65, 0, 0.65].map((z, i) => <Cylinder key={z} position={[0, 3.93, z]} radius={0.13 + i * 0.055} height={24} color={['#a2afa6', '#afb4a5', '#8eaaa5'][i]} rotation={[0, 0, Math.PI / 2]} metalness={0.35} />)}
    <Cylinder position={[-2, 2.6, 0.6]} radius={0.1} height={2.8} color="#969f90" metalness={0.3} />
    <Cylinder position={[-1, 3.95, 0.6]} radius={0.1} height={2} color="#969f90" rotation={[0, 0, Math.PI / 2]} metalness={0.3} />
  </group>
}

function ContextBuildings() {
  return <group>
    <Factory x={-22} z={-18.1} width={13} height={5.2} depth={5.2} />
    <Factory x={18} z={-18.2} width={20} height={6.8} depth={5} />
    <Factory x={-24} z={18.4} width={9} height={3.6} depth={4.5} />
    <PipeRack />
    <group position={[22, 0.25, 18.1]}>
      <Box position={[0, 0, 0]} size={[14, 0.3, 5.5]} color="#bbc7bb" />
      {[-4.5, 0, 4.5].map(x => <group key={x}>
        <Cylinder position={[x, 2.2, 0]} radius={1.8} height={4.3} color="#d9e2d9" metalness={0.3} />
        <Cylinder position={[x, 4.38, 0]} radius={1.85} height={0.18} color="#a5b8ae" metalness={0.4} />
        <Cylinder position={[x, 0.28, 0]} radius={1.85} height={0.2} color="#b1c0b3" />
      </group>)}
    </group>
    {[-25, 0, 25].flatMap(x => [-13.5, 13.5].map(z => <Lamp key={`${x}-${z}`} x={x} z={z} />))}
    {[-30, -20, -10, 0, 10, 20, 30].map(x => <group key={x} position={[x, 0.2, 15.25]}>
      <Box position={[0, 0.15, 0]} size={[3.5, 0.3, 1]} color="#afbe9f" />
      <mesh position={[0, 0.8, 0]} scale={[1.65, 0.7, 0.6]}><icosahedronGeometry args={[0.7, 1]} /><meshStandardMaterial color="#9caf94" roughness={1} /></mesh>
    </group>)}
  </group>
}

function Street({ underground, opacity, context, section, ar }: { underground: boolean; opacity: number; context: boolean; section: boolean; ar: boolean }) {
  const roadAlpha = underground ? opacity : 1
  return <group>
    <Box position={[0, -5.25, 0]} size={[64, 0.5, context ? 42 : 29]} color="#a9ae9e" opacity={ar ? 0.18 : 1} />
    <Box position={[0, -4.93, 0]} size={[64, 0.13, context ? 42 : 29]} color="#cab99c" opacity={ar ? 0.16 : 1} />
    {context && <>
      {/* The front soil face is cut away. Back-edge strata retain the road's depth reference. */}
      <Box position={[0, -3.86, -18]} size={[64, 2, 6]} color="#b5ab93" opacity={ar ? 0.16 : 1} />
      <Box position={[0, -2.03, -18]} size={[64, 1.64, 6]} color="#c9baa0" opacity={ar ? 0.15 : 1} />
      <Box position={[0, -0.6, -18]} size={[64, 1.22, 6]} color="#dbceb2" opacity={ar ? 0.15 : 1} />
      {[-1, 1].map(side => <group key={side}>
        <Box position={[0, 0.02, side * 13.25]} size={[64, 0.24, 2.5]} color="#d4dcd0" opacity={underground ? 0.55 : 1} />
        <Box position={[0, 0.055, side * 12.03]} size={[64, 0.3, 0.18]} color="#e1e5d9" opacity={underground ? 0.7 : 1} />
        <Box position={[0, 0.005, side * 17.7]} size={[64, 0.1, 6.6]} color="#bac7b2" opacity={underground ? 0.37 : 1} />
        {[-28, -20, -12, -4, 4, 12, 20, 28].map(x => <Box key={x} position={[x, 0.147, side * 13.25]} size={[0.024, 0.01, 2.42]} color="#b5c1b4" opacity={underground ? 0.45 : 1} />)}
      </group>)}
    </>}
    {!underground && <Box position={[0, -2.5, 0]} size={[64, 4.85, 29]} color="#d4c6aa" />}
    <Box position={[0, -0.1, 0]} size={[64, 0.2, 24]} color={underground ? '#a4b1ad' : '#65716f'} opacity={roadAlpha} />
    {section && <>
      <Box position={[SECTION_X + 0.03, -0.29, 0]} size={[0.04, 0.17, 24]} color="#a4a692" />
      <Box position={[SECTION_X + 0.03, -0.55, 0]} size={[0.04, 0.34, 24]} color="#cfc2a5" opacity={0.62} />
    </>}
    {[-11.75, 11.75].map(z => <Box key={z} position={[0, 0.014, z]} size={[63.8, 0.016, 0.13]} color="#e5e8da" opacity={underground ? 0.3 : 1} />)}
    {[-0.12, 0.12].map(z => <Box key={z} position={[0, 0.016, z]} size={[63.8, 0.018, 0.1]} color="#d8bf7f" opacity={underground ? 0.38 : 1} />)}
    {[-8, -4, 4, 8].flatMap(z => Array.from({ length: 10 }, (_, i) => <Box key={`${z}-${i}`} position={[-29 + i * 6, 0.016, z]} size={[3, 0.014, 0.12]} color="#f0f0e0" opacity={underground ? 0.3 : 1} />))}
    {context && !ar && !section && <ContextBuildings />}
    {context && !ar && !section && <Html position={[23, 0.2, 0]} center zIndexRange={[2, 0]}><span className="private-map-name" aria-label="도로명 비공개">산단 도로명</span></Html>}
  </group>
}

function CameraRig({ view, resetKey, compact, mode, showContext }: Required<Pick<PipeSceneProps, 'view' | 'resetKey' | 'compact' | 'mode' | 'showContext'>>) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size, invalidate } = useThree()
  const aspect = useRef(1)
  aspect.current = size.width / Math.max(1, size.height)
  // Frame the camera only when the requested view changes. A viewport resize (mobile address bar,
  // rotation, fullscreen) keeps the rotation the user already applied.
  useEffect(() => {
    const fit = Math.min(1.45, Math.max(0.65, aspect.current))
    let target = new THREE.Vector3(0, -1.65, 0)
    let direction = new THREE.Vector3(0.86, 0.75, 1.1).normalize()
    let distance = (showContext ? 112 : 98) / fit
    if (compact) distance *= 1.06
    if (mode === 'ar') distance *= 0.9
    if (view === 'top') {
      direction = new THREE.Vector3(0, 1, 0.001).normalize()
      distance = (showContext ? 107 : 96) / fit
    } else if (view === 'section') {
      target = new THREE.Vector3(SECTION_X + 1, -2.1, 0.6)
      direction = new THREE.Vector3(-1, 0.13, 0.05).normalize()
      distance = 52 / fit
    } else if (view === 'crossing') {
      target = new THREE.Vector3(6, -2.8, -3.4)
      direction = new THREE.Vector3(-0.95, 0.45, 1.45).normalize()
      distance = 39 / fit
    }
    camera.position.copy(target.clone().add(direction.multiplyScalar(distance)))
    camera.lookAt(target)
    controls.current?.target.copy(target)
    controls.current?.update()
    invalidate()
  }, [camera, view, resetKey, compact, mode, showContext, invalidate])
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.085} minDistance={4} maxDistance={230} minPolarAngle={0.001} maxPolarAngle={Math.PI * 0.62} zoomSpeed={0.85} rotateSpeed={0.65} panSpeed={0.65} screenSpacePanning />
}

function World({ mode, showPipes, showLabels, surfaceOpacity, view, resetKey, compact, onSelectPipe, showUtilities, showStructures, exploded, selectedId, showContext }: Required<Omit<PipeSceneProps, 'onSelectPipe'>> & Pick<PipeSceneProps, 'onSelectPipe'>) {
  const ar = mode === 'ar'
  const underground = mode !== 'surface'
  const section = view === 'section'
  const { gl, invalidate } = useThree()
  const sectionPlanes = useMemo(() => [new THREE.Plane(new THREE.Vector3(1, 0, 0), -SECTION_X), new THREE.Plane(new THREE.Vector3(-1, 0, 0), SECTION_X + 4)], [])
  useEffect(() => {
    gl.setClearColor('#e8ede7', ar ? 0 : 1)
    gl.clippingPlanes = section ? sectionPlanes : []
    invalidate()
    return () => { gl.clippingPlanes = [] }
  }, [gl, ar, section, sectionPlanes, invalidate])
  const layer = FACILITIES[selectedId]?.layer
  return <>
    {!ar && <color attach="background" args={['#e8ede7']} />}
    <ambientLight intensity={0.85} />
    <hemisphereLight args={['#f8fbf3', '#d2bea0', 1.4]} />
    <directionalLight position={[-24, 48, 16]} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-43} shadow-camera-right={43} shadow-camera-top={35} shadow-camera-bottom={-35} shadow-camera-near={1} shadow-camera-far={105} shadow-normalBias={0.07} shadow-bias={-0.0002} />
    <directionalLight position={[20, 14, -30]} intensity={0.75} color="#edf3ff" />
    {!ar && !section && <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5.54, 0]} receiveShadow><planeGeometry args={[500, 500]} /><meshStandardMaterial color="#e8ede7" roughness={1} /></mesh>
      <gridHelper args={[160, 40, '#d5ddd4', '#dde4da']} position={[0, -5.528, 0]} />
    </>}
    <Street underground={underground} opacity={ar ? Math.min(surfaceOpacity, 0.1) : surfaceOpacity} context={showContext} section={section} ar={ar} />
    {underground && <UtilityNetwork showPipes={showPipes} showUtilities={showUtilities} showStructures={showStructures} exploded={exploded} selectedId={selectedId} onSelectPipe={onSelectPipe} section={section} crossing={view === 'crossing'} />}
    {underground && showLabels && (layer === 'gas' ? showPipes : layer === 'utilities' ? showUtilities : showStructures) && <NetworkLabels compact={compact} selectedId={selectedId} exploded={exploded} onSelectPipe={onSelectPipe} section={section} />}
    <CameraRig view={view} resetKey={resetKey} compact={compact} mode={mode} showContext={showContext} />
  </>
}

function Fallback({ onRetry }: { mode?: PipeSceneProps['mode']; onRetry?: () => void }) {
  return <div className="pipe-scene-fallback" role="status">
    <svg viewBox="0 0 620 340" aria-label="다중 배관 단면" role="img">
      <path d="M35 60H585V81H35Z" fill="#89968d" /><path d="M35 81H585V105H35Z" fill="#c8b99a" /><path d="M35 299H585V320H35Z" fill="#b3b59f" />
      {[[88, 146, 9, '#c5a64d'], [135, 159, 8, '#a48ac3'], [182, 165, 12, '#bc9171'], [229, 150, 9, '#ce9270'], [276, 141, 8, '#78a095'], [323, 156, 7, '#bc8595'], [391, 197, 23, '#6dacc2'], [454, 183, 16, '#6eb0a0'], [530, 261, 35, '#9da991']].map(([cx, cy, r, color], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="#344941" stroke={String(color)} strokeWidth={5} />)}
      <text x="38" y="45" fill="#53665b" fontSize="16">도로 단면 · 제품관 / 용수 / 배수</text>
    </svg>
    <strong>3D를 불러오지 못했습니다</strong>
    {onRetry && <button type="button" onClick={onRetry}>다시 불러오기</button>}
  </div>
}

class SceneBoundary extends Component<{ children: ReactNode; mode: PipeSceneProps['mode']; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <Fallback mode={this.props.mode} onRetry={this.props.onRetry} /> : this.props.children }
}

export default function PipeScene({ mode = 'underground', showPipes = true, showZones = false, showLabels = true, surfaceOpacity = 0.07, view = 'perspective', resetKey = 0, compact = false, onSelectPipe, showUtilities = true, showStructures = true, exploded = false, selectedId = 'GP-001', showContext = true }: PipeSceneProps) {
  const [attempt, setAttempt] = useState(0)
  return <div className={`pipe-scene pipe-scene--${mode}${compact ? ' pipe-scene--compact' : ''}`} role="region" aria-label="여수 산단 배관 3D. 6개 제품관, 용수관, 우수·오수관과 전력·통신 관로. 드래그로 회전하고 확대할 수 있습니다.">
    <SceneBoundary key={attempt} mode={mode} onRetry={() => setAttempt(value => value + 1)}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [55, 40, 65], fov: 42, near: 0.08, far: 600 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop="demand" fallback={<Fallback mode={mode} onRetry={() => setAttempt(value => value + 1)} />}>
        <World mode={mode} showPipes={showPipes} showZones={showZones} showLabels={showLabels} surfaceOpacity={Math.max(0, Math.min(1, surfaceOpacity))} view={view} resetKey={resetKey} compact={compact} onSelectPipe={onSelectPipe} showUtilities={showUtilities} showStructures={showStructures} exploded={exploded} selectedId={selectedId} showContext={showContext} />
      </Canvas>
    </SceneBoundary>
  </div>
}
