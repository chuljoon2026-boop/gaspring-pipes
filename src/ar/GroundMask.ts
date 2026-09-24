import * as THREE from 'three'

export type MaskMode = 'pending' | 'depth' | 'vision' | 'searching'
/** An underground cutaway must preserve the floor while masking foreground
 * objects. Ordinary depth testing would occlude every buried pipe as well. */
export class GroundMask {
  readonly width = 96
  readonly height = 128
  readonly pixels = new Uint8Array(this.width * this.height)
  readonly texture = new THREE.DataTexture(this.pixels, this.width, this.height, THREE.RedFormat)
  readonly enabled = { value: 0 }
  mode: MaskMode = 'pending'
  onChange?: (mode: MaskMode) => void
  private raw = new Uint8Array(this.pixels.length)
  private inverseProjection = new THREE.Matrix4()
  private matrix = new THREE.Matrix4()
  private point = new THREE.Vector3()

  constructor() {
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter
    this.texture.generateMipmaps = false
    // Data rows and API normalized view coordinates both start at the top.
    this.texture.flipY = false
    this.clear()
  }
  private status(mode: MaskMode) {
    if (this.mode === mode) return
    this.mode = mode
    this.onChange?.(mode)
  }
  clear() { this.pixels.fill(0); this.texture.needsUpdate = true }
  reset() { this.clear(); this.status('pending') }
  updateVision(pixels: Uint8Array, width: number, height: number) {
    this.status(pixels.some(value => value > 0) ? 'vision' : 'searching')
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      this.raw[y * this.width + x] = pixels[Math.min(height - 1, Math.floor((y + 0.5) / this.height * height)) * width + Math.min(width - 1, Math.floor((x + 0.5) / this.width * width))]
    }
    this.erode()
  }
  updateDepth(depth: Pick<XRCPUDepthInformation, 'getDepthInMeters'> | null | undefined, view: Pick<XRView, 'projectionMatrix' | 'transform'>, groundY: number) {
    this.status('depth')
    this.raw.fill(0)
    if (!depth) { this.status('searching'); this.clear(); return }
    this.inverseProjection.fromArray(view.projectionMatrix).invert()
    this.matrix.fromArray(view.transform.matrix)
    try {
      for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
        const u = (x + 0.5) / this.width, v = (y + 0.5) / this.height
        const metres = depth.getDepthInMeters(u, v)
        if (!Number.isFinite(metres) || metres <= 0 || metres > 15) continue
        this.point.set(u * 2 - 1, 1 - v * 2, 0.5).applyMatrix4(this.inverseProjection)
        // WebXR returns distance to the camera plane, NOT radial ray length.
        this.point.multiplyScalar(metres / -this.point.z).applyMatrix4(this.matrix)
        if (Math.abs(this.point.y - groundY) <= 0.10) this.raw[y * this.width + x] = 255
      }
    } catch { this.clear(); return }
    this.erode()
  }
  private erode() {
    // Erode by one cell: object edges and invalid depth cannot leak pipes.
    this.pixels.fill(0)
    for (let y = 1; y < this.height - 1; y++) for (let x = 1; x < this.width - 1; x++) {
      let floor = true
      for (let dy = -1; dy <= 1 && floor; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!this.raw[(y + dy) * this.width + x + dx]) { floor = false; break }
      }
      if (floor) this.pixels[y * this.width + x] = 255
    }
    this.texture.needsUpdate = true
  }
  attach(model: THREE.Object3D) {
    const materials = new Set<THREE.Material>()
    model.traverse(object => {
      if (object instanceof THREE.Mesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material))
    })
    for (const material of materials) {
      material.onBeforeCompile = shader => {
        shader.uniforms.groundMask = { value: this.texture }
        shader.uniforms.groundMaskEnabled = this.enabled
        shader.vertexShader = 'varying vec4 groundClipPosition;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\ngroundClipPosition = gl_Position;')
        shader.fragmentShader = 'uniform sampler2D groundMask;\nuniform float groundMaskEnabled;\nvarying vec4 groundClipPosition;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          if (groundMaskEnabled > 0.5) {
            vec2 maskUV = groundClipPosition.xy / groundClipPosition.w * 0.5 + 0.5;
            maskUV.y = 1.0 - maskUV.y;
            if (texture2D(groundMask, maskUV).r < 0.99) discard;
          }`)
      }
      material.customProgramCacheKey = () => 'underground-ground-mask-v1'
      material.needsUpdate = true
    }
  }
  dispose() { this.texture.dispose() }
}
