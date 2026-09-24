import * as THREE from 'three'

export type MaskMode = 'pending' | 'depth' | 'vision' | 'searching'
/** An underground cutaway must preserve the floor while masking foreground
 * objects. Ordinary depth testing would occlude every buried pipe as well. */
export class GroundMask {
  readonly width = 192
  readonly height = 256
  readonly pixels = new Uint8Array(this.width * this.height)
  readonly texture = new THREE.DataTexture(this.pixels, this.width, this.height, THREE.RedFormat)
  readonly enabled = { value: 0 }
  mode: MaskMode = 'pending'
  onChange?: (mode: MaskMode) => void
  private horizontal = new Float32Array(this.pixels.length)
  private raw = new Uint8Array(this.pixels.length)
  private inverseProjection = new THREE.Matrix4()
  private matrix = new THREE.Matrix4()
  private point = new THREE.Vector3()

  constructor() {
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter
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
    this.status(pixels.some(value => value > 180) ? 'vision' : 'searching')
    // Bilinear reconstruction preserves confidence instead of enlarging binary blocks.
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const sx = Math.max(0, Math.min(width - 1, (x + 0.5) / this.width * width - 0.5))
      const sy = Math.max(0, Math.min(height - 1, (y + 0.5) / this.height * height - 0.5))
      const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1)
      const fx = sx - x0, fy = sy - y0
      this.raw[y * this.width + x] = (pixels[y0 * width + x0] * (1-fx) + pixels[y0 * width + x1] * fx) * (1-fy)
        + (pixels[y1 * width + x0] * (1-fx) + pixels[y1 * width + x1] * fx) * fy
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
      for (let y = 0; y < this.height; y += 2) for (let x = 0; x < this.width; x += 2) {
        const u = (x + 1) / this.width, v = (y + 1) / this.height
        const metres = depth.getDepthInMeters(u, v)
        if (!Number.isFinite(metres) || metres <= 0 || metres > 15) continue
        this.point.set(u * 2 - 1, 1 - v * 2, 0.5).applyMatrix4(this.inverseProjection)
        // WebXR returns distance to the camera plane, NOT radial ray length.
        this.point.multiplyScalar(metres / -this.point.z).applyMatrix4(this.matrix)
        if (Math.abs(this.point.y - groundY) <= 0.10) {
          const i = y * this.width + x
          this.raw[i] = this.raw[i + 1] = this.raw[i + this.width] = this.raw[i + this.width + 1] = 255
        }
      }
    } catch { this.clear(); return }
    this.erode()
  }
  private erode() {
    // A narrow, continuous feather; never a nearest-neighbour / binary cutout.
    const weights = [1, 4, 6, 4, 1]
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      let total = 0
      for (let d = -2; d <= 2; d++) total += this.raw[y * this.width + Math.max(0, Math.min(this.width - 1, x + d))] * weights[d+2]
      this.horizontal[y * this.width + x] = total / 16
    }
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      let total = 0
      for (let d = -2; d <= 2; d++) total += this.horizontal[Math.max(0, Math.min(this.height - 1, y + d)) * this.width + x] * weights[d+2]
      this.pixels[y * this.width + x] = Math.round(total / 16)
    }
    this.texture.needsUpdate = true
  }
  attach(model: THREE.Object3D) {
    const materials = new Set<THREE.Material>()
    model.traverse(object => {
      if (object instanceof THREE.Mesh && !object.userData.annotation) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material))
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
            float coverage = smoothstep(0.42, 0.9, texture2D(groundMask, maskUV).r);
            diffuseColor.a *= coverage;
            if (diffuseColor.a < 0.003) discard;
          }`)
      }
      material.customProgramCacheKey = () => 'underground-ground-mask-v2-feather'
      material.needsUpdate = true
    }
  }
  dispose() { this.texture.dispose() }
}
