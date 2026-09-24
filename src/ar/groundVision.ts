import * as THREE from 'three'
import type { GroundMask } from './GroundMask'

/** All video processing stays on the device. Only model assets are fetched. */
export function startGroundVision(video: HTMLVideoElement, mask: GroundMask,
  orientation: { current: THREE.Quaternion | null }, onError: (message: string) => void) {
  const worker = new Worker(new URL('./groundVision.worker.ts', import.meta.url), { type: 'module' })
  const canvas = document.createElement('canvas')
  const size = 320
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  let ended = false, ready = false, busy = false, timer = 0
  let captured: Uint8ClampedArray | null = null
  let captureRotation: THREE.Quaternion | null = null
  let maskRotation: THREE.Quaternion | null = null
  let maskAt = 0
  let captureAspect = 0
  let predicted: { pixels: Uint8Array; width: number; height: number; rgba: Uint8ClampedArray; aspect: number } | null = null
  const refreshMask = (current: Uint8ClampedArray) => {
    if (!predicted || Math.abs(predicted.aspect - video.clientWidth / video.clientHeight) > 0.01) { mask.clear(); return }
    const { width, height, rgba } = predicted
    const pixels = predicted.pixels.slice()
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (Math.floor((y + 0.5) / height * size) * size + Math.floor((x + 0.5) / width * size)) * 4
      let difference = 0
      for (let c = 0; c < 3; c++) difference += Math.abs(current[index + c] - rgba[index + c])
      const confidence = Math.max(0, Math.min(1, (145 - difference) / 70))
      pixels[y * width + x] = Math.round(pixels[y * width + x] * confidence)
    }
    mask.updateVision(pixels, width, height)
  }
  const draw = () => {
    const bounds = video.getBoundingClientRect()
    const aspect = bounds.width / bounds.height
    const sourceAspect = video.videoWidth / video.videoHeight
    const width = sourceAspect > aspect ? video.videoHeight * aspect : video.videoWidth
    const height = sourceAspect > aspect ? video.videoHeight : video.videoWidth / aspect
    // Exactly match object-fit: cover before resizing for inference.
    context.drawImage(video, (video.videoWidth - width) / 2, (video.videoHeight - height) / 2, width, height, 0, 0, size, size)
    return context.getImageData(0, 0, size, size).data
  }
  const tick = () => {
    if (ended) return
    if (maskAt && (performance.now() - maskAt > 1800 || (orientation.current && maskRotation && orientation.current.angleTo(maskRotation) > THREE.MathUtils.degToRad(4)))) { predicted = null; mask.clear() }
    if (predicted && video.readyState >= 2) refreshMask(draw())
    if (ready && !busy && video.readyState >= 2 && video.videoWidth && orientation.current) {
      captured = draw()
      captureRotation = orientation.current.clone()
      captureAspect = video.clientWidth / video.clientHeight
      busy = true
      worker.postMessage({ rgba: captured, size })
    }
    timer = window.setTimeout(tick, 100)
  }
  const fail = () => {
    if (ended) return
    ready = false; busy = false; mask.clear()
    onError('지면 인식을 시작하지 못했습니다. 카메라를 다시 켜주세요.')
  }
  worker.onerror = fail
  worker.onmessage = event => {
    if (ended) return
    if (event.data.type === 'ready') { ready = true; return }
    if (event.data.type === 'error') { console.error('Ground segmentation:', event.data.message); fail(); return }
    if (event.data.type !== 'mask') return
    busy = false
    if (!captured || !captureRotation || !orientation.current || orientation.current.angleTo(captureRotation) > THREE.MathUtils.degToRad(4)
      || Math.abs(captureAspect - video.clientWidth / video.clientHeight) > 0.01) { mask.clear(); return }
    const current = draw()
    const { mask: pixels, width, height } = event.data as { mask: Uint8Array; width: number; height: number }
    // Refresh against the live image at 10Hz, independently of inference.
    predicted = { pixels, width, height, rgba: captured, aspect: captureAspect }
    refreshMask(current)
    maskRotation = orientation.current.clone(); maskAt = performance.now()
  }
  worker.postMessage({ model: new URL(`${import.meta.env.BASE_URL}models/segformer/model_quantized.onnx`, location.origin).href })
  tick()
  return () => { ended = true; clearTimeout(timer); worker.terminate(); mask.clear() }
}
