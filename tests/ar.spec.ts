import { expect, test, type Page } from '@playwright/test'
import { installXRMock } from './xr-mock'

async function openAR(page: Page) {
  await page.goto('/?location=YS-001#ar')
  await page.getByRole('button', { name: '바로 열람', exact: true }).click()
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
      clip: { normal: clip.normal.toArray() as number[], constant: clip.constant as number },
      overlayBackground: getComputedStyle(document.querySelector('[data-ar-mode="underground"]')!).backgroundColor,
    }
  })
}

test('full-scale pipes stay below the ground in a transparent AR scene as the viewer moves and rotates', async ({ page }) => {
  const errors = collectErrors(page)
  await installXRMock(page)
  await openAR(page)
  await expect(page.getByLabel('기준 배관', { exact: true })).toHaveValue('GP-001')
  await page.evaluate(() => {
    window.__xrMock.setGroundHeight(0.35)
    window.__xrMock.setSurface(false)
  })
  await page.getByRole('button', { name: '카메라로 지하 투시', exact: true }).click()
  const phase = page.locator('[data-ar-phase]')
  await expect(phase).toHaveAttribute('data-ar-phase', 'searching')
  await expect(page.getByRole('button', { name: '지면을 찾는 중', exact: true })).toBeDisabled()
  await expect.poll(async () => (await worldState(page)).visible).toBe(false)

  await page.evaluate(() => window.__xrMock.setSurface(true))
  await expect(phase).toHaveAttribute('data-ar-phase', 'surface')
  await expect.poll(async () => (await worldState(page)).reticleVisible).toBe(true)
  await page.getByRole('button', { name: '이 지면에 맞춰 투시', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const placed = await worldState(page)
  expect(placed.visible).toBe(true)
  expect(placed.reticleVisible).toBe(false)
  expect(placed.matrix[12]).toBeCloseTo(0)
  expect(placed.matrix[13]).toBeCloseTo(0.35)
  expect(placed.matrix[14]).toBeCloseTo(-2)
  await expect(page.getByLabel('기준 배관', { exact: true })).toBeDisabled()
  expect(placed.modelScale).toEqual([1, 1, 1])
  // The drawing's hydrogen centre is 1.85m below the sensed ground, with no
  // bounding-box lift. Its selected reference lies directly under the anchor.
  expect(placed.reference[0]).toBeCloseTo(0)
  expect(placed.reference[1]).toBeCloseTo(0.35 - 1.85)
  expect(placed.reference[2]).toBeCloseTo(-2)
  expect(placed.tubeCenter[1]).toBeCloseTo(0.35 - 1.85)
  expect(placed.tubeTopY).toBeLessThan(0.35)
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
  await expect(page.getByLabel('기준 배관', { exact: true })).toBeDisabled()
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
  await page.getByRole('button', { name: '카메라로 지하 투시', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'surface')
  // Native XR select should place the model just as the overlay button does.
  await page.evaluate(() => window.__xrMock.select())
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const first = await worldState(page)
  await page.evaluate(() => {
    window.__xrMock.setSurface(false)
    window.__xrMock.moveViewer(1, -0.5)
  })
  await page.getByRole('button', { name: '기준점 다시 맞추기', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'searching')
  await expect.poll(async () => (await worldState(page)).visible).toBe(false)
  await expect.poll(() => page.evaluate(() => window.__xrMock.anchorsDeleted)).toBe(1)
  await expect(page.getByLabel('기준 배관', { exact: true })).toBeEnabled()
  await page.evaluate(() => window.__xrMock.setSurface(true))
  await expect(phase).toHaveAttribute('data-ar-phase', 'surface')
  await page.getByRole('button', { name: '이 지면에 맞춰 투시', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'placed')
  const second = await worldState(page)
  expect(second.matrix).not.toEqual(first.matrix)
  expect(second.matrix.slice(12, 15)).toEqual([1, 0, -2.5])

  await page.getByRole('button', { name: 'AR 종료', exact: true }).click()
  await expect(phase).toHaveAttribute('data-ar-phase', 'idle')
  await expect.poll(async () => (await worldState(page)).presenting).toBe(false)
  await expect.poll(async () => (await worldState(page)).clearAlpha).toBe(1)
  expect((await worldState(page)).clip.constant).toBeCloseTo(0.012)
  expect(await page.evaluate(() => ({
    ended: window.__xrMock.sessionsEnded,
    canceled: window.__xrMock.hitsCanceled,
    anchors: window.__xrMock.anchorsDeleted,
  }))).toEqual({ ended: 1, canceled: 1, anchors: 2 })

  await page.getByRole('button', { name: '카메라로 지하 투시', exact: true }).click()
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

test('unsupported browsers including Quick Look-capable iOS do not offer a false underground AR mode', async ({ page }) => {
  const errors = collectErrors(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(navigator, 'xr')
    Reflect.deleteProperty(Object.getPrototypeOf(navigator), 'xr')
    const supports = DOMTokenList.prototype.supports
    DOMTokenList.prototype.supports = function (token) {
      return token === 'ar' || supports.call(this, token)
    }
  })
  await openAR(page)
  await expect(page.getByRole('status')).toContainText('이 브라우저는 지하 투시 AR을 지원하지 않습니다')
  await expect(page.getByRole('button', { name: '카메라로 지하 투시', exact: true })).toHaveCount(0)
  await expect(page.locator('video, a[rel="ar"]')).toHaveCount(0)
  await expect(page.locator('canvas')).toBeVisible()
  await expect.poll(async () => (await worldState(page)).tubeCenter[1]).toBeCloseTo(-1.85)
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
  const start = page.getByRole('button', { name: '카메라로 지하 투시', exact: true })
  await start.click()
  await expect(page.getByRole('status')).toContainText('카메라와 AR 사용 권한을 허용한 뒤 다시 시작해 주세요')
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

