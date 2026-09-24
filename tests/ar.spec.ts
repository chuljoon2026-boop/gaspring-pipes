import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { installXRMock } from './xr-mock'

async function openAR(page: Page) {
  await page.goto('/?location=YS-001#ar')
  await page.getByRole('button', { name: '접속 정보 자동입력', exact: true }).click()
  await page.getByRole('button', { name: '현장 확인', exact: true }).click()
  await expect(page).toHaveURL(/location=YS-001#ar$/)
  await expect(page.locator('[data-ar-mode="underground"]')).toHaveAttribute('data-ar-phase', 'idle')
  await expect(page.getByRole('heading', { name: '지하 투시 AR', exact: true })).toBeVisible()
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.stack || error.message) })
  return errors
}

async function worldState(page: Page) {
  return page.evaluate(async () => {
    // Read the same R3F module instance already loaded by Vite. This observes
    // the actual renderer's model/camera matrices without a production hook.
    const url = performance.getEntriesByType('resource')
      .map(entry => entry.name).find(name => name.includes('react-three_fiber'))!
    const fiber = await import(/* @vite-ignore */ url)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const model = state.scene.getObjectByName('grounded-pipe-model')
    const reticle = state.scene.getObjectByName('floor-placement-reticle')
    state.scene.updateMatrixWorld(true)
    const content = model.getObjectByName('PipeNetwork')
    const tube = content.children.find((object: { name: string; geometry?: { type: string } }) =>
      object.name === 'GP-001' && object.geometry?.type === 'TubeGeometry')
    tube.geometry.computeBoundingBox()
    const center = tube.geometry.boundingBox.getCenter(tube.position.clone())
    const top = center.clone().setY(tube.geometry.boundingBox.max.y)
    const clip = tube.material.clippingPlanes[0]
    const reference = content.localToWorld(content.position.clone().set(-7, -1.85, -7))
    return {
      matrix: [...model.matrix.elements] as number[],
      visible: model.visible as boolean,
      reticleVisible: reticle.visible as boolean,
      camera: state.camera.position.toArray() as number[],
      orientation: state.camera.quaternion.toArray() as number[],
      presenting: state.gl.xr.isPresenting as boolean,
      modelScale: tube.getWorldScale(tube.scale.clone()).toArray() as number[],
      reference: reference.toArray() as number[],
      tubeCenter: tube.localToWorld(center).toArray() as number[],
      tubeTopY: tube.localToWorld(top).y as number,
      backgroundIsNull: state.scene.background === null,
      clearAlpha: state.gl.getClearAlpha() as number,
      clippingEnabled: state.gl.localClippingEnabled as boolean,
      opacity: tube.material.opacity as number,
      depthWrite: tube.material.depthWrite as boolean,
      clip: { normal: clip.normal.toArray() as number[], constant: clip.constant as number },
      overlayBackground: getComputedStyle(document.querySelector('[data-ar-mode="underground"]')!).backgroundColor,
    }
  })
}

