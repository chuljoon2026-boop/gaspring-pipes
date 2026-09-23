import { expect, test, type Page } from '@playwright/test'
import { installXRMock } from './xr-mock'

async function openAR(page: Page) {
  await page.goto('/?location=YS-001#ar')
  await page.getByRole('button', { name: '바로 열람', exact: true }).click()
  await expect(page).toHaveURL(/location=YS-001#ar$/)
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'idle')
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
    return {
      matrix: [...model.matrix.elements] as number[],
      visible: model.visible as boolean,
      reticleVisible: reticle.visible as boolean,
      camera: state.camera.position.toArray() as number[],
      orientation: state.camera.quaternion.toArray() as number[],
      presenting: state.gl.xr.isPresenting as boolean,
    }
  })
}

test('floor placement stays in world space while the viewer moves, and recovers after tracking loss', async ({ page }) => {
  const errors = collectErrors(page)
  await installXRMock(page)
  await openAR(page)
  await page.evaluate(() => window.__xrMock.setSurface(false))
  await page.getByRole('button', { name: '바닥 AR 시작', exact: true }).click()
  const phase = page.locator('[data-ar-phase]')
  await expect(phase).toHaveAttribute('data-ar-phase', 'searching')
  await expect(page.getByRole('button', { name: '바닥을 찾는 중', exact: true })).toBeDisabled()
  await expect.poll(async () => (await worldState(page)).visible).toBe(false)

  await page.evaluate(() => window.__xrMock.setSurface(true))
  await expect(phase).toHaveAttribute('data-ar-phase', 'surface')
  await expect.poll(async () => (await worldState(page)).reticleVisible).toBe(true)
  await page.getByRole('button', { name: '여기에 배관 놓기', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const placed = await worldState(page)
  expect(placed.visible).toBe(true)
  expect(placed.reticleVisible).toBe(false)
  expect(placed.matrix.slice(12, 15)).toEqual([0, 0, -2])

  await page.evaluate(() => window.__xrMock.moveViewer(0.75, -0.3))
  await expect.poll(async () => (await worldState(page)).camera[0]).toBeCloseTo(0.75)
  const moved = await worldState(page)
  expect(moved.camera[2]).toBeCloseTo(-0.3)
  expect(moved.matrix).toEqual(placed.matrix)

  await page.evaluate(() => window.__xrMock.rotateViewer(45))
  await expect.poll(async () => (await worldState(page)).orientation[1]).toBeGreaterThan(0.3)
  const rotated = await worldState(page)
  expect(rotated.orientation).not.toEqual(moved.orientation)
  expect(rotated.matrix).toEqual(placed.matrix)

  await page.evaluate(() => window.__xrMock.setTracking(false))
  await expect(phase).toHaveAttribute('data-ar-phase', 'lost')
  await expect.poll(async () => (await worldState(page)).visible).toBe(false)
  await page.evaluate(() => window.__xrMock.setTracking(true))
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const recovered = await worldState(page)
  expect(recovered.visible).toBe(true)
  expect(recovered.matrix).toEqual(placed.matrix)

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
  await page.getByRole('button', { name: '바닥 AR 시작', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'surface')
  // Native XR select should place the model just as the overlay button does.
  await page.evaluate(() => window.__xrMock.select())
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const first = await worldState(page)
  await page.evaluate(() => {
    window.__xrMock.setSurface(false)
    window.__xrMock.moveViewer(1, -0.5)
  })
  await page.getByRole('button', { name: '다시 배치', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'searching')
  await expect.poll(async () => (await worldState(page)).visible).toBe(false)
  await expect.poll(() => page.evaluate(() => window.__xrMock.anchorsDeleted)).toBe(1)
  await page.evaluate(() => window.__xrMock.setSurface(true))
  await expect(phase).toHaveAttribute('data-ar-phase', 'surface')
  await page.getByRole('button', { name: '여기에 배관 놓기', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const second = await worldState(page)
  expect(second.matrix).not.toEqual(first.matrix)
  expect(second.matrix.slice(12, 15)).toEqual([1, 0, -2.5])

  await page.getByRole('button', { name: 'AR 종료', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'idle')
  await expect.poll(async () => (await worldState(page)).presenting).toBe(false)
  expect(await page.evaluate(() => ({
    ended: window.__xrMock.sessionsEnded,
    canceled: window.__xrMock.hitsCanceled,
    anchors: window.__xrMock.anchorsDeleted,
  }))).toEqual({ ended: 1, canceled: 1, anchors: 2 })

  await page.getByRole('button', { name: '바닥 AR 시작', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'surface')
  await page.evaluate(() => window.__xrMock.end())
  await expect(phase).toHaveAttribute('data-ar-phase', 'idle')
  await expect.poll(() => page.evaluate(() => window.__xrMock.sessionsEnded)).toBe(2)
  await expect.poll(() => page.evaluate(() => window.__xrMock.hitsCanceled)).toBe(2)
  await page.getByRole('button', { name: 'AR 닫기', exact: true }).click()
  await expect(page).toHaveURL(/#worker$/)
  expect(await page.evaluate(() => window.__xrMock.sessionsEnded)).toBe(2)
  expect(errors).toEqual([])
})

test('unsupported browsers explain the limitation and return to the ordinary 3D viewer', async ({ page }) => {
  const errors = collectErrors(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(navigator, 'xr')
    Reflect.deleteProperty(Object.getPrototypeOf(navigator), 'xr')
  })
  await openAR(page)
  await expect(page.getByRole('status')).toContainText('이 브라우저에서는 바닥 위치 추적을 사용할 수 없습니다')
  await expect(page.getByRole('button', { name: '바닥 AR 시작', exact: true })).toHaveCount(0)
  await expect(page.locator('video')).toHaveCount(0)
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: '3D 배관 보기', exact: true }).click()
  await expect(page).toHaveURL(/#worker$/)
  await expect(page.getByRole('heading', { name: '도로 하부 배관', exact: true })).toBeVisible()
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
  const start = page.getByRole('button', { name: '바닥 AR 시작', exact: true })
  await start.click()
  await expect(page.getByRole('status')).toContainText('AR 사용 권한을 허용한 뒤 다시 시작해 주세요')
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'idle')
  await expect(start).toBeEnabled()
  expect(await page.evaluate(() => window.__xrMock.sessionsStarted)).toBe(0)
  await start.click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'surface')
  await expect(page.getByRole('status')).not.toContainText('권한')
  await page.getByRole('button', { name: 'AR 종료', exact: true }).click()
  await expect(page.locator('[data-ar-phase]')).toHaveAttribute('data-ar-phase', 'idle')
  expect(await page.evaluate(() => window.__xrMock.sessionsEnded)).toBe(1)
  expect(errors).toEqual([])
})

test('Quick Look receives a nonempty USDZ model and releases replaced and closed blob URLs', async ({ page }) => {
  const errors = collectErrors(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(navigator, 'xr')
    Reflect.deleteProperty(Object.getPrototypeOf(navigator), 'xr')
    const supports = DOMTokenList.prototype.supports
    DOMTokenList.prototype.supports = function (token) {
      return token === 'ar' || supports.call(this, token)
    }
    const revoked: string[] = []
    Object.assign(window, { __arRevoked: revoked })
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.revokeObjectURL = (url) => { revoked.push(url); revoke(url) }
  })
  await openAR(page)
  const link = page.getByRole('link', { name: 'iPhone에서 바닥 AR 열기', exact: true })
  await expect(link).toHaveAttribute('rel', 'ar')
  await expect(link).toHaveAttribute('download', 'YS-001-pipes.usdz')
  await expect(link).toHaveAttribute('href', /^blob:/)
  await expect(link.locator('img')).toHaveCount(1)
  const firstUrl = (await link.getAttribute('href'))!
  const archive = await page.evaluate(async (url) => {
    const response = await fetch(url)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const moduleUrl = '/node_modules/three/examples/jsm/libs/fflate.module.js'
    const { unzipSync } = await import(/* @vite-ignore */ moduleUrl)
    const entries = unzipSync(bytes) as Record<string, Uint8Array>
    const text = Object.values(entries).map(value => new TextDecoder().decode(value)).join('\n')
    return {
      type: response.headers.get('content-type'),
      size: bytes.byteLength,
      magic: Array.from(bytes.slice(0, 4)),
      geometryFiles: Object.keys(entries).filter(name => name.startsWith('geometries/')).length,
      hasMeshes: text.includes('def Mesh'),
      horizontalAnchor: text.includes('planeAnchoring:alignment = "horizontal"'),
    }
  }, firstUrl)
  expect(archive.type).toBe('model/vnd.usdz+zip')
  expect(archive.size).toBeGreaterThan(10_000)
  expect(archive.magic).toEqual([0x50, 0x4b, 0x03, 0x04])
  expect(archive.geometryFiles).toBeGreaterThan(10)
  expect(archive.hasMeshes).toBe(true)
  expect(archive.horizontalAnchor).toBe(true)

  await page.getByLabel('모형 크기', { exact: true }).selectOption('0.1')
  await expect(link).toHaveAttribute('href', /^blob:/)
  await expect(link).not.toHaveAttribute('href', firstUrl)
  await expect.poll(() => page.evaluate((url) =>
    (window as unknown as { __arRevoked: string[] }).__arRevoked.includes(url), firstUrl)).toBe(true)
  const secondUrl = (await link.getAttribute('href'))!
  await page.getByRole('button', { name: 'AR 닫기', exact: true }).click()
  await expect(page).toHaveURL(/#worker$/)
  await expect.poll(() => page.evaluate((url) =>
    (window as unknown as { __arRevoked: string[] }).__arRevoked.includes(url), secondUrl)).toBe(true)
  expect(errors).toEqual([])
})
