import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import './PipeScene.css';

export interface PipeSceneProps {
  mode?: 'surface' | 'underground' | 'ar';
  showPipes?: boolean;
  showZones?: boolean;
  showLabels?: boolean;
  surfaceOpacity?: number;
  view?: 'perspective' | 'top';
  resetKey?: number;
  compact?: boolean;
  onSelectPipe?: (id: string) => void;
}

type Vec3 = [number, number, number];
const PIPE_Y = -1.2;
const PIPE_COLOR = '#ffb631';
const PIPE_DARK = '#b7750c';

function Box({ position, size, color, opacity = 1, metalness = 0, roughness = 0.75, rotation }: {
  position: Vec3; size: Vec3; color: string; opacity?: number; metalness?: number; roughness?: number; rotation?: Vec3;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={opacity === 1} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} metalness={metalness} roughness={roughness} depthWrite={opacity >= 0.99} />
    </mesh>
  );
}

function Cylinder({ position, radius, height, color, rotation, opacity = 1, metalness = 0.1 }: {
  position: Vec3; radius: number; height: number; color: string; rotation?: Vec3; opacity?: number; metalness?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={opacity === 1} receiveShadow>
      <cylinderGeometry args={[radius, radius, height, 20]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={0.42} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
    </mesh>
  );
}

function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0.12, z]} scale={scale}>
      <Box position={[0, 0.03, 0]} size={[0.95, 0.08, 0.95]} color="#b5c4ac" />
      <Cylinder position={[0, 0.68, 0]} radius={0.065} height={1.3} color="#8c7967" />
      {[[0, 1.65, 0, 0.64], [-0.3, 1.42, 0.08, 0.48], [0.33, 1.45, -0.08, 0.5]].map(([tx, ty, tz, radius], i) => (
        <mesh key={i} position={[tx, ty, tz]} castShadow scale={[1, 1.15, 1]}>
          <icosahedronGeometry args={[radius, 2]} />
          <meshStandardMaterial color={['#7e9d75', '#92aa83', '#6f9069'][i]} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Lamp({ x, z, flip = false }: { x: number; z: number; flip?: boolean }) {
  const direction = flip ? -1 : 1;
  return (
    <group position={[x, 0.12, z]}>
      <Cylinder position={[0, 0.06, 0]} radius={0.13} height={0.12} color="#657278" />
      <Cylinder position={[0, 1.64, 0]} radius={0.036} height={3.2} color="#78868b" metalness={0.65} />
      <Box position={[0, 3.18, direction * 0.4]} size={[0.055, 0.06, 0.8]} color="#78868b" metalness={0.65} />
      <Box position={[0, 3.15, direction * 0.8]} size={[0.25, 0.09, 0.48]} color="#546268" metalness={0.65} />
      <Box position={[0, 3.1, direction * 0.8]} size={[0.2, 0.02, 0.35]} color="#f5f0d8" />
    </group>
  );
}

function Building({ position, width, depth, height, industrial = false }: {
  position: Vec3; width: number; depth: number; height: number; industrial?: boolean;
}) {
  const windowCount = Math.max(2, Math.floor(width / 0.75));
  return (
    <group position={position}>
      <Box position={[0, height / 2, 0]} size={[width, height, depth]} color={industrial ? '#e5e9e8' : '#f2f2ec'} />
      <Box position={[0, 0.09, 0]} size={[width + 0.16, 0.18, depth + 0.16]} color="#ccd4d1" />
      <Box position={[0, height + 0.035, 0]} size={[width + 0.12, 0.14, depth + 0.12]} color="#d0d8d5" />
      <Box position={[0, height + 0.12, 0]} size={[width - 0.16, 0.04, depth - 0.16]} color="#b9c8c6" />
      <Box position={[width * 0.2, height + 0.31, -depth * 0.12]} size={[0.85, 0.38, 0.7]} color="#eef1ed" />
      {[0, 1, 2].map(i => <Box key={i} position={[width * 0.2 - 0.25 + i * 0.25, height + 0.505, -depth * 0.12]} size={[0.11, 0.016, 0.48]} color="#9caeaa" />)}
      {Array.from({ length: industrial ? 1 : 2 }, (_, floor) => Array.from({ length: windowCount }, (_, i) => (
        <group key={`${floor}-${i}`} position={[-width / 2 + (i + 0.5) * width / windowCount, height * (industrial ? 0.73 : 0.38 + floor * 0.33), depth / 2 + 0.015]}>
          <Box position={[0, 0, 0]} size={[width / windowCount * 0.64, 0.5, 0.04]} color="#9aafb3" metalness={0.25} roughness={0.3} />
          <Box position={[0, 0, 0.025]} size={[0.025, 0.5, 0.025]} color="#e6eae7" />
          <Box position={[0, -0.255, 0.03]} size={[width / windowCount * 0.72, 0.045, 0.1]} color="#d0d8d5" />
        </group>
      )))}
      {industrial && <>
        <Box position={[0, 0.68, depth / 2 + 0.025]} size={[width * 0.36, 1.18, 0.05]} color="#a2b0ad" />
        {Array.from({ length: 7 }, (_, i) => <Box key={i} position={[0, 0.2 + i * 0.15, depth / 2 + 0.055]} size={[width * 0.36, 0.012, 0.012]} color="#839692" />)}
        <Box position={[0, 1.39, depth / 2 + 0.17]} size={[width * 0.42, 0.055, 0.45]} color="#748b85" metalness={0.3} />
      </>}
      <Box position={[width / 2 + 0.02, height * 0.55, 0]} size={[0.04, 0.65, depth * 0.55]} color="#a9babb" metalness={0.2} />
    </group>
  );
}

function Cone({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.05, z]}>
      <Box position={[0, 0.03, 0]} size={[0.32, 0.06, 0.32]} color="#465051" />
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.11, 0.44, 16]} />
        <meshStandardMaterial color="#f27738" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.052, 0.069, 0.09, 16]} />
        <meshStandardMaterial color="#fff8ed" />
      </mesh>
    </group>
  );
}