test('full-scale pipes stay below the ground in a transparent AR scene as the viewer moves and rotates', async ({ page }) => {
  const errors = collectErrors(page)
  await installXRMock(page)
  await openAR(page)
  await page.evaluate(() => {
    window.__xrMock.setGroundHeight(0.35)
    window.__xrMock.setSurface(false)
  })
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  const phase = page.locator('[data-ar-phase]')
  await expect(phase).toHaveAttribute('data-ar-phase', 'searching')
  await expect.poll(async () => (await worldState(page)).visible).toBe(false)

  await page.evaluate(() => window.__xrMock.setSurface(true))
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const placed = await worldState(page)
  expect(placed.visible).toBe(true)
  expect(placed.reticleVisible).toBe(false)
  expect(placed.matrix[12]).toBeCloseTo(0)
  expect(placed.matrix[13]).toBeCloseTo(0.35)
  expect(placed.matrix[14]).toBeCloseTo(0)
  expect(placed.modelScale).toEqual([1, 1, 1])
  // The drawing's hydrogen centre is 1.85m below the sensed ground, with no
  // bounding-box lift. The reference is 4m ahead of the initial viewer position.
  expect(placed.reference[0]).toBeCloseTo(0)
  expect(placed.reference[1]).toBeCloseTo(0.35 - 1.85)
  expect(placed.reference[2]).toBeCloseTo(-4)
  expect(placed.tubeCenter[1]).toBeCloseTo(0.35 - 1.85)
  expect(placed.tubeTopY).toBeLessThan(0.35)
  expect(placed.opacity).toBe(0.48)
  expect(placed.depthWrite).toBe(false)
  expect(placed.backgroundIsNull).toBe(true)
  expect(placed.clearAlpha).toBe(0)
  expect(placed.overlayBackground).toBe('rgba(0, 0, 0, 0)')
  expect(placed.clippingEnabled).toBe(true)
  expect(placed.clip.normal).toEqual([0, -1, 0])
  expect(placed.clip.constant).toBeCloseTo(0.35 + 0.012)

  await page.evaluate(() => window.__xrMock.moveViewer(0.75, -0.3))
  await expect.poll(async () => (await worldState(page)).camera[0]).toBeCloseTo(0.75)
  const moved = await worldState(page)
  expect(moved.camera[2]).toBeCloseTo(-0.3)
  expect(moved.matrix).toEqual(placed.matrix)
  expect(moved.reference).toEqual(placed.reference)

  await page.evaluate(() => window.__xrMock.rotateViewer(45))
  await expect.poll(async () => (await worldState(page)).orientation[1]).toBeGreaterThan(0.3)
  const rotated = await worldState(page)
  expect(rotated.orientation).not.toEqual(moved.orientation)
  expect(rotated.matrix).toEqual(placed.matrix)
  expect(rotated.reference).toEqual(placed.reference)

  await page.evaluate(() => window.__xrMock.setTracking(false))
  await expect(phase).toHaveAttribute('data-ar-phase', 'lost')
  await expect.poll(async () => (await worldState(page)).visible).toBe(false)
  await page.evaluate(() => window.__xrMock.setTracking(true))
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const recovered = await worldState(page)
  expect(recovered.visible).toBe(true)
  expect(recovered.matrix).toEqual(placed.matrix)
  expect(recovered.reference).toEqual(placed.reference)

  await page.getByRole('button', { name: 'AR 닫기', exact: true }).click()
  await expect(page).toHaveURL(/#worker$/)
  await expect.poll(() => page.evaluate(() => window.__xrMock.sessionsEnded)).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__xrMock.hitsCanceled)).toBe(1)
  expect(errors).toEqual([])
})

