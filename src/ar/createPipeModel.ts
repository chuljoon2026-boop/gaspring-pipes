import * as THREE from 'three'
import { FACILITIES, PIPE_ROUTES, type Vec3 } from '../network'

function roundedPath(points: Vec3[], pipeRadius: number) {
  const vertices = points.map((point) => new THREE.Vector3(...point))
  const path = new THREE.CurvePath<THREE.Vector3>()
  let from = vertices[0]
  for (let i = 1; i < vertices.length - 1; i++) {
    const radius = Math.min(
      Math.max(0.6, pipeRadius * 3),
      vertices[i].distanceTo(vertices[i - 1]) * 0.3,
      vertices[i].distanceTo(vertices[i + 1]) * 0.3,
    )
    const before = vertices[i].clone().add(
      vertices[i - 1].clone().sub(vertices[i]).normalize().multiplyScalar(radius),
    )
    const after = vertices[i].clone().add(
      vertices[i + 1].clone().sub(vertices[i]).normalize().multiplyScalar(radius),
    )
    path.add(new THREE.LineCurve3(from, before))
    path.add(new THREE.QuadraticBezierCurve3(before, vertices[i], after))
    from = after
  }
  path.add(new THREE.LineCurve3(from, vertices[vertices.length - 1]))
  return path
}

/** Metres in the drawing coordinate system: road surface y=0, buried pipes y<0. */
export function createPipeModel(): THREE.Group {
  const model = new THREE.Group()
  model.name = 'YS-001'
  const content = new THREE.Group()
  content.name = 'PipeNetwork'
  model.add(content)
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const up = new THREE.Vector3(0, 1, 0)

  function material(color: string, metalness = 0.2) {
    const key = `${color}:${metalness}`
    let result = materials.get(key)
    if (!result) {
      result = new THREE.MeshStandardMaterial({
        color, metalness, roughness: 0.45, emissive: color, emissiveIntensity: 0.32,
        transparent: true, opacity: 0.92,
      })
      materials.set(key, result)
    }
    return result
  }

  function mesh(id: string, geometry: THREE.BufferGeometry, surface: THREE.MeshStandardMaterial) {
    const result = new THREE.Mesh(geometry, surface)
    result.name = id
    result.userData = { facilityId: id, title: FACILITIES[id].name, layer: FACILITIES[id].layer }
    result.castShadow = true
    result.receiveShadow = true
    content.add(result)
    return result
  }

  function box(id: string, position: Vec3, size: Vec3, color = FACILITIES[id].color) {
    const result = mesh(id, new THREE.BoxGeometry(...size), material(color))
    result.position.set(...position)
    return result
  }

  function cylinder(id: string, position: Vec3, radius: number, height: number, color: string) {
    const result = mesh(id, new THREE.CylinderGeometry(radius, radius, height, 16), material(color))
    result.position.set(...position)
    return result
  }

  for (const route of PIPE_ROUTES) {
    const item = FACILITIES[route.id]
    const path = roundedPath(route.points, route.radius)
    const radialSegments = route.duct ? 10 : 16
    mesh(
      route.id,
      new THREE.TubeGeometry(path, route.points.length > 2 ? 80 : 4, route.radius, radialSegments, false),
      material(item.color, route.id.startsWith('SW') ? 0.02 : 0.25),
    )

    // Ordinary meshes keep the model portable to USDZ; geometry is shared per route.
    if (!route.duct) {
      const count = Math.max(1, Math.floor(path.getLength() / 8))
      const radius = route.radius + Math.max(0.012, route.radius * 0.08)
      const band = new THREE.CylinderGeometry(radius, radius, 0.16, radialSegments)
      for (let i = 0; i < count; i++) {
        const fraction = (i + 0.5) / count
        const sleeve = mesh(route.id, band, material(item.color))
        sleeve.position.copy(path.getPointAt(fraction))
        sleeve.quaternion.setFromUnitVectors(up, path.getTangentAt(fraction).normalize())
      }
    }

    // Close tube ends without double-sided materials or textures.
    const capGeometry = new THREE.CylinderGeometry(route.radius, route.radius, 0.006, radialSegments)
    for (const fraction of [0, 1]) {
      const cap = mesh(route.id, capGeometry, material(item.color))
      cap.position.copy(path.getPointAt(fraction))
      cap.quaternion.setFromUnitVectors(up, path.getTangentAt(fraction).normalize())
    }
  }

  // Representative protective structures use the same locations as the detailed viewer.
  for (const x of [-2.1, 0, 2.1]) {
    for (const z of [-6.5, -4.1, -1.7]) box('PL-001', [x, -0.95, z], [2, 0.18, 2.3])
  }
  for (const x of [11.1, 13.2]) box('PL-002', [x, 0.13, -3.8], [2, 0.18, 8.8])
  for (const z of [-8.35, 0.75]) box('PL-002', [13.2, -0.22, z], [7, 0.32, 0.24], '#647178')
  for (const z of [-8.55, 0.95]) {
    box('SH-001', [13.65, -1.85, z], [9.12, 3.6, 0.08])
    for (const x of [10.2, 12.5, 14.8, 17.1]) {
      box('SH-001', [x, -1.85, z], [0.15, 3.7, 0.2], '#68716a')
    }
  }

  const valve = cylinder('V-001', [-13, -1.85, -8.5], 0.22, 0.6, '#7d827a')
  valve.rotation.x = Math.PI / 2
  for (const z of [-8.8, -8.2]) {
    const flange = cylinder('V-001', [-13, -1.85, z], 0.25, 0.1, '#abb1a3')
    flange.rotation.x = Math.PI / 2
  }
  cylinder('V-001', [-13, -1.1, -8.5], 0.045, 1.3, '#acb6aa')
  const wheel = mesh('V-001', new THREE.TorusGeometry(0.28, 0.035, 8, 20), material('#926650'))
  wheel.position.set(-13, -0.42, -8.5)
  wheel.rotation.x = Math.PI / 2
  box('V-001', [-13, -0.42, -8.5], [0.54, 0.035, 0.035], '#926650')

  cylinder('MH-001', [20, -2.365, 9.35], 1.18, 4.77, '#a5afa2')
  cylinder('MH-001', [20, -4.88, 9.35], 1.22, 0.18, '#a5afa2')
  cylinder('MH-001', [20, 0.07, 9.35], 1.22, 0.18, '#a5afa2')
  cylinder('MH-001', [20, 0.19, 9.35], 0.58, 0.08, '#65756b')

  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(content)
  const size = bounds.getSize(new THREE.Vector3())
  // Never lift the lowest point to the floor: the floor is the drawing's road datum.
  model.userData = { width: size.x, height: size.y, depth: size.z, units: 'metres', groundY: 0 }
  model.updateMatrixWorld(true)
  return model
}

/** Dispose owned resources once, including geometries/materials shared by repeated meshes. */
export function disposePipeModel(model: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    geometries.add(object.geometry)
    const surfaces = Array.isArray(object.material) ? object.material : [object.material]
    for (const surface of surfaces) materials.add(surface)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const surface of materials) surface.dispose()
  model.clear()
}