function Barrier({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.05, z]}>
      {[-0.48, 0.48].map(xx => <group key={xx}>
        <Box position={[xx, 0.31, 0]} size={[0.035, 0.62, 0.04]} color="#6a7674" />
        <Box position={[xx, 0.03, 0]} size={[0.12, 0.05, 0.4]} color="#63716f" />
      </group>)}
      <Box position={[0, 0.48, 0]} size={[1.22, 0.27, 0.05]} color="#f2b63d" />
      {[-0.45, -0.15, 0.15, 0.45].map(xx => <Box key={xx} position={[xx, 0.48, 0.029]} size={[0.105, 0.26, 0.008]} color="#56615f" rotation={[0, 0, -0.36]} />)}
    </group>
  );
}

function Flange({ x, z = 0.5, alongZ = false }: { x: number; z?: number; alongZ?: boolean }) {
  return (
    <group position={[x, PIPE_Y, z]} rotation={alongZ ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      {[-0.065, 0.065].map(offset => <Cylinder key={offset} position={[offset, 0, 0]} radius={0.23} height={0.074} color={PIPE_COLOR} rotation={[0, 0, Math.PI / 2]} metalness={0.55} />)}
      <Cylinder position={[0, 0, 0]} radius={0.21} height={0.038} color="#514b36" rotation={[0, 0, Math.PI / 2]} metalness={0.5} />
      {Array.from({ length: 8 }, (_, i) => {
        const angle = i * Math.PI / 4;
        return <Cylinder key={i} position={[0, Math.sin(angle) * 0.191, Math.cos(angle) * 0.191]} radius={0.026} height={0.22} color="#777c75" rotation={[0, 0, Math.PI / 2]} metalness={0.85} />;
      })}
    </group>
  );
}

function PipeNetwork({ onSelectPipe }: { onSelectPipe?: (id: string) => void }) {
  const mainPath = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    path.add(new THREE.LineCurve3(new THREE.Vector3(-9.4, PIPE_Y, 0.5), new THREE.Vector3(3.8, PIPE_Y, 0.5)));
    path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(3.8, PIPE_Y, 0.5), new THREE.Vector3(5.1, PIPE_Y, 0.5), new THREE.Vector3(5.1, PIPE_Y, -0.8)));
    path.add(new THREE.LineCurve3(new THREE.Vector3(5.1, PIPE_Y, -0.8), new THREE.Vector3(5.1, PIPE_Y, -2.68)));
    return path;
  }, []);
  return (
    <group>
      <mesh onClick={event => { event.stopPropagation(); onSelectPipe?.('GP-001'); }} castShadow>
        <tubeGeometry args={[mainPath, 160, 0.15, 20, false]} />
        <meshStandardMaterial color={PIPE_COLOR} metalness={0.48} roughness={0.3} />
      </mesh>
      <mesh position={[-1.6, PIPE_Y, -0.98]} rotation={[Math.PI / 2, 0, 0]} castShadow onClick={event => { event.stopPropagation(); onSelectPipe?.('GP-002'); }}>
        <cylinderGeometry args={[0.1, 0.1, 2.96, 20]} />
        <meshStandardMaterial color={PIPE_COLOR} metalness={0.48} roughness={0.3} />
      </mesh>
      {[-7.7, -4.1, 0.8, 3.45].map(x => <Flange key={x} x={x} />)}
      <Flange x={5.1} z={-1.76} alongZ />
      <Flange x={-1.6} z={-1.18} alongZ />
      <Cylinder position={[-1.6, PIPE_Y, 0.5]} radius={0.185} height={0.52} color={PIPE_COLOR} rotation={[0, 0, Math.PI / 2]} metalness={0.55} />
      <group position={[-1.6, PIPE_Y, -1.85]} onClick={event => { event.stopPropagation(); onSelectPipe?.('V-001'); }}>
        <Cylinder position={[0, 0, 0]} radius={0.18} height={0.35} color={PIPE_DARK} rotation={[Math.PI / 2, 0, 0]} metalness={0.6} />
        <Cylinder position={[0, 0.19, 0]} radius={0.14} height={0.32} color={PIPE_COLOR} metalness={0.55} />
        <Box position={[0, 0.32, 0]} size={[0.33, 0.08, 0.28]} color={PIPE_COLOR} metalness={0.55} />
        <Cylinder position={[0, 0.48, 0]} radius={0.034} height={0.28} color="#848b85" metalness={0.9} />
        <mesh position={[0, 0.61, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.255, 0.034, 8, 32]} />
          <meshStandardMaterial color="#d85737" metalness={0.6} roughness={0.35} />
        </mesh>
        {[0, Math.PI / 3, Math.PI * 2 / 3].map(angle => <Box key={angle} position={[0, 0.61, 0]} size={[0.47, 0.024, 0.024]} color="#cb5237" metalness={0.6} rotation={[0, angle, 0]} />)}
      </group>
      {[-8.9, -6.2, -3.2, 0, 2.8].map(x => <group key={x}>
        <Box position={[x, -2.005, 0.5]} size={[0.55, 0.18, 0.7]} color="#a4b1a8" />
        <Box position={[x, -1.62, 0.5]} size={[0.17, 0.6, 0.2]} color="#9aa89e" />
        <Cylinder position={[x, PIPE_Y, 0.5]} radius={0.162} height={0.065} color="#8d8c65" rotation={[0, 0, Math.PI / 2]} metalness={0.65} />
      </group>)}
    </group>
  );
}