test('reset releases the old anchor and allows a new placement; stopping and native end release sessions', async ({ page }) => {
  const errors = collectErrors(page)
  await installXRMock(page)
  await openAR(page)
  const phase = page.locator('[data-ar-phase]')
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const first = await worldState(page)
  await page.evaluate(() => {
    window.__xrMock.setSurface(false)
    window.__xrMock.moveViewer(1, -0.5)
  })
  await page.getByRole('button', { name: '현재 위치로 다시 보기', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'searching')
  await expect.poll(async () => (await worldState(page)).visible).toBe(false)
  await expect.poll(() => page.evaluate(() => window.__xrMock.anchorsDeleted)).toBe(1)
  await page.evaluate(() => window.__xrMock.setSurface(true))
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const second = await worldState(page)
  expect(second.matrix).not.toEqual(first.matrix)
  expect(second.matrix.slice(12, 15)).toEqual([1, 0, -0.5])

  await page.getByRole('button', { name: '종료', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'idle')
  await expect.poll(async () => (await worldState(page)).presenting).toBe(false)
  await expect.poll(async () => (await worldState(page)).clearAlpha).toBe(1)
  expect((await worldState(page)).clip.constant).toBeCloseTo(0.012)
  expect(await page.evaluate(() => ({
    ended: window.__xrMock.sessionsEnded,
    canceled: window.__xrMock.hitsCanceled,
    anchors: window.__xrMock.anchorsDeleted,
  }))).toEqual({ ended: 1, canceled: 1, anchors: 2 })

  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  await page.evaluate(() => window.__xrMock.end())
  await expect(phase).toHaveAttribute('data-ar-phase', 'idle')
  await expect.poll(() => page.evaluate(() => window.__xrMock.sessionsEnded)).toBe(2)
  await expect.poll(() => page.evaluate(() => window.__xrMock.hitsCanceled)).toBe(2)
  await page.getByRole('button', { name: 'AR 닫기', exact: true }).click()
  await expect(page).toHaveURL(/#worker$/)
  expect(await page.evaluate(() => window.__xrMock.sessionsEnded)).toBe(2)
  expect(errors).toEqual([])
})

test('unsupported browsers including Quick Look-capable iOS do not offer a false underground AR mode', async ({ page }) => {
  const errors = collectErrors(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(navigator, 'xr')
    Reflect.deleteProperty(Object.getPrototypeOf(navigator), 'xr')
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    const supports = DOMTokenList.prototype.supports
    DOMTokenList.prototype.supports = function (token) {
      return token === 'ar' || supports.call(this, token)
    }
  })
  await openAR(page)
  await expect(page.getByRole('status')).toContainText('카메라를 사용할 수 없습니다')
  await expect(page.getByRole('button', { name: '카메라 켜기', exact: true })).toHaveCount(0)
  await expect(page.locator('video, a[rel="ar"]')).toHaveCount(0)
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForFunction(async () => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes('react-three_fiber'))
    if (!url) return false
    const fiber = await import(/* @vite-ignore */ url)
    return Boolean(fiber._roots.get(document.querySelector('canvas'))?.store.getState().scene.getObjectByName('PipeNetwork'))
  })
  await expect.poll(async () => (await worldState(page)).tubeCenter[1]).toBeCloseTo(-1.85)
  await page.getByRole('button', { name: '기능 선택으로', exact: true }).click()
  await expect(page).toHaveURL(/#worker$/)
  await expect(page.getByRole('heading', { name: '지하매설물 조회', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('permission rejection leaves AR idle and lets the user retry successfully', async ({ page }) => {
  const errors = collectErrors(page)
  await installXRMock(page)
  await openAR(page)
  await page.evaluate(() => {
    const xr = navigator.xr!
    const original = xr.requestSession.bind(xr)
    let denied = false
    xr.requestSession = ((...args: Parameters<typeof original>) => {
      if (!denied) {
        denied = true
        return Promise.reject(new DOMException('Permission denied by test', 'NotAllowedError'))
      }
      return original(...args)
    }) as typeof xr.requestSession
  })
  const start = page.getByRole('button', { name: '카메라 켜기', exact: true })
  await start.click()
  await expect(page.getByRole('status')).toContainText('카메라와 AR 사용 권한을 허용한 뒤 다시 시작해 주세요')
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'idle')
  await expect(start).toBeEnabled()
  expect(await page.evaluate(() => window.__xrMock.sessionsStarted)).toBe(0)
  await start.click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'placed')
  await expect(page.getByRole('status')).not.toContainText('권한')
  await page.getByRole('button', { name: '종료', exact: true }).click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'idle')
  expect(await page.evaluate(() => window.__xrMock.sessionsEnded)).toBe(1)
  expect(errors).toEqual([])
})


async function installCameraMock(page: Page, sceneImage = '') {
  await page.addInitScript((sceneImage) => {
    Reflect.deleteProperty(navigator, 'xr')
    Reflect.deleteProperty(Object.getPrototypeOf(navigator), 'xr')
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async () => 'granted' })
    const counter = { stopped: 0, acquired: 0 }
    Object.assign(window, { __cameraMock: counter })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 720; canvas.height = 1280
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#b5b3a9'; ctx.fillRect(0, 0, 720, 1280)
      ctx.strokeStyle = '#8a8c85'; ctx.lineWidth = 3
      for (let y = 0; y < 1280; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(720, y); ctx.stroke() }
      for (let x = 0; x < 720; x += 180) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1280); ctx.stroke() }
      if (sceneImage) {
        const image = new Image(); image.src = sceneImage; await image.decode()
        canvas.width = image.width; canvas.height = image.height
        // A camera aimed down: retain furniture edges above the foreground floor.
        ctx.drawImage(image, 0, image.height * 0.45, image.width, image.height * 0.55, 0, 0, canvas.width, canvas.height)
      }
      const stream = canvas.captureStream(15)
      counter.acquired++
      stream.getTracks().forEach(track => {
        const stop = track.stop.bind(track)
        track.stop = () => { if (track.readyState !== 'ended') counter.stopped++; stop() }
      })
      return stream
    } })
  }, sceneImage)
}

async function sensor(page: Page, alpha: number, beta: number) {
  await page.evaluate(({ alpha, beta }) => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha, beta, gamma: 0 }))
  }, { alpha, beta })
}

async function cameraState(page: Page) {
  return page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes('react-three_fiber'))!
    const fiber = await import(/* @vite-ignore */ url)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const root = state.scene.getObjectByName('camera-gis-origin')
    state.scene.updateMatrixWorld(true)
    const tube = root.getObjectByName('PipeNetwork').children.find((o: { geometry?: { type: string } }) => o.geometry?.type === 'TubeGeometry')
    return { visible: root.visible, matrix: [...root.matrixWorld.elements], camera: state.camera.quaternion.toArray(), opacity: tube.material.opacity,
      alpha: state.gl.getClearAlpha(), ...((window as unknown as { __cameraMock: { stopped: number; acquired: number } }).__cameraMock) }
  })
}

