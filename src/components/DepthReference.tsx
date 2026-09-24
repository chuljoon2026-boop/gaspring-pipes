import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FACILITIES, PIPE_ROUTES } from '../network'
import { DEMO_GIS } from '../ar/demoGIS'
import { disposePipeModel } from '../ar/createPipeModel'

/** A diagram anchored to the selected pipe: surface datum / vertical metric
 * ruler / centre point. It does not pretend to be a measured excavation. */
export default function DepthReference({ facilityId }: { facilityId: string }) {
  const selected = FACILITIES[facilityId]
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reference = useMemo(() => {
    const group = new THREE.Group()
    group.name = 'pipe-depth-reference'
    group.position.set(selected.anchor[0] + DEMO_GIS.drawingOffset[0], 0, selected.anchor[2] + DEMO_GIS.drawingOffset[2])
    const depth = -selected.anchor[1]
    const ink = new THREE.MeshBasicMaterial({ color: '#b8e6ef', transparent: true, opacity: 0.78, depthWrite: false })
    const faint = new THREE.MeshBasicMaterial({ color: '#9bc6d1', transparent: true, opacity: 0.32, depthWrite: false })
    const add = (geometry: THREE.BufferGeometry, position: [number, number, number], material = ink) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(...position); mesh.userData.annotation = true; group.add(mesh); return mesh
    }
    // Local ground datum. The horizontal line is a reference, not a pipe shadow.
    const ring = add(new THREE.RingGeometry(0.17, 0.19, 64), [0, 0.007, 0])
    ring.rotation.x = -Math.PI / 2; ink.side = THREE.DoubleSide
    add(new THREE.BoxGeometry(1.6, 0.008, 0.012), [0, 0, 0], faint)
    add(new THREE.CylinderGeometry(0.009, 0.009, depth, 8), [0.45, -depth / 2, 0])
    for (let d = 0; d <= depth; d += 0.5) add(new THREE.BoxGeometry(d % 1 === 0 ? 0.17 : 0.10, 0.012, 0.012), [0.45, -d, 0])
    add(new THREE.BoxGeometry(0.45, 0.012, 0.012), [0.225, -depth, 0])
    add(new THREE.SphereGeometry(0.035, 16, 12), [0, -depth, 0])
    const textures: THREE.Texture[] = []
    const labels: THREE.Mesh[] = []
    const label = (text: string, y: number) => {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 112
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#10283ee8'; ctx.beginPath(); ctx.roundRect(0, 0, 512, 112, 18); ctx.fill()
      ctx.fillStyle = '#e3f3fa'; ctx.font = '600 56px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 56)
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture)
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false })
      const mesh = add(new THREE.PlaneGeometry(0.9, 0.20), [0.75, y, 0], material)
      mesh.renderOrder = 8; labels.push(mesh)
    }
    label('지면 0 m', -0.22)
    label(`중심 ${depth.toFixed(2)} m`, -depth)
    const route = PIPE_ROUTES.find(route => route.id === facilityId && route.points.length === 2 && route.points[0][2] === route.points[1][2] && route.points[0][1] === route.points[1][1])
    return { group, labels, textures, route, origin: new THREE.Vector3(), ahead: new THREE.Vector3(), inverseParent: new THREE.Quaternion(), cameraRotation: new THREE.Quaternion() }
  }, [selected, facilityId])
  useEffect(() => {
    clearTimeout(cleanupTimer.current)
    return () => {
      cleanupTimer.current = setTimeout(() => {
        reference.textures.forEach(texture => texture.dispose())
        disposePipeModel(reference.group)
      }, 0)
    }
  }, [reference])
  useFrame(({ camera }) => {
    // Place the ruler on the visible part of a straight main, not an arbitrary
    // GIS record anchor that may be outside the camera view. The pipe stays fixed.
    const parent = reference.group.parent
    if (parent && reference.route) {
      camera.getWorldPosition(reference.origin)
      camera.getWorldDirection(reference.ahead).add(reference.origin)
      parent.worldToLocal(reference.origin); parent.worldToLocal(reference.ahead).sub(reference.origin)
      if (Math.abs(reference.ahead.z) > 0.05) {
        const t = (reference.group.position.z - reference.origin.z) / reference.ahead.z
        const xs = reference.route.points.map(point => point[0] + DEMO_GIS.drawingOffset[0])
        if (t > 0) reference.group.position.x = THREE.MathUtils.clamp(reference.origin.x + reference.ahead.x * t, Math.min(...xs) + 1, Math.max(...xs) - 1)
      }
    }
    reference.group.getWorldQuaternion(reference.inverseParent).invert()
    camera.getWorldQuaternion(reference.cameraRotation)
    for (const label of reference.labels) label.quaternion.copy(reference.inverseParent).multiply(reference.cameraRotation)
  })
  return <><primitive object={reference.group} dispose={null} /></>
}