function Street({ underground, opacity, ar }: { underground: boolean; opacity: number; ar: boolean }) {
  return (
    <group>
      <Box position={[0, -2.46, 0]} size={[20, 0.38, 13]} color="#a4ac9a" opacity={ar ? 0.35 : 1} />
      <Box position={[0, -2.21, 0]} size={[20, 0.12, 13]} color="#c4ab84" opacity={ar ? 0.3 : 1} />
      {[-1, 1].map(side => <group key={side}>
        <Box position={[0, -1.73, side * 4.67]} size={[20, 0.82, 3.66]} color="#bda789" opacity={ar ? 0.28 : 1} />
        <Box position={[0, -0.8, side * 4.67]} size={[20, 1.06, 3.66]} color="#d4c4a8" opacity={ar ? 0.25 : 1} />
        <Box position={[0, -0.2, side * 4.67]} size={[20, 0.15, 3.66]} color="#c4c6b7" opacity={ar ? 0.4 : 1} />
      </group>)}
      {!underground && <Box position={[0, -1.1, 0]} size={[20, 2.08, 5.68]} color="#d3cdb8" />}
      <Box position={[0, -0.065, 0]} size={[20, 0.13, 5.7]} color={underground ? '#b2bcc0' : '#69767b'} opacity={underground ? opacity : 1} />
      {[-1, 1].map(side => <group key={side}>
        <Box position={[0, 0.025, side * 3.03]} size={[20, 0.19, 0.33]} color="#eef0e7" opacity={ar ? 0.7 : 1} />
        <Box position={[0, 0.015, side * 3.75]} size={[20, 0.17, 1.12]} color="#dde1d8" opacity={ar ? 0.45 : 1} />
        <Box position={[0, -0.005, side * 5.4]} size={[20, 0.12, 2.17]} color="#bdcbb5" opacity={ar ? 0.25 : 1} />
        {Array.from({ length: 25 }, (_, i) => <Box key={i} position={[-9.6 + i * 0.8, 0.104, side * 3.75]} size={[0.013, 0.005, 1.1]} color="#c0c8bf" opacity={ar ? 0.4 : 1} />)}
        <Box position={[0, 0.006, side * 2.57]} size={[19.8, 0.012, 0.08]} color="#ececd9" opacity={underground ? 0.5 : 1} />
      </group>)}
      {[-0.06, 0.06].map(z => <Box key={z} position={[0, 0.008, z]} size={[19.8, 0.012, 0.045]} color="#f1c66e" opacity={underground ? 0.55 : 1} />)}
      {[-1.34, 1.34].map(z => Array.from({ length: 11 }, (_, i) => <Box key={`${z}-${i}`} position={[-9 + i * 1.8, 0.011, z]} size={[0.82, 0.012, 0.055]} color="#eaf0e9" opacity={underground ? 0.5 : 1} />))}
      {Array.from({ length: 8 }, (_, i) => <Box key={i} position={[6.55, 0.014, -2.25 + i * 0.64]} size={[1.35, 0.012, 0.29]} color="#e9ede5" opacity={underground ? 0.48 : 1} />)}
      {[-7.8, 1.7].map(x => <group key={x}>
        <Box position={[x, 0.123, 3.19]} size={[0.55, 0.013, 0.26]} color="#9ba59e" />
        {Array.from({ length: 7 }, (_, i) => <Box key={i} position={[x - 0.225 + i * 0.075, 0.132, 3.19]} size={[0.025, 0.008, 0.22]} color="#657970" />)}
      </group>)}
      {!ar && <>
        <Building position={[-5.7, 0.09, -5.1]} width={4.8} depth={2.4} height={2.45} industrial />
        <Building position={[1.25, 0.09, -5.1]} width={4.5} depth={2.4} height={3.2} />
        <Building position={[7.4, 0.09, -5.1]} width={2.6} depth={2.4} height={1.9} industrial />
        <group position={[8, 0.16, 5.32]}>
          <Cylinder position={[0, 0.48, 0]} radius={0.68} height={0.96} color="#e1e8e4" metalness={0.35} />
          <Cylinder position={[0, 0.97, 0]} radius={0.71} height={0.06} color="#aabbb6" metalness={0.5} />
          <Cylinder position={[0.88, 0.35, 0]} radius={0.25} height={0.7} color="#d3ded7" metalness={0.5} />
          <Box position={[0, 0.02, 0]} size={[2.55, 0.13, 1.85]} color="#c3cec3" />
        </group>
        {[[-8.7, 4.85], [-5.7, 4.85], [-2.7, 4.85], [0.3, 4.85], [3.3, 4.85], [-9.1, -4.9], [4.6, -5.5]].map(([x, z], i) => <Tree key={i} x={x} z={z} scale={underground && i < 5 ? 0.62 : i === 5 ? 0.8 : 1} />)}
        <Lamp x={-7.5} z={-3.68} />
        <Lamp x={2.4} z={-3.68} />
        <Lamp x={-3.6} z={3.68} flip />
        <Lamp x={8.7} z={3.68} flip />
      </>}
      {[[-5, 1.95], [-3.2, 1.95], [-1.4, 1.95], [0.4, 1.95]].map(([x, z], i) => <Cone key={i} x={x} z={z} />)}
      <Barrier x={-5.95} z={1.08} />
      <Barrier x={1.3} z={1.08} />
      <group position={[-8.35, 0.14, 3.68]}>
        <Cylinder position={[0, 0.55, 0]} radius={0.027} height={1.1} color="#65857c" />
        <Box position={[0, 1.12, 0]} size={[0.63, 0.43, 0.055]} color="#087b69" />
        <Box position={[0, 1.13, 0.029]} size={[0.26, 0.26, 0.012]} color="#f4f7e9" />
        {[[-0.07, 0.07], [0.07, 0.07], [-0.07, -0.07], [0.045, -0.055]].map(([xx, yy], i) => <Box key={i} position={[xx, 1.13 + yy, 0.037]} size={[i === 3 ? 0.065 : 0.075, 0.075, 0.01]} color="#214f44" />)}
      </group>
    </group>
  );
}