test('camera fallback reveals translucent GIS pipes automatically when aimed down and releases the camera', async ({ page }, info) => {
  const errors = collectErrors(page)
  await installCameraMock(page)
  await openAR(page)
  await expect(page.locator('[data-ar-backend]')).toHaveAttribute('data-ar-backend', 'camera')
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'searching')
  await sensor(page, 0, 90) // upright / not looking at the ground
  await expect.poll(async () => (await cameraState(page)).visible).toBe(false)
  await sensor(page, 0, 55)
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'placed')
  const first = await cameraState(page)
  expect(first.opacity).toBe(0.48)
  expect(first.alpha).toBe(0)
  await expect(page.getByText('간편 AR: 카메라 높이 1.4 m 가정 / 이동 추적 미지원', { exact: false })).toBeVisible()
  await page.screenshot({ path: `artifacts/screenshots/${info.project.name}-camera-gis.png` })
  await sensor(page, 35, 55)
  await expect.poll(async () => (await cameraState(page)).camera).not.toEqual(first.camera)
  expect((await cameraState(page)).matrix).toEqual(first.matrix)
  await page.getByRole('slider', { name: '배관 선명도', exact: true }).fill('0.3')
  await expect.poll(async () => (await cameraState(page)).opacity).toBe(0.3)
  await page.getByRole('button', { name: '현재 위치로 다시 보기', exact: true }).click()
  await expect.poll(async () => (await cameraState(page)).matrix).not.toEqual(first.matrix)
  await page.getByRole('button', { name: '종료', exact: true }).click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'idle')
  expect((await cameraState(page)).stopped).toBe(1)
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await sensor(page, 0, 55)
  await page.getByRole('button', { name: 'AR 닫기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '지하매설물 조회', exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __cameraMock: { stopped: number } }).__cameraMock.stopped)).toBe(2)
  expect(errors).toEqual([])
})

test('camera fallback reports missing orientation and releases the stream instead of claiming ground detection', async ({ page }) => {
  await installCameraMock(page)
  await openAR(page)
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('방향 센서 정보를 받지 못했습니다', { timeout: 10000 })
  expect((await cameraState(page)).stopped).toBe(1)
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'idle')
})

test('camera orientation permission denial does not acquire a stream and allows retry', async ({ page }) => {
  await installCameraMock(page)
  await openAR(page)
  await page.evaluate(() => Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async () => 'denied' }))
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('동작 및 방향 권한을 허용해 주세요')
  expect((await cameraState(page)).acquired).toBe(0)
  await page.evaluate(() => Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async () => 'granted' }))
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'searching')
  await sensor(page, 0, 55)
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'placed')
  await page.getByRole('button', { name: '종료', exact: true }).click()
  expect((await cameraState(page)).stopped).toBe(1)
})

test('a raised surface is not auto-registered as ground; registration works after lowering to the floor', async ({ page }) => {
  await installXRMock(page)
  await openAR(page)
  await page.evaluate(() => window.__xrMock.setGroundHeight(1.2))
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'searching')
  // Longer than the 450ms auto-registration window, with a disallowed surface.
  await page.waitForTimeout(700)
  expect((await worldState(page)).visible).toBe(false)
  await page.evaluate(() => window.__xrMock.setGroundHeight(0))
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'placed')
  expect((await worldState(page)).reference[1]).toBeCloseTo(-1.85)
  await page.getByRole('button', { name: 'AR 닫기', exact: true }).click()
})

test('leaving AR during camera permission acquisition releases a late stream', async ({ page }) => {
  const errors = collectErrors(page)
  await installCameraMock(page)
  await openAR(page)
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => new Promise<MediaStream>(resolve => {
      Object.assign(window, { __releaseCamera: async () => resolve(await original({ video: true })) })
    }) })
  })
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect.poll(() => page.evaluate(() => '__releaseCamera' in window)).toBe(true)
  await page.getByRole('button', { name: 'AR 닫기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '지하매설물 조회', exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __releaseCamera: () => Promise<void> }).__releaseCamera())
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cameraMock: { stopped: number } }).__cameraMock.stopped)).toBe(1)
  expect(errors).toEqual([])
})

