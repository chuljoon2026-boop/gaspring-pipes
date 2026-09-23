import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { createPipeModel, createQuickLookUrl, disposePipeModel } from '../ar/createPipeModel'

export type ARPhase = 'idle' | 'searching' | 'surface' | 'placed' | 'lost'
export interface FloorARHandle {
  start: (session: XRSession) => Promise<void>
  end: () => Promise<void>
  place: () => void
  reset: () => void
  quickLook: (scale: number) => Promise<string>
}
type Props = { scale: number; onPhase: (phase: ARPhase) => void; onReady: () => void }

const TrackedWorld = forwardRef<FloorARHandle, Props>(function TrackedWorld({ scale, onPhase, onReady }, ref) {
  const { gl, camera, invalidate } = useThree()
  const model = useMemo(createPipeModel, [])
  const disposal = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const root = useRef<THREE.Group>(null)
  const reticle = useRef<THREE.Group>(null)
  const sessionRef = useRef<XRSession | null>(null)
  const sourceRef = useRef<XRHitTestSource | null>(null)
  const spaceRef = useRef<XRReferenceSpace | null>(null)
  const anchorRef = useRef<XRAnchor | null>(null)
  const placed = useRef(false)
  const placeRequested = useRef(false)
  const generation = useRef(0)
  const placementId = useRef(0)
  const activeRef = useRef(true)
  const phaseRef = useRef<ARPhase>('idle')
  const [active, setActive] = useState(false)
  const latestHit = useRef<XRHitTestResult | null>(null)
  const fixedMatrix = useMemo(() => new THREE.Matrix4(), [])
  const anchorOffset = useMemo(() => new THREE.Matrix4(), [])
  const scratch = useMemo(() => ({
    matrix: new THREE.Matrix4(), position: new THREE.Vector3(), quaternion: new THREE.Quaternion(),
    direction: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), one: new THREE.Vector3(1, 1, 1),
  }), [])
  const callbacks = useRef({ onPhase, onReady })
  callbacks.current = { onPhase, onReady }
  const phase = useCallback((next: ARPhase) => {
    if (phaseRef.current === next) return
    phaseRef.current = next
    if (activeRef.current) callbacks.current.onPhase(next)
  }, [])
  const resetPlacement = useCallback(() => {
    placementId.current += 1
    placed.current = false
    placeRequested.current = false
    latestHit.current = null
    anchorRef.current?.delete()
    anchorRef.current = null
    if (root.current) root.current.visible = false
    phase('searching')
  }, [phase])
  const requestPlacement = useCallback(() => {
    if (!placed.current && phaseRef.current === 'surface') placeRequested.current = true
  }, [])
  const cleanup = useCallback(() => {
    generation.current += 1
    placementId.current += 1
    sourceRef.current?.cancel()
    sourceRef.current = null
    anchorRef.current?.delete()
    anchorRef.current = null
    spaceRef.current?.removeEventListener('reset', resetPlacement)
    spaceRef.current = null
    const session = sessionRef.current
    session?.removeEventListener('select', requestPlacement)
    session?.removeEventListener('end', cleanup)
    sessionRef.current = null
    placed.current = false
    placeRequested.current = false
    latestHit.current = null
    if (reticle.current) reticle.current.visible = false
    if (root.current) { root.current.matrix.identity(); root.current.visible = true }
    camera.position.set(3, 2.5, 3)
    camera.lookAt(0, 0.12, 0)
    if (activeRef.current) setActive(false)
    phase('idle')
    invalidate()
  }, [camera, invalidate, phase, requestPlacement, resetPlacement])
  const end = useCallback(async () => {
    const session = sessionRef.current
    if (session) {
      try { await session.end() } finally { if (sessionRef.current === session) cleanup() }
    }
  }, [cleanup])
  useImperativeHandle(ref, () => ({
    async start(session) {
      if (sessionRef.current) throw new Error('AR session already active')
      const token = ++generation.current
      sessionRef.current = session
      resetPlacement()
      setActive(true)
      session.addEventListener('end', cleanup)
      session.addEventListener('select', requestPlacement)
      try {
        gl.xr.setReferenceSpaceType('local')
        gl.xr.enabled = true
        await gl.xr.setSession(session)
        if (!activeRef.current || token !== generation.current) return
        const space = gl.xr.getReferenceSpace()
        if (!space) throw new Error('No world reference space')
        spaceRef.current = space
        space.addEventListener('reset', resetPlacement)
        const viewer = await session.requestReferenceSpace('viewer')
        const source = await session.requestHitTestSource?.({ space: viewer, entityTypes: ['plane'] })
        if (!source) throw new Error('Surface tracking unavailable')
        if (!activeRef.current || token !== generation.current) { source.cancel(); return }
        sourceRef.current = source
      } catch (error) {
        try { await session.end() } catch { /* A failed/ended session may reject end. */ }
        if (sessionRef.current === session) cleanup()
        throw error
      }
    },
    end,
    place: requestPlacement,
    reset: resetPlacement,
    quickLook: (value) => createQuickLookUrl(model, value),
  }))
  useEffect(() => {
    clearTimeout(disposal.current)
    activeRef.current = true
    camera.position.set(3, 2.5, 3)
    camera.lookAt(0, 0.12, 0)
    callbacks.current.onReady()
    return () => {
      activeRef.current = false
      const session = sessionRef.current
      cleanup()
      session?.end().catch(() => {})
      // StrictMode immediately reconnects this effect. Dispose only after a real unmount.
      disposal.current = setTimeout(() => disposePipeModel(model), 0)
    }
  }, [model, camera, cleanup])
  useEffect(() => { invalidate() }, [scale, invalidate])
  useFrame((_state, _delta, frame) => {
    const session = sessionRef.current
    const space = spaceRef.current
    if (!session || !space || !frame || !root.current || !reticle.current) return
    const viewer = frame.getViewerPose(space)
    if (!viewer || viewer.emulatedPosition || session.visibilityState !== 'visible') {
      root.current.visible = false
      reticle.current.visible = false
      latestHit.current = null
      placeRequested.current = false
      phase('lost')
      return
    }
    if (placed.current) {
      let matrix = fixedMatrix
      if (anchorRef.current) {
        const pose = frame.getPose(anchorRef.current.anchorSpace, space)
        if (!pose) { root.current.visible = false; phase('lost'); return }
        matrix = scratch.matrix.fromArray(pose.transform.matrix).multiply(anchorOffset)
      }
      root.current.matrix.copy(matrix)
      root.current.matrixWorldNeedsUpdate = true
      root.current.visible = true
      reticle.current.visible = false
      phase('placed')
      return
    }
    root.current.visible = false
    const hits = sourceRef.current ? frame.getHitTestResults(sourceRef.current) : []
    const hit = hits.find((result) => {
      const pose = result.getPose(space)
      // A horizontal surface below the camera; the user chooses the floor.
      return pose && pose.transform.matrix[5] > 0.9 && pose.transform.position.y < viewer.transform.position.y - 0.25
    })
    const pose = hit?.getPose(space)
    latestHit.current = hit ?? null
    if (!hit || !pose) {
      reticle.current.visible = false
      placeRequested.current = false
      phase('searching')
      return
    }
    reticle.current.matrix.fromArray(pose.transform.matrix)
    reticle.current.matrixWorldNeedsUpdate = true
    reticle.current.visible = true
    phase('surface')
    if (!placeRequested.current) return
    placeRequested.current = false
    scratch.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z)
    scratch.quaternion.set(viewer.transform.orientation.x, viewer.transform.orientation.y, viewer.transform.orientation.z, viewer.transform.orientation.w)
    scratch.direction.set(0, 0, -1).applyQuaternion(scratch.quaternion)
    const yaw = Math.atan2(-scratch.direction.x, -scratch.direction.z)
    scratch.quaternion.setFromAxisAngle(scratch.up, yaw)
    fixedMatrix.compose(scratch.position, scratch.quaternion, scratch.one)
    root.current.matrix.copy(fixedMatrix)
    root.current.matrixWorldNeedsUpdate = true
    root.current.visible = true
    reticle.current.visible = false
    placed.current = true
    phase('placed')
    const token = ++placementId.current
    // The model's heading is frozen at placement, independently of the viewer camera.
    anchorOffset.copy(scratch.matrix.fromArray(pose.transform.matrix).invert()).multiply(fixedMatrix)
    if (hit.createAnchor) {
      try {
        // Request within the active XR frame; only resolving the anchor is asynchronous.
        hit.createAnchor().then((anchor) => {
          if (sessionRef.current !== session || token !== placementId.current) anchor.delete()
          else anchorRef.current = anchor
        }).catch(() => { /* Local-space placement remains available without anchors. */ })
      } catch { /* Some devices expose createAnchor without enabling anchor support. */ }
    }
  })
  return <>
    {!active && <color attach="background" args={['#edf1f4']} />}
    <ambientLight intensity={1.6} />
    <hemisphereLight args={['#ffffff', '#7d8c9e', 2]} />
    <directionalLight position={[3, 7, 5]} intensity={2.5} />
    <group ref={root} name="grounded-pipe-model" matrixAutoUpdate={false}>
      <group scale={scale}><primitive object={model} dispose={null} /></group>
    </group>
    <group ref={reticle} name="floor-placement-reticle" matrixAutoUpdate={false} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.09, 0.12, 40]} />
        <meshBasicMaterial color="#2d64ed" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.015, 16]} /><meshBasicMaterial color="#2d64ed" /></mesh>
    </group>
    {!active && <>
      <gridHelper args={[8, 32, '#bdc8d4', '#dce3e9']} position={[0, -0.003, 0]} />
      <OrbitControls target={[0, 0.12, 0]} minDistance={0.4} maxDistance={130} maxPolarAngle={Math.PI / 2.05} />
    </>}
  </>
})

const FloorARScene = forwardRef<FloorARHandle, Props>(function FloorARScene(props, ref) {
  return <Canvas camera={{ position: [3, 2.5, 3], near: 0.01, far: 300, fov: 50 }} dpr={[1, 1.5]}
    gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }} frameloop="demand">
    <TrackedWorld ref={ref} {...props} />
  </Canvas>
})
export default FloorARScene
