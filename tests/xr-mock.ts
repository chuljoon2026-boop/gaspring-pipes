import type { Page } from '@playwright/test'

export interface XRMockControl {
  /** Set the absolute viewer position, in meters, while keeping eye height 1.4m. */
  moveViewer(x: number, z: number): void
  /** Set the absolute viewer heading, in degrees, while keeping pitch -25deg. */
  rotateViewer(yawDegrees: number): void
  setTracking(available: boolean): void
  setSurface(available: boolean): void
  select(): void
  end(): Promise<void>
  readonly hitsCanceled: number
  readonly sessionsEnded: number
  readonly sessionsStarted: number
  readonly anchorsDeleted: number
}

declare global {
  interface Window {
    __xrMock: XRMockControl
  }
}

/**
 * Install before page.goto(). This simulates WebXR lifecycle and poses, not
 * camera capture, SLAM accuracy, permissions, or device/browser support.
 */
export async function installXRMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Point = { x: number; y: number; z: number; w?: number }
    type Quaternion = { x: number; y: number; z: number; w: number }
    const nativeRAF = window.requestAnimationFrame.bind(window)
    const nativeCancelRAF = window.cancelAnimationFrame.bind(window)
    const state = {
      x: 0, z: 0, yaw: 0, tracking: true, surface: true,
      hitsCanceled: 0, sessionsEnded: 0, sessionsStarted: 0, anchorsDeleted: 0,
    }

    class MockRigidTransform {
      position: Point
      orientation: Quaternion
      matrix: Float32Array

      constructor(position: Partial<Point> = {}, orientation: Partial<Quaternion> = {}) {
        this.position = { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0, w: 1 }
        this.orientation = {
          x: orientation.x ?? 0, y: orientation.y ?? 0,
          z: orientation.z ?? 0, w: orientation.w ?? 1,
        }
        const { x, y, z, w } = this.orientation
        const p = this.position
        this.matrix = new Float32Array([
          1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
          2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
          2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
          p.x, p.y, p.z, 1,
        ])
      }

      get inverse(): MockRigidTransform {
        const m = this.matrix
        const p = this.position
        const q = this.orientation
        return new MockRigidTransform({
          x: -(m[0] * p.x + m[1] * p.y + m[2] * p.z),
          y: -(m[4] * p.x + m[5] * p.y + m[6] * p.z),
          z: -(m[8] * p.x + m[9] * p.y + m[10] * p.z),
        }, { x: -q.x, y: -q.y, z: -q.z, w: q.w })
      }
    }

    class MockSpace extends EventTarget {
      constructor(public kind: string, public transform = new MockRigidTransform()) {
        super()
      }
      getOffsetReferenceSpace(transform: MockRigidTransform): MockSpace {
        return new MockSpace(this.kind, transform)
      }
    }

    class MockHitTestSource {
      canceled = false
      cancel(): void {
        if (this.canceled) return
        this.canceled = true
        state.hitsCanceled += 1
      }
    }

    class MockAnchor {
      anchorSpace: MockSpace
      deleted = false
      constructor(transform: MockRigidTransform) {
        this.anchorSpace = new MockSpace('anchor', transform)
      }
      delete(): void {
        if (this.deleted) return
        this.deleted = true
        state.anchorsDeleted += 1
      }
    }

    class MockWebGLLayer {
      framebuffer = null
      framebufferWidth: number
      framebufferHeight: number
      ignoreDepthValues = false
      fixedFoveation = 1
      antialias = true
      constructor(_session: MockSession, gl: WebGLRenderingContext) {
        this.framebufferWidth = gl.drawingBufferWidth || window.innerWidth
        this.framebufferHeight = gl.drawingBufferHeight || window.innerHeight
      }
      getViewport(): { x: number; y: number; width: number; height: number } {
        return { x: 0, y: 0, width: this.framebufferWidth, height: this.framebufferHeight }
      }
      static getNativeFramebufferScaleFactor(): number { return 1 }
    }

    class MockFrame {
      readonly predictedDisplayTime: number
      private viewer: MockRigidTransform
      private hit: MockRigidTransform
      private active = false
      constructor(public session: MockSession, timestamp: number) {
        this.predictedDisplayTime = timestamp
        const halfPitch = -25 * Math.PI / 360
        const halfYaw = state.yaw * Math.PI / 360
        this.viewer = new MockRigidTransform(
          { x: state.x, y: 1.4, z: state.z },
          {
            x: Math.cos(halfYaw) * Math.sin(halfPitch),
            y: Math.sin(halfYaw) * Math.cos(halfPitch),
            z: -Math.sin(halfYaw) * Math.sin(halfPitch),
            w: Math.cos(halfYaw) * Math.cos(halfPitch),
          },
        )
        this.hit = new MockRigidTransform({ x: state.x, y: 0, z: state.z - 2 })
      }

      getViewerPose(_space?: MockSpace) {
        if (!state.tracking || this.session.ended) return null
        const layer = this.session.renderState.baseLayer
        const aspect = layer
          ? layer.framebufferWidth / layer.framebufferHeight
          : window.innerWidth / window.innerHeight
        const near = this.session.renderState.depthNear
        const far = this.session.renderState.depthFar
        const f = 1 / Math.tan(65 * Math.PI / 360)
        const projectionMatrix = new Float32Array([
          f / aspect, 0, 0, 0,
          0, f, 0, 0,
          0, 0, (far + near) / (near - far), -1,
          0, 0, 2 * far * near / (near - far), 0,
        ])
        return {
          transform: this.viewer,
          emulatedPosition: false,
          views: [{ eye: 'none', transform: this.viewer, projectionMatrix }],
        }
      }

      getHitTestResults(source: MockHitTestSource) {
        if (!state.tracking || !state.surface || source.canceled || this.session.ended) return []
        const transform = this.hit
        return [{
          getPose: (_space?: MockSpace) => ({ transform, emulatedPosition: false }),
          createAnchor: async () => this.addAnchor(transform),
        }]
      }

      getPose(space: MockSpace, _baseSpace?: MockSpace) {
        if (!state.tracking || this.session.ended) return null
        return { transform: space.kind === 'viewer' ? this.viewer : space.transform, emulatedPosition: false }
      }

      get trackedAnchors(): Set<MockAnchor> {
        return new Set(state.tracking
          ? [...this.session.anchors].filter((anchor) => !anchor.deleted)
          : [])
      }

      async createAnchor(transform: MockRigidTransform, _space?: MockSpace): Promise<MockAnchor> {
        return this.addAnchor(transform)
      }

      private addAnchor(transform: MockRigidTransform): MockAnchor {
        if (!this.active) throw new DOMException('Anchor creation requires an active XR frame', 'InvalidStateError')
        const anchor = new MockAnchor(transform)
        this.session.anchors.add(anchor)
        return anchor
      }

      run(callback: () => void): void {
        this.active = true
        try { callback() } finally { this.active = false }
      }
    }

    class MockSession extends EventTarget {
      ended = false
      inputSources: never[] = []
      environmentBlendMode = 'alpha-blend'
      visibilityState = 'visible'
      interactionMode = 'screen-space'
      enabledFeatures = ['viewer', 'local', 'hit-test', 'dom-overlay', 'anchors']
      domOverlayState = { type: 'screen' }
      renderState: { baseLayer: MockWebGLLayer | null; depthNear: number; depthFar: number } = {
        baseLayer: null, depthNear: 0.01, depthFar: 1000,
      }
      anchors = new Set<MockAnchor>()
      private pendingFrames = new Set<number>()

      async requestReferenceSpace(kind: string): Promise<MockSpace> {
        return new MockSpace(kind)
      }
      async requestHitTestSource(_options?: unknown): Promise<MockHitTestSource> {
        return new MockHitTestSource()
      }
      updateRenderState(update: Partial<MockSession['renderState']>): void {
        Object.assign(this.renderState, update)
      }
      requestAnimationFrame(callback: (time: number, frame: MockFrame) => void): number {
        if (this.ended) return 0
        const id = nativeRAF((timestamp) => {
          this.pendingFrames.delete(id)
          if (!this.ended) {
            const frame = new MockFrame(this, timestamp)
            frame.run(() => callback(timestamp, frame))
          }
        })
        this.pendingFrames.add(id)
        return id
      }
      cancelAnimationFrame(id: number): void {
        nativeCancelRAF(id)
        this.pendingFrames.delete(id)
      }
      async end(): Promise<void> {
        if (this.ended) return
        this.ended = true
        state.sessionsEnded += 1
        this.pendingFrames.forEach(nativeCancelRAF)
        this.pendingFrames.clear()
        this.dispatchEvent(new Event('end'))
      }
    }

    let activeSession: MockSession | null = null
    const xr = new EventTarget()
    Object.assign(xr, {
      isSessionSupported: async (mode: string) => mode === 'immersive-ar',
      requestSession: async (mode: string, _options?: unknown) => {
        if (mode !== 'immersive-ar') throw new DOMException('Unsupported session mode', 'NotSupportedError')
        activeSession = new MockSession()
        state.sessionsStarted += 1
        return activeSession
      },
    })
    Object.defineProperty(navigator, 'xr', { configurable: true, value: xr })
    Object.defineProperty(window, 'XRWebGLBinding', { configurable: true, value: undefined })
    Object.defineProperty(window, 'XRWebGLLayer', { configurable: true, value: MockWebGLLayer })
    Object.defineProperty(window, 'XRRigidTransform', { configurable: true, value: MockRigidTransform })
    for (const ctor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (ctor) Object.defineProperty(ctor.prototype, 'makeXRCompatible', {
        configurable: true, value: async () => undefined,
      })
    }

    window.__xrMock = {
      moveViewer(x, z) { state.x = x; state.z = z },
      rotateViewer(yawDegrees) { state.yaw = yawDegrees },
      setTracking(available) { state.tracking = available },
      setSurface(available) { state.surface = available },
      select() {
        if (!activeSession || activeSession.ended) return
        const event = new Event('select')
        const session = activeSession
        const frame = new MockFrame(session, performance.now())
        Object.assign(event, { frame, inputSource: null })
        frame.run(() => session.dispatchEvent(event))
      },
      async end() { await activeSession?.end() },
      get hitsCanceled() { return state.hitsCanceled },
      get sessionsEnded() { return state.sessionsEnded },
      get sessionsStarted() { return state.sessionsStarted },
      get anchorsDeleted() { return state.anchorsDeleted },
    }
  })
}
