import { useLayoutEffect, useMemo, useRef } from 'react'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { FACILITIES, PIPE_ROUTES, SECTION_X, type PipeRoute, type Vec3 } from '../network'

export type NetworkProps = {
  showPipes: boolean; showUtilities: boolean; showStructures: boolean
  exploded: boolean; selectedId: string; onSelectPipe?: (id: string) => void
  section?: boolean; crossing?: boolean
}

function roundedPath(points: Vec3[], pipeRadius: number) {
  const p = points.map(point => new THREE.Vector3(...point))
  const path = new THREE.CurvePath<THREE.Vector3>()
  let from = p[0]
  for (let i = 1; i < p.length - 1; i++) {
    const radius = Math.min(Math.max(0.6, pipeRadius * 3), p[i].distanceTo(p[i - 1]) * 0.3, p[i].distanceTo(p[i + 1]) * 0.3)
    const before = p[i].clone().add(p[i - 1].clone().sub(p[i]).normalize().multiplyScalar(radius))
    const after = p[i].clone().add(p[i + 1].clone().sub(p[i]).normalize().multiplyScalar(radius))
    path.add(new THREE.LineCurve3(from, before))
    path.add(new THREE.QuadraticBezierCurve3(before, p[i], after))
    from = after
  }
  path.add(new THREE.LineCurve3(from, p[p.length - 1]))
  return path
}

function Block({ at, size, color, selected = false, opacity = 1 }: { at: Vec3; size: Vec3; color: string; selected?: boolean; opacity?: number }) {
  return <mesh position={at} castShadow={opacity === 1} receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} metalness={0.12} roughness={0.72} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} emissive={selected ? '#a2d4d2' : '#000'} emissiveIntensity={selected ? 0.3 : 0} />
  </mesh>
}

function Collar({ at, radius, axis = 'x', color = '#4e5653', width = 0.12 }: { at: Vec3; radius: number; axis?: 'x' | 'y' | 'z'; color?: string; width?: number }) {
  return <mesh position={at} rotation={axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]} castShadow>
    <cylinderGeometry args={[radius, radius, width, 20]} />
    <meshStandardMaterial color={color} metalness={0.45} roughness={0.55} />
  </mesh>
}

// One draw call for repeated joint sleeves / identification bands on each route.
function RouteBands({ path, route, color, joints = false }: { path: THREE.CurvePath<THREE.Vector3>; route: PipeRoute; color: string; joints?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = Math.max(1, Math.floor(path.getLength() / (joints ? (route.id.startsWith('SW') ? 3 : 6) : 12)))
  useLayoutEffect(() => {
    const object = new THREE.Object3D()
    const up = new THREE.Vector3(0, 1, 0)
    for (let i = 0; i < count; i++) {
      const fraction = (i + (joints ? 0.42 : 0.65)) / count
      object.position.copy(path.getPointAt(fraction))
      object.quaternion.setFromUnitVectors(up, path.getTangentAt(fraction).normalize())
      object.updateMatrix()
      ref.current?.setMatrixAt(i, object.matrix)
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true
  }, [path, count, joints])
  return <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
    <cylinderGeometry args={[route.radius + (joints ? Math.max(0.012, route.radius * 0.1) : 0.007), route.radius + (joints ? Math.max(0.012, route.radius * 0.1) : 0.007), joints ? (route.id.startsWith('SW') ? 0.16 : 0.09) : 0.25, 16]} />
    <meshStandardMaterial color={color} roughness={0.6} metalness={0.16} />
  </instancedMesh>
}

function PipeEnd({ at, radius, direction, color }: { at: Vec3; radius: number; direction: THREE.Vector3; color: string }) {
  const rotation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction), [direction])
  return <group position={at} quaternion={rotation}>
    <mesh><ringGeometry args={[radius * 0.82, radius, 24]} /><meshStandardMaterial color={color} metalness={0.35} roughness={0.5} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 0, -0.015]}><circleGeometry args={[radius * 0.82, 24]} /><meshStandardMaterial color="#283833" roughness={1} side={THREE.DoubleSide} /></mesh>
  </group>
}

