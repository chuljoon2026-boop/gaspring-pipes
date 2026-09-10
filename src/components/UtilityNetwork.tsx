import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { FACILITIES, PIPE_ROUTES, type Vec3 } from '../network'

export type NetworkProps = {
  showPipes: boolean; showUtilities: boolean; showStructures: boolean
  exploded: boolean; selectedId: string; onSelectPipe?: (id: string) => void
}

function roundedPath(points: Vec3[]) {
  const p = points.map(point => new THREE.Vector3(...point))
  const path = new THREE.CurvePath<THREE.Vector3>()
  let from = p[0]
  for (let i = 1; i < p.length - 1; i++) {
    const radius = Math.min(0.45, p[i].distanceTo(p[i-1]) * 0.28, p[i].distanceTo(p[i+1]) * 0.28)
    const before = p[i].clone().add(p[i-1].clone().sub(p[i]).normalize().multiplyScalar(radius))
    const after = p[i].clone().add(p[i+1].clone().sub(p[i]).normalize().multiplyScalar(radius))
    path.add(new THREE.LineCurve3(from, before))
    path.add(new THREE.QuadraticBezierCurve3(before, p[i], after))
    from = after
  }
  path.add(new THREE.LineCurve3(from, p[p.length-1]))
  return path
}

function Block({ at, size, color, selected = false }: { at: Vec3; size: Vec3; color: string; selected?: boolean }) {
  return <mesh position={at} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} metalness={0.5} roughness={0.58} emissive={selected ? '#4ba4a5' : '#000'} emissiveIntensity={0.25} />
  </mesh>
}

function Collar({ at, radius, axis = 'x', color = '#394a4a', width = 0.12 }: { at: Vec3; radius: number; axis?: 'x'|'y'|'z'; color?: string; width?: number }) {
  return <mesh position={at} rotation={axis === 'x' ? [0,0,Math.PI/2] : axis === 'z' ? [Math.PI/2,0,0] : [0,0,0]} castShadow>
    <cylinderGeometry args={[radius,radius,width,16]} />
    <meshStandardMaterial color={color} metalness={0.5} roughness={0.45} />
  </mesh>
}

function Route({ route, selected, onSelect }: { route: typeof PIPE_ROUTES[number]; selected: boolean; onSelect: () => void }) {
  const path = useMemo(() => roundedPath(route.points), [route])
  const color = FACILITIES[route.id].color
  return <group onClick={event => { event.stopPropagation(); onSelect() }}>
    <mesh castShadow>
      <tubeGeometry args={[path,96,route.radius,16,false]} />
      <meshStandardMaterial color={color} metalness={route.id === 'GP-004' ? 0.05 : 0.35} roughness={0.42} emissive={selected ? color : '#000'} emissiveIntensity={selected ? 0.28 : 0} />
    </mesh>
    {route.id === 'GP-001' && [-8,-5,-2,1,3.5].map(x => <Collar key={x} at={[x,-1.2,0.5]} radius={0.163} width={0.18} />)}
    {route.id === 'SW-001' && [-8,-5,-2,1,4,7].map(x => <Collar key={x} at={[x,-1.9,1.85]} radius={0.26} color="#73867b" width={0.22} />)}
    {route.id === 'WP-001' && [-7.5,-4.5,0,3.5,6.5].map(x => <Collar key={x} at={[x,-1.65,-1.05]} radius={0.16} color="#317b9b" width={0.18} />)}
    {route.id === 'GP-002' && <Collar at={[-1.6,-1.2,-0.5]} radius={0.12} axis="z" />}
    {route.id === 'GP-004' && <Collar at={[-6.3,-1.2,1]} radius={0.075} axis="z" color="#454d45" width={0.3} />}
  </group>
}