function RiskZones() {
  const outline = useMemo(() => new Float32Array([-9.2, -2.04, -0.38, 4.35, -2.04, -0.38, 4.35, -2.04, 1.38, -9.2, -2.04, 1.38, -9.2, -2.04, -0.38]), []);
  return <group>
    <Box position={[-2.425, -1.02, 0.5]} size={[13.55, 2.04, 1.76]} color="#ed8c2a" opacity={0.1} />
    <Box position={[-2.425, -2.035, 0.5]} size={[13.55, 0.025, 1.76]} color="#f0a342" opacity={0.24} />
    <lineLoop>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[outline, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#df8a2b" transparent opacity={0.9} />
    </lineLoop>
    <lineLoop position={[0, 2.065, 0]}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[outline, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#dc8628" transparent opacity={0.8} />
    </lineLoop>
    {[-9.2, 4.35].flatMap(x => [-0.38, 1.38].map(z => <Cylinder key={`${x}-${z}`} position={[x, -1.02, z]} radius={0.013} height={2.04} color="#df8c2c" opacity={0.8} />))}
    {Array.from({ length: 28 }, (_, i) => <Box key={i} position={[-9.04 + i * 0.48, -2.011, 1.15]} size={[0.14, 0.016, 0.4]} color="#d89527" opacity={0.55} rotation={[0, -0.65, 0]} />)}
  </group>;
}

function SceneLabels({ compact, onSelectPipe }: { compact: boolean; onSelectPipe?: (id: string) => void }) {
  return <group>
    <Cylinder position={[-4.1, -0.54, 0.5]} radius={0.012} height={1.22} color="#be801d" />
    <mesh position={[-4.1, PIPE_Y + 0.2, 0.5]}><sphereGeometry args={[0.065, 12, 12]} /><meshBasicMaterial color="#fff3cd" /></mesh>
    <Html position={[-4.1, 0.17, 0.5]} center zIndexRange={[12, 0]}>
      <button type="button" className={`pipe-scene-label${compact ? ' pipe-scene-label--compact' : ''}`} onClick={() => onSelectPipe?.('GP-001')} aria-label="가스 주배관 GP-001 상세 정보">
        <span className="pipe-scene-label__title"><i /> GAS PIPE <span>GP-001</span></span>
        <span className="pipe-scene-label__rule" />
        <span className="pipe-scene-label__details"><span>Depth <b>1.2 m</b></span><span>Diameter <b>300 mm</b></span></span>
      </button>
    </Html>
    {!compact && <Html position={[5.1, -0.15, -1.7]} center zIndexRange={[11, 0]}>
      <span className="pipe-scene-small-label"><i /> 곡관 · 90°</span>
    </Html>}
  </group>;
}

function CameraRig({ view, resetKey, compact, mode }: Required<Pick<PipeSceneProps, 'view' | 'resetKey' | 'compact' | 'mode'>>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const distance = (mode === 'ar' ? 29.5 : compact ? 32.2 : 34.5) / Math.min(1.2, Math.max(0.55, aspect));
    const targetY = view === 'top' ? -0.25 : -0.65;
    const direction = view === 'top' ? new THREE.Vector3(0, 1, 0.001).normalize() : new THREE.Vector3(1.03, 0.91, 1.25).normalize();
    camera.position.copy(direction.multiplyScalar(distance));
    camera.position.y += targetY;
    camera.lookAt(0, targetY, 0);
    controls.current?.target.set(0, targetY, 0);
    controls.current?.update();
    invalidate();
  }, [camera, size.width, size.height, view, resetKey, compact, mode, invalidate]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.085} minDistance={7} maxDistance={75} minPolarAngle={0.001} maxPolarAngle={Math.PI / 2.05} zoomSpeed={0.8} rotateSpeed={0.65} panSpeed={0.65} screenSpacePanning />;
}