async function maskState(page: Page) {
  return page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes('react-three_fiber'))!
    const fiber = await import(/* @vite-ignore */ url)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const tube = state.scene.getObjectByName('PipeNetwork').children.find((o: {geometry?: {type: string}}) => o.geometry?.type === 'TubeGeometry')
    const shader = { uniforms: {} as Record<string, { value: any }>, vertexShader: '#include <project_vertex>', fragmentShader: '#include <clipping_planes_fragment>' }
    tube.material.onBeforeCompile(shader, state.gl)
    const { data, width, height } = shader.uniforms.groundMask.value.image
    const pixel = (u: number, v: number) => data[Math.floor(v * height) * width + Math.floor(u * width)]
    return { enabled: shader.uniforms.groundMaskEnabled.value, floor: pixel(0.2, 0.7), object: pixel(0.5, 0.7), unknown: pixel(0.5, 0.01), feather: Array.from(data as Uint8Array).filter(value => value > 0 && value < 255).length, count: Array.from(data as Uint8Array).filter(value => value > 180).length }
  })
}

test('depth masks preserve floor but occlude foreground objects and never reuse missing depth', async ({ page }) => {
  const errors = collectErrors(page)
  page.on('console', message => { if (message.type() === 'error' && /Shader|WebGLProgram/.test(message.text())) errors.push(message.text()) })
  await installXRMock(page)
  await openAR(page)
  await page.evaluate(() => window.__xrMock.setDepthMode('obstacle'))
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(page.locator('[data-ground-mask]')).toHaveAttribute('data-ground-mask', 'depth')
  await expect.poll(async () => (await maskState(page)).floor).toBe(255)
  expect((await maskState(page)).object).toBe(0)
  expect((await maskState(page)).feather).toBeGreaterThan(20)
  expect((await maskState(page)).unknown).toBeLessThan(107)
  await page.evaluate(() => window.__xrMock.setDepthMode('missing'))
  await expect.poll(async () => (await maskState(page)).count).toBe(0)
  await page.evaluate(() => window.__xrMock.setDepthMode('floor'))
  await expect.poll(async () => (await maskState(page)).object).toBe(255)
  await page.getByRole('button', { name: '종료', exact: true }).click()
  expect(errors).toEqual([])
})

test('ordinary camera automatically segments real floor and shows selectable pipe metadata', async ({ page }, info) => {
  const errors = collectErrors(page)
  page.on('console', message => { if (message.type() === 'error' && /Ground segmentation|Shader|WebGLProgram/.test(message.text())) errors.push(message.text()) })
  const photo = 'data:image/jpeg;base64,' + readFileSync('tests/fixtures/ground-scene.jpg').toString('base64')
  await installCameraMock(page, photo)
  await openAR(page)
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'searching')
  await sensor(page, 0, 55)
  await expect(page.locator('[data-ground-mask]')).toHaveAttribute('data-ground-mask', 'vision', { timeout: 30_000 })
  await expect.poll(async () => (await maskState(page)).count).toBeGreaterThan(200)
  await expect.poll(async () => (await cameraState(page)).visible).toBe(true)
  expect((await maskState(page)).unknown).toBeLessThan(107)
  const card = page.getByRole('region', { name: '배관 정보', exact: true })
  await expect(card).toContainText('중심 심도 1.85 m')
  await expect(card).toContainText('관경 300 mm')
  await page.getByLabel('관로', { exact: true }).selectOption('GP-003')
  await expect(card).toContainText('중심 심도 2.10 m')
  await expect(card).toContainText('관경 250 mm')
  await expect(page.getByRole('button', { name: '심도 기준선', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '심도 기준선', exact: true }).click()
  await expect(page.getByRole('button', { name: '심도 기준선', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '심도 기준선', exact: true }).click()
  await expect(page.getByRole('button', { name: /지면 영역/ })).toHaveCount(0)
  await page.screenshot({ path: `artifacts/vision/${info.project.name}-automatic-camera.png` })
  await page.getByRole('button', { name: '종료', exact: true }).click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'idle')
  expect((await cameraState(page)).stopped).toBe(1)
  expect(errors).toEqual([])
})

test('XR without depth automatically switches to camera vision with one start tap', async ({ page }) => {
  await installCameraMock(page)
  await installXRMock(page)
  await openAR(page)
  await page.evaluate(() => window.__xrMock.setDepthMode('unsupported'))
  await page.getByRole('button', { name: '카메라 켜기', exact: true }).click()
  await expect(page.locator('[data-ar-backend]')).toHaveAttribute('data-ar-backend', 'camera')
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'searching')
  await sensor(page, 0, 55)
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'placed')
  expect(await page.evaluate(() => window.__xrMock.sessionsEnded)).toBe(1)
  await page.getByRole('button', { name: '종료', exact: true }).click()
  expect((await cameraState(page)).stopped).toBe(1)
})