function Route({ route, selected, onSelect, section }: { route: PipeRoute; selected: boolean; onSelect: () => void; section?: boolean }) {
  const path = useMemo(() => roundedPath(route.points, route.radius), [route])
  const item = FACILITIES[route.id]
  const p0 = route.points[0]
  const p1 = route.points[route.points.length - 1]
  const crossesSection = p0[0] < SECTION_X && p1[0] > SECTION_X
  const sectionY = p0[1] + (p1[1] - p0[1]) * (SECTION_X - p0[0]) / (p1[0] - p0[0])
  return <group onClick={event => { event.stopPropagation(); onSelect() }}>
    <mesh castShadow>
      <tubeGeometry args={[path, route.points.length > 2 ? 100 : 12, route.radius, route.duct ? 12 : 20, false]} />
      <meshStandardMaterial color={selected ? item.color : item.bodyColor || item.color} metalness={route.id.startsWith('SW') ? 0.02 : 0.3} roughness={0.58} emissive={selected ? item.color : '#000'} emissiveIntensity={selected ? 0.28 : 0} side={THREE.DoubleSide} />
    </mesh>
    {!route.duct && <RouteBands path={path} route={route} color={route.id.startsWith('SW') ? '#a3aa98' : '#45514d'} joints />}
    {!route.duct && !route.id.startsWith('SW') && <RouteBands path={path} route={route} color={item.color} />}
    <PipeEnd at={p0} radius={route.radius} direction={path.getTangent(0).negate()} color={item.color} />
    <PipeEnd at={p1} radius={route.radius} direction={path.getTangent(1)} color={item.color} />
    {section && crossesSection && <PipeEnd at={[SECTION_X + 0.006, sectionY, p0[2]]} radius={route.radius} direction={new THREE.Vector3(-1, 0, 0)} color={selected ? '#e7cf84' : item.color} />}
  </group>
}