function Valve({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return <group position={[-1.6,-1.2,-1.85]} onClick={event => { event.stopPropagation(); onSelect() }}>
    <Collar at={[0,0,0]} radius={0.18} width={0.32} axis="z" color={selected ? '#ffb453' : '#9b8137'} />
    {[-0.23,0.23].map(z => <group key={z}>
      <Collar at={[0,0,z]} radius={0.21} width={0.09} axis="z" color="#d4ad59" />
      {Array.from({length:6},(_,i) => <Collar key={i} at={[Math.cos(i*Math.PI/3)*0.17,Math.sin(i*Math.PI/3)*0.17,z]} radius={0.018} axis="z" width={0.16} color="#505955" />)}
    </group>)}
    <Collar at={[0,0.19,0]} radius={0.12} width={0.32} axis="y" color="#b19b57" />
    <Collar at={[0,0.43,0]} radius={0.027} width={0.3} axis="y" color="#abb7b2" />
    <mesh position={[0,0.6,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.24,0.035,8,24]} /><meshStandardMaterial color="#ca5946" /></mesh>
    <Block at={[0,0.6,0]} size={[0.46,0.025,0.025]} color="#ca5946" />
    <Block at={[0,0.6,0]} size={[0.025,0.025,0.46]} color="#ca5946" />
  </group>
}

function Structures({ exploded, selectedId, onSelectPipe }: Pick<NetworkProps,'exploded'|'selectedId'|'onSelectPipe'>) {
  const lift = exploded ? 2.25 : 0
  const select = (id: string) => (event: {stopPropagation: () => void}) => { event.stopPropagation(); onSelectPipe?.(id) }
  return <group>
    <group onClick={select('PL-001')}>
      {[-4.3,-2.55,-0.8,0.95,2.7].map(x => <group key={x} position={[x,-0.62+lift,0.5]}>
        <Block at={[0,0,0]} size={[1.55,0.06,0.95]} color="#7d9fa5" selected={selectedId==='PL-001'} />
        {[-0.6,0.6].map(xx => <Block key={xx} at={[xx,-0.075,0]} size={[0.055,0.09,0.86]} color="#526f78" />)}
        <Block at={[0,0.034,0]} size={[1.48,0.009,0.08]} color="#e7b345" />
        {[-0.56,0.56].flatMap(xx => [-0.34,0.34].map(z => <Collar key={`${xx}-${z}`} at={[xx,0.04,z]} radius={0.026} width={0.025} axis="y" color="#c8d4d1" />))}
      </group>)}
    </group>
    <group position={[-7.8,0.12+(exploded?1.5:0),0]} onClick={select('PL-002')}>
      <Block at={[0,0,0]} size={[2.1,0.12,5.2]} color="#748690" selected={selectedId==='PL-002'} />
      {[-0.8,-0.4,0,0.4,0.8].map(x => <Block key={x} at={[x,-0.17,0]} size={[0.07,0.24,4.9]} color="#52616c" />)}
      {[-0.96,0.96].map(x => <Block key={x} at={[x,0.069,0]} size={[0.08,0.016,5.05]} color="#d8b34f" />)}
      {Array.from({length:13},(_,i) => <Block key={i} at={[0,0.065,-2.4+i*0.4]} size={[1.85,0.01,0.02]} color="#96a5aa" />)}
    </group>
    <group onClick={select('SH-001')}>
      {[-1,1].flatMap(side => [-5.2,-2.8,-0.4,2,4.4].map(x => <group key={`${side}-${x}`} position={[x,-1.15,side*(2.7+(exploded?0.7:0))]}>
        <Block at={[0,0,0]} size={[2.25,2.1,0.065]} color={side===1?'#ad9981':'#9e8c76'} selected={selectedId==='SH-001'} />
        {[-0.94,0,0.94].map(xx => <Block key={xx} at={[xx,0,-side*0.08]} size={[0.075,2.16,0.13]} color="#6e756c" />)}
        {[-0.68,0.68].map(y => <Block key={y} at={[0,y,-side*0.17]} size={[2.32,0.09,0.15]} color="#6e756c" />)}
      </group>))}
    </group>
    {/* Open valve chamber: walls stop below the wheel; the cover sits beside it. */}
    <Block at={[-1.6,-1.68,-1.85]} size={[1.28,0.12,1.25]} color="#aab3ac" />
    {[-1,1].map(side => <Block key={side} at={[-1.6+side*0.64,-1.12,-1.85]} size={[0.1,1.15,1.25]} color="#b8c0b7" />)}
    <Block at={[-1.6,-0.06,-3.25]} size={[1.25,0.12,1.2]} color="#8b9690" />
  </group>
}

export default function UtilityNetwork(props: NetworkProps) {
  const {showPipes,showUtilities,showStructures,selectedId,onSelectPipe} = props
  return <group>
    {PIPE_ROUTES.filter(r => FACILITIES[r.id].layer==='gas' ? showPipes : showUtilities).map((route,i) => <Route key={`${route.id}-${i}`} route={route} selected={selectedId===route.id} onSelect={() => onSelectPipe?.(route.id)} />)}
    {showPipes && <Valve selected={selectedId==='V-001'} onSelect={() => onSelectPipe?.('V-001')} />}
    {showStructures && <Structures {...props} />}
  </group>
}

export function NetworkLabels({ selectedId, exploded, onSelectPipe, compact }: Pick<NetworkProps,'selectedId'|'exploded'|'onSelectPipe'> & {compact: boolean}) {
  const item = FACILITIES[selectedId] ?? FACILITIES['GP-001']
  const position: Vec3 = [...item.anchor]
  position[1] += 0.65 + (exploded && selectedId==='PL-001' ? 2.25 : exploded && selectedId==='PL-002' ? 1.5 : 0)
  return <Html position={position} center zIndexRange={[12,0]}>
    <button className={`pipe-scene-label${compact?' pipe-scene-label--compact':''}${item.dimensions?' pipe-scene-label--structure':''}`} onClick={() => onSelectPipe?.(selectedId)} aria-label={selectedId==='GP-001'?'가스 주배관 GP-001 상세 정보':`${item.kind} ${selectedId} 상세 정보`}>
      <span className="pipe-scene-label__title"><i style={{background:item.color}} />{item.kind}<span>{selectedId}</span></span>
      <span className="pipe-scene-label__rule" />
      <span className="pipe-scene-label__details"><span><span>깊이</span><b>{item.depth} m</b></span><span><span>{item.dimensions ? '규격' : '직경'}</span><b>{item.dimensions || `${item.diameter} mm`}</b></span></span>
    </button>
  </Html>
}