function World({ mode, showPipes, showZones, showLabels, surfaceOpacity, view, resetKey, compact, onSelectPipe }: Required<Omit<PipeSceneProps, 'onSelectPipe'>> & Pick<PipeSceneProps, 'onSelectPipe'>) {
  const ar = mode === 'ar';
  const underground = mode !== 'surface';
  const { gl } = useThree();
  useEffect(() => { gl.setClearColor('#edf2ef', ar ? 0 : 1); }, [gl, ar]);
  return <>
    {!ar && <color attach="background" args={['#edf2ef']} />}
    <ambientLight intensity={1.15} />
    <hemisphereLight args={['#f8fbff', '#d4c7ae', 1.15]} />
    <directionalLight position={[-10, 20, 10]} intensity={2.25} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-17} shadow-camera-right={17} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={0.5} shadow-camera-far={55} shadow-normalBias={0.045} shadow-bias={-0.0002} />
    <directionalLight position={[12, 8, -10]} intensity={0.75} color="#e8f5fc" />
    {!ar && <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.72, 0]} receiveShadow><planeGeometry args={[150, 150]} /><meshStandardMaterial color="#edf2ef" roughness={1} /></mesh>
      <gridHelper args={[70, 70, '#dbe4df', '#e2e9e4']} position={[0, -2.711, 0]} />
    </>}
    <Street underground={underground} opacity={ar ? Math.min(surfaceOpacity, 0.17) : surfaceOpacity} ar={ar} />
    {underground && showZones && <RiskZones />}
    {underground && showPipes && <PipeNetwork onSelectPipe={onSelectPipe} />}
    {underground && showPipes && showLabels && <SceneLabels compact={compact} onSelectPipe={onSelectPipe} />}
    <CameraRig view={view} resetKey={resetKey} compact={compact} mode={mode} />
  </>;
}