function Valve({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return <group position={[-13, -1.85, -8.5]} onClick={event => { event.stopPropagation(); onSelect() }}>
    <Collar at={[0, 0, 0]} radius={0.22} width={0.38} axis="z" color={selected ? '#ceba75' : '#7d827a'} />
    {[-0.3, 0.3].map(z => <group key={z}>
      <Collar at={[0, 0, z]} radius={0.25} width={0.1} axis="z" color="#abb1a3" />
      {Array.from({ length: 8 }, (_, i) => <Collar key={i} at={[Math.cos(i * Math.PI / 4) * 0.21, Math.sin(i * Math.PI / 4) * 0.21, z]} radius={0.019} axis="z" width={0.15} color="#48504d" />)}
    </group>)}
    <Collar at={[0, 0.28, 0]} radius={0.13} width={0.34} axis="y" color="#7d827a" />
    <Collar at={[0, 0.88, 0]} radius={0.032} width={1.04} axis="y" color="#acb6aa" />
    <mesh position={[0, 1.43, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.28, 0.035, 8, 24]} /><meshStandardMaterial color="#926650" /></mesh>
    <Block at={[0, 1.43, 0]} size={[0.54, 0.035, 0.035]} color="#926650" />
    <Block at={[0, 1.43, 0]} size={[0.035, 0.035, 0.54]} color="#926650" />
  </group>
}

function Structures({ exploded, selectedId, onSelectPipe }: Pick<NetworkProps, 'exploded' | 'selectedId' | 'onSelectPipe'>) {
  const lift = exploded ? 4.2 : 0
  const select = (id: string) => (event: { stopPropagation: () => void }) => { event.stopPropagation(); onSelectPipe?.(id) }
  return <group>
    <group onClick={select('PL-001')}>
      {[-2.1, 0, 2.1].flatMap(x => [-6.5, -4.1, -1.7].map(z => <group key={`${x}-${z}`} position={[x, -0.95 + lift, z]}>
        <Block at={[0, 0, 0]} size={[2, 0.18, 2.3]} color="#abb0a5" selected={selectedId === 'PL-001'} />
        {[-0.66, 0.66].map(xx => <mesh key={xx} position={[xx, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.08, 0.018, 5, 10, Math.PI]} /><meshStandardMaterial color="#666f67" /></mesh>)}
        <Block at={[0, 0.096, 0]} size={[0.12, 0.01, 1.8]} color="#c2ae75" />
      </group>))}
    </group>
    <group onClick={select('PL-002')}>
      {[11.1, 13.2].map(x => <group key={x} position={[x, 0.13 + (exploded ? 3.4 : 0), -3.8]}>
        <Block at={[0, 0, 0]} size={[2, 0.18, 8.8]} color="#75858b" selected={selectedId === 'PL-002'} />
        {[-0.7, 0, 0.7].map(xx => <Block key={xx} at={[xx, -0.23, 0]} size={[0.1, 0.3, 8.55]} color="#526069" />)}
        {[-0.92, 0.92].map(xx => <Block key={xx} at={[xx, 0.098, 0]} size={[0.08, 0.01, 8.6]} color="#bfa776" />)}
        {[-3, -1.5, 0, 1.5, 3].map(z => <Block key={z} at={[0, 0.097, z]} size={[1.82, 0.012, 0.025]} color="#9aa8a9" />)}
      </group>)}
      {[-8.35, 0.75].map(z => <Block key={z} at={[13.2, -0.22, z]} size={[7, 0.32, 0.24]} color="#647178" />)}
    </group>
    <group onClick={select('SH-001')}>
      {[-8.55, 0.95].flatMap(z => [10.2, 12.5, 14.8, 17.1].map(x => <group key={`${x}-${z}`} position={[x, -1.85, z + (exploded ? (z < 0 ? -1.1 : 1.1) : 0)]}>
        <Block at={[0, 0, 0]} size={[2.22, 3.6, 0.08]} color="#9a8d7a" selected={selectedId === 'SH-001'} />
        {[-1.02, 1.02].map(xx => <Block key={xx} at={[xx, 0, 0]} size={[0.15, 3.7, 0.2]} color="#68716a" />)}
        {[-0.9, 0.9].map(y => <Block key={y} at={[0, y, z < 0 ? 0.15 : -0.15]} size={[2.25, 0.15, 0.22]} color="#68716a" />)}
      </group>))}
      {[10.2, 17.1].map(x => <Block key={x} at={[x, -0.52, -3.8]} size={[0.2, 0.2, 9.5]} color="#758075" />)}
    </group>
    <group onClick={select('V-001')}>
      <Block at={[-13, -2.35, -8.5]} size={[2.3, 0.2, 2]} color="#a5afa4" />
      {[-1, 1].map(side => <Block key={side} at={[-13 + side * 1.1, -1.1, -8.5]} size={[0.15, 2.3, 2]} color="#b3bbae" />)}
      <Block at={[-13, -0.66, -9.48]} size={[2.15, 1.25, 0.15]} color="#a5b0a4" />
      <Block at={[-13, 0.12 + (exploded ? 2.3 : 0), -8.5]} size={[2.35, 0.16, 2]} color="#a1aaa0" />
      <Collar at={[-13, 0.23 + (exploded ? 2.3 : 0), -8.5]} radius={0.62} width={0.07} axis="y" color="#616e68" />
    </group>
    <group position={[20, 0, 9.35]} onClick={select('MH-001')}>
      <mesh position={[0, -2.365, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[1.18, 1.18, 4.77, 24, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color={selectedId === 'MH-001' ? '#c4d3c7' : '#a5afa2'} roughness={0.88} side={THREE.DoubleSide} />
      </mesh>
      <Collar at={[0, -4.88, 0]} radius={1.22} width={0.18} axis="y" color="#a5afa2" />
      <Collar at={[0, 0.07 + (exploded ? 2.7 : 0), 0]} radius={1.22} width={0.18} axis="y" color="#a5afa2" />
      <Collar at={[0, 0.19 + (exploded ? 2.7 : 0), 0]} radius={0.58} width={0.08} axis="y" color="#65756b" />
      {Array.from({ length: 9 }, (_, i) => <Block key={i} at={[-0.79, -0.4 - i * 0.42, 0]} size={[0.12, 0.035, 0.54]} color="#6e7b72" />)}
    </group>
  </group>
}

function SectionScale() {
  return <group>
    <Line points={[[SECTION_X + 0.05, 0, 15], [SECTION_X + 0.05, -5, 15]]} color="#849185" lineWidth={1} />
    {[0, 1, 2, 3, 4, 5].map(d => <group key={d}>
      <Line points={[[SECTION_X + 0.05, -d, 14.8], [SECTION_X + 0.05, -d, 15.35]]} color="#849185" lineWidth={1} />
      <Html position={[SECTION_X + 0.05, -d, 16.1]} center zIndexRange={[3, 0]}><span className="section-depth-label">{d === 0 ? '지표 0' : `−${d}`} m</span></Html>
    </group>)}
  </group>
}

export default function UtilityNetwork(props: NetworkProps) {
  const { showPipes, showUtilities, showStructures, selectedId, onSelectPipe, section, crossing } = props
  return <group>
    {PIPE_ROUTES.filter(r => FACILITIES[r.id].layer === 'gas' ? showPipes : showUtilities).map((route, i) => <Route key={`${route.id}-${i}`} route={route} selected={selectedId === route.id} onSelect={() => onSelectPipe?.(route.id)} section={section} />)}
    {showUtilities && <>
      <Block at={[0, -1.05, -10.25]} size={[64, 0.7, 1.05]} color="#b5b6aa" opacity={0.14} />
      <Block at={[0, -0.7, 13]} size={[64, 0.48, 0.48]} color="#b5b6aa" opacity={0.12} />
    </>}
    {showPipes && <Valve selected={selectedId === 'V-001'} onSelect={() => onSelectPipe?.('V-001')} />}
    {showStructures && <Structures {...props} />}
    {section && <SectionScale />}
    {crossing && showPipes && showUtilities && <group>
      <Line points={[[6.5, -2.5, -4.1], [6.5, -3.25, -4.1]]} color="#315f5a" lineWidth={2} />
      {[-2.5, -3.25].map(y => <Line key={y} points={[[6.23, y, -4.1], [6.77, y, -4.1]]} color="#315f5a" lineWidth={2} />)}
      <Html position={[7.4, -2.87, -4.1]} center zIndexRange={[5, 0]}><span className="crossing-clearance">순이격 <b>0.75 m</b></span></Html>
    </group>}
  </group>
}

export function NetworkLabels({ selectedId, exploded, onSelectPipe, compact, section }: Pick<NetworkProps, 'selectedId' | 'exploded' | 'onSelectPipe' | 'section'> & { compact: boolean }) {
  const item = FACILITIES[selectedId] ?? FACILITIES['GP-001']
  const position: Vec3 = [...item.anchor]
  if (section) {
    const route = PIPE_ROUTES.find(r => r.id === selectedId && r.points[0][0] < SECTION_X && r.points[r.points.length - 1][0] > SECTION_X)
    if (!route) return null
    position[0] = SECTION_X + 0.1
    position[1] = -item.depth
    position[2] = route.points[0][2]
  }
  position[1] += 0.45 + (exploded && selectedId === 'PL-001' ? 4.2 : exploded && selectedId === 'PL-002' ? 3.4 : 0)
  return <Html position={position} center zIndexRange={[12, 0]}>
    <button className={`pipe-scene-label${compact ? ' pipe-scene-label--compact' : ''}${item.dimensions ? ' pipe-scene-label--structure' : ''}`} onClick={() => onSelectPipe?.(selectedId)} aria-label={`${item.kind} ${selectedId} 상세 정보`}>
      <span className="pipe-scene-label__title"><i style={{ background: item.color }} />{item.kind}<span>{selectedId}</span></span>
      <span className="pipe-scene-label__rule" />
      <span className="pipe-scene-label__details"><span><span>{item.layer === 'structures' ? '깊이' : '중심 깊이'}</span><b>{item.depth.toFixed(2)} m</b></span><span><span>{item.dimensions ? '규격' : '관경'}</span><b>{item.dimensions || `${item.diameter} mm`}</b></span></span>
    </button>
  </Html>
}
