import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PIPE_ROUTES } from '../network'

/** Pick the actual visible geometry, preserving GIS positions when selected. */
export default function PipePicker({ model, onSelect }: { model: THREE.Group; onSelect: (id: string) => void }) {
  const { gl, camera } = useThree()
  useEffect(() => {
    const surface = gl.domElement.closest('.floor-ar') || gl.domElement
    const ray = new THREE.Raycaster()
    const ids = new Set(PIPE_ROUTES.map(route => route.id))
    let down: { x: number; y: number } | null = null
    const start = (event: Event) => { const e = event as PointerEvent; if (e.target instanceof Element && e.target.closest('button, input, select, .ar-pipe-info, .floor-ar-panel, .floor-ar-header')) return; down = { x: e.clientX, y: e.clientY } }
    const end = (event: Event) => {
      const e = event as PointerEvent
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down = null; return }
      down = null
      const rect = gl.domElement.getBoundingClientRect()
      const view = gl.xr.isPresenting ? gl.xr.getCamera().cameras[0] : camera
      if (!view || !rect.width || !rect.height) return
      model.updateWorldMatrix(true, true)
      ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2), view)
      const hit = ray.intersectObject(model, true).find(hit => {
        for (let node: THREE.Object3D | null = hit.object; node; node = node.parent) if (!node.visible) return false
        if (!ids.has(hit.object.userData.facilityId)) return false
        const mesh = hit.object as THREE.Mesh
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)
        return !material.clippingPlanes?.some(plane => plane.distanceToPoint(hit.point) < 0)
      })
      if (hit) onSelect(hit.object.userData.facilityId)
    }
    surface.addEventListener('pointerdown', start)
    surface.addEventListener('pointerup', end)
    return () => { surface.removeEventListener('pointerdown', start); surface.removeEventListener('pointerup', end) }
  }, [model, onSelect, gl, camera])
  return null
}