function Fallback({ mode, onRetry }: { mode: PipeSceneProps['mode']; onRetry?: () => void }) {
  return <div className="pipe-scene-fallback" role="status">
    <svg viewBox="0 0 600 350" aria-label="가스배관 위치 개념도" role="img">
      <defs><linearGradient id="scene-soil" x2="0" y2="1"><stop stopColor="#dcd9c7" /><stop offset="1" stopColor="#b9c2af" /></linearGradient></defs>
      <path d="M60 190 340 48 545 147 265 291Z" fill="#e9eee6" />
      <path d="M60 190 265 291 265 332 60 232Z" fill="url(#scene-soil)" /><path d="m265 291 280-144v41L265 332Z" fill="#bec5b5" />
      <path d="m111 169 277-140 105 55-277 140Z" transform="translate(0 57)" fill="#9eaaa8" opacity={mode === 'surface' ? 1 : 0.3} />
      <path d="m149 216 275-140" stroke="#fff" strokeWidth="2" strokeDasharray="12 9" />
      {mode !== 'surface' && <><path d="m130 238 230-117q18-9 32-2l47 25M272 165l-54-28" fill="none" stroke="#b87b18" strokeWidth="12" strokeLinecap="round" /><path d="m130 235 230-117q18-9 32-2l47 25M272 162l-54-28" fill="none" stroke="#ffbd42" strokeWidth="9" strokeLinecap="round" /><text x="282" y="263" fill="#695931" fontSize="15" fontFamily="sans-serif">GAS PIPE · 1.2 m / 300 mm</text></>}
      <path d="m90 133 71-36 51 25v43l-71 36-51-26Z" fill="#d4ddd6" /><path d="m90 133 71-36 51 25-71 37Z" fill="#f7f8ef" /><path d="m141 159 71-37v43l-71 36Z" fill="#b7c9c2" />
      <path d="m271 78 61-31 48 23v51l-61 31-48-24Z" fill="#d4ddd6" /><path d="m271 78 61-31 48 23-61 33Z" fill="#f7f8ef" /><path d="m319 103 61-33v51l-61 31Z" fill="#b7c9c2" />
    </svg>
    <strong>현장 개념도</strong><span>이 기기에서 3D 그래픽을 시작하지 못했습니다.</span><span>WebGL을 지원하는 브라우저에서 3D로 확인할 수 있습니다.</span>
    {onRetry && <button type="button" onClick={onRetry}>3D 다시 불러오기</button>}
  </div>;
}

