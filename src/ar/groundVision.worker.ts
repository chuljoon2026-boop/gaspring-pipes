import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm'
import mjsURL from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url'
import wasmURL from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url'

// Single-thread WASM also works on Pages / Safari without cross-origin isolation.
env.wasm.numThreads = 1
env.wasm.wasmPaths = { wasm: new URL(wasmURL, self.location.href).href, mjs: new URL(mjsURL, self.location.href).href }
let session: InferenceSession | undefined
const groundClasses = new Set([3, 6, 9, 11, 13, 28, 46]) // floor / road / sidewalk / earth / rug / sand
const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225]

self.onmessage = async (event: MessageEvent<{ model?: string; rgba?: Uint8ClampedArray; size?: number }>) => {
  try {
    if (event.data.model) {
      session = await InferenceSession.create(event.data.model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
      self.postMessage({ type: 'ready' })
      return
    }
    if (!session || !event.data.rgba || !event.data.size) return
    const { rgba, size } = event.data
    const count = size * size, data = new Float32Array(count * 3)
    for (let c = 0; c < 3; c++) for (let i = 0; i < count; i++) data[c * count + i] = (rgba[i * 4 + c] / 255 - mean[c]) / std[c]
    const input = new Tensor('float32', data, [1, 3, size, size])
    const result = await session.run({ [session.inputNames[0]]: input })
    const logits = result[session.outputNames[0]]
    const [, classes, height, width] = logits.dims
    const values = logits.data as Float32Array, pixels = width * height
    const mask = new Uint8Array(pixels)
    for (let i = 0; i < pixels; i++) {
      let bestGround = -Infinity, bestObject = -Infinity
      for (let c = 0; c < classes; c++) {
        const value = values[c * pixels + i]
        if (groundClasses.has(c)) bestGround = Math.max(bestGround, value)
        else bestObject = Math.max(bestObject, value)
      }
      // Ambiguous boundaries stay transparent instead of painting onto objects.
      mask[i] = Math.round(255 / (1 + Math.exp(-(bestGround - bestObject) * 1.5)))
    }
    input.dispose()
    Object.values(result).forEach(tensor => tensor.dispose())
    self.postMessage({ type: 'mask', mask, width, height })
  } catch (error) { self.postMessage({ type: 'error', message: String(error) }) }
}