class SceneBoundary extends Component<{ children: ReactNode; mode: PipeSceneProps['mode']; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Fallback mode={this.props.mode} onRetry={this.props.onRetry} /> : this.props.children; }
}

export default function PipeScene({ mode = 'underground', showPipes = true, showZones = true, showLabels = true, surfaceOpacity = 0.16, view = 'perspective', resetKey = 0, compact = false, onSelectPipe }: PipeSceneProps) {
  const [attempt, setAttempt] = useState(0);
  return <div className={`pipe-scene pipe-scene--${mode}${compact ? ' pipe-scene--compact' : ''}`} role="region" aria-label={mode === 'surface' ? '여수산단 A-12 현장 3D 지상 모형. 드래그로 회전, 두 손가락으로 이동하거나 확대합니다.' : '여수산단 A-12 지하 가스배관 3D 모형. 매설 깊이 1.2미터, 직경 300밀리미터. 드래그로 회전, 두 손가락으로 이동하거나 확대합니다.'}>
    <SceneBoundary key={attempt} mode={mode} onRetry={() => setAttempt(value => value + 1)}>
      <Canvas shadows dpr={[1, 1.65]} camera={{ position: [18, 16, 20], fov: 42, near: 0.1, far: 180 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop="demand" fallback={<Fallback mode={mode} onRetry={() => setAttempt(value => value + 1)} />} onCreated={({ gl }) => { gl.setClearColor('#edf2ef', mode === 'ar' ? 0 : 1); }}>
        <World mode={mode} showPipes={showPipes} showZones={showZones} showLabels={showLabels} surfaceOpacity={Math.max(0, Math.min(1, surfaceOpacity))} view={view} resetKey={resetKey} compact={compact} onSelectPipe={onSelectPipe} />
      </Canvas>
    </SceneBoundary>
  </div>;
}
