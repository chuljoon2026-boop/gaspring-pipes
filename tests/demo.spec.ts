import { expect, test, type Page, type TestInfo } from '@playwright/test'

const markerUrl = '/?location=YS-001'

async function capture(page: Page, testInfo: TestInfo, screen: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `artifacts/screenshots/${testInfo.project.name}-${screen}.png`, fullPage: true, animations: 'disabled' })
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function authenticate(page: Page) {
  await page.goto(`${markerUrl}#login`)
  await page.getByRole('button', { name: '데모 계정 입력', exact: true }).click()
  await page.getByRole('button', { name: '작업자 인증 후 입장', exact: true }).click()
  await expect(page).toHaveURL(/location=YS-001#worker$/)
  await expect(page.locator('canvas')).toBeVisible()
}

test('QR로 진입하면 현장 위치와 굴착 신고 경고를 표시한다', async ({ page }, testInfo) => {
  await page.goto(markerUrl)
  await expect(page.getByRole('heading', { name: /현재 굴착공사\s*신고 내역 확인 불가/ })).toBeVisible()
  await expect(page.getByText('여수산단 A-12 구역', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('YS-001', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '미신고 굴착 신고하기', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expect(page.locator('canvas')).toBeVisible()
  await capture(page, testInfo, 'home')
})

test('시민 신고를 접수하고 같은 브라우저에서 이력을 유지한다', async ({ page }) => {
  await page.goto(markerUrl)
  await page.getByRole('button', { name: '미신고 굴착 신고하기', exact: true }).click()
  await expect(page).toHaveURL(/location=YS-001#report$/)
  await page.goBack()
  await expect(page.getByRole('button', { name: '미신고 굴착 신고하기', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/location=YS-001(?:#home)?$/)
  await page.goForward()
  await expect(page).toHaveURL(/location=YS-001#report$/)
  await expect(page.getByLabel('현재 위치', { exact: true })).toHaveValue('여수산단 A-12 구역')
  await expect(page.getByLabel('현재 위치', { exact: true })).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: '신고 접수', exact: true }).click()
  await expect(page).toHaveURL(/location=YS-001#report$/)
  expect(await page.getByLabel(/^신고 사유/).evaluate((element: HTMLTextAreaElement) => element.validity.valueMissing)).toBe(true)
  await page.locator('input[type="file"]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') })
  await expect(page.getByRole('alert')).toContainText('이미지를 선택해 주세요')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'site-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'),
  })
  const preview = page.getByRole('img', { name: '첨부한 현장 이미지 미리보기', exact: true })
  await expect(preview).toBeVisible()
  await expect.poll(() => preview.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  await expect(page.getByText('site-photo.png', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '첨부 사진 삭제', exact: true }).click()
  await page.getByRole('button', { name: '데모 사진 사용', exact: true }).click()
  await expect(page.getByRole('img', { name: '첨부한 현장 이미지 미리보기', exact: true })).toBeVisible()
  await page.getByLabel(/^신고 사유/).fill('안전 표지와 현장 허가 안내 없이 굴착 장비가 작업하고 있습니다.')
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: '신고 접수', exact: true }).click()
  await expect(page).toHaveURL(/location=YS-001#complete$/)
  await expect(page.getByRole('heading', { name: '신고가 접수되었습니다', exact: true })).toBeVisible()
  await expect(page.getByText('실제 기관에 전송되지 않은 브라우저 내 데모 접수입니다.', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto(`${markerUrl}#history`)
  await expect(page.getByText('안전 표지와 현장 허가 안내 없이 굴착 장비가 작업하고 있습니다.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('안전 표지와 현장 허가 안내 없이 굴착 장비가 작업하고 있습니다.', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('로그인하지 않은 작업자 전용 경로는 인증 화면으로 안내한다', async ({ page }) => {
  for (const route of ['worker', 'ar']) {
    await page.goto(`${markerUrl}#${route}`)
    await expect(page.getByLabel('굴착공사 허가번호', { exact: true })).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  }
})

test('미등록 마커를 차단하고 잘못된 화면 주소를 안전하게 처리한다', async ({ page }) => {
  for (const route of ['home', 'report', 'worker']) {
    await page.goto(`/?location=UNKNOWN-999#${route}`)
    await expect(page.getByRole('heading', { name: '등록되지 않은 QR 마커입니다', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '미신고 굴착 신고하기', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '신고 접수', exact: true })).toHaveCount(0)
    await expect(page.locator('canvas')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  }
  await page.goto(`${markerUrl}#__proto__`)
  await expect(page.getByRole('heading', { name: /현재 굴착공사\s*신고 내역 확인 불가/ })).toBeVisible()
})

test('잘못된 인증을 막고 로그인 후 3D 배관과 표시 레이어를 조작한다', async ({ page }, testInfo) => {
  // Several real WebGL renders and pixel comparisons run through software rendering in CI.
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${markerUrl}#login`)
  await page.getByLabel('굴착공사 허가번호', { exact: true }).fill('YS-2026-001')
  await page.getByLabel('대표자명 또는 작업자명', { exact: true }).fill('테스트 작업자')
  await page.getByLabel('데모 비밀번호', { exact: true }).fill('0000')
  await page.getByRole('button', { name: '작업자 인증 후 입장', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('허가번호 또는 비밀번호를 확인해 주세요')
  await expect(page.locator('canvas')).toHaveCount(0)
  await authenticate(page)
  await expect(page.getByRole('button', { name: 'AR 보기', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '가스 주배관 GP-001 상세 정보', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await capture(page, testInfo, 'worker')
  const facility = page.getByRole('combobox', { name: '시설 선택', exact: true })
  await facility.selectOption('GP-002')
  await expect(page.locator('.selected-pipe')).toContainText('중압 도시가스 분기관')
  await expect(page.locator('.pipe-measurements')).toContainText('200')
  await facility.selectOption('V-001')
  await expect(page.locator('.selected-pipe')).toContainText('분기관 차단 밸브')
  await expect(page.locator('.pipe-measurements')).toContainText('200')
  await expect(page.locator('.pipe-measurements')).toContainText('연결 분기관 외경')
  await facility.selectOption('GP-001')
  await expect(page.locator('.pipe-measurements')).toContainText('300')
  const canvas = page.locator('canvas')
  await canvas.scrollIntoViewIfNeeded()
  const initialView = await canvas.screenshot()
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  if (bounds) {
    await page.mouse.move(bounds.x + bounds.width * 0.72, bounds.y + bounds.height * 0.35)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width * 0.42, bounds.y + bounds.height * 0.5, { steps: 12 })
    await page.mouse.up()
    await page.mouse.wheel(0, -180)
    await expect.poll(async () => (await canvas.screenshot()).equals(initialView)).toBe(false)
  }
  await page.getByRole('button', { name: '3D 시점 초기화', exact: true }).click()
  await page.getByRole('button', { name: '평면 뷰', exact: true }).click()
  await expect(page.getByRole('button', { name: '평면 뷰', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '3D 뷰', exact: true }).click()
  await expect(page.getByRole('button', { name: '3D 뷰', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('switch', { name: '배관 정보 라벨', exact: true }).click()
  await expect(page.getByRole('button', { name: '가스 주배관 GP-001 상세 정보', exact: true })).toHaveCount(0)
  await page.getByRole('switch', { name: '배관 정보 라벨', exact: true }).click()
  await expect(page.getByRole('button', { name: '가스 주배관 GP-001 상세 정보', exact: true })).toBeVisible()
  await page.getByRole('switch', { name: '굴착 주의 영역', exact: true }).click()
  await expect(page.getByRole('switch', { name: '굴착 주의 영역', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('switch', { name: '굴착 주의 영역', exact: true }).click()
  await expect(page.getByRole('switch', { name: '굴착 주의 영역', exact: true })).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('slider', { name: '지표면 불투명도', exact: true }).press('End')
  await expect(page.getByRole('slider', { name: '지표면 불투명도', exact: true })).toHaveValue('0.85')
  await page.getByRole('button', { name: '작업자 로그아웃', exact: true }).click()
  await page.goto(`${markerUrl}#worker`)
  await expect(page.getByLabel('굴착공사 허가번호', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('복합 관로와 판을 선택하고 분해·숨김 상태를 확인한다', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await authenticate(page)
  const facility = page.getByRole('combobox', { name: '시설 선택' })
  await facility.selectOption('WP-001')
  await expect(page.locator('.pipe-measurements')).toContainText('1.65')
  await expect(page.locator('.pipe-measurements')).toContainText('250')
  await expect(page.locator('.pipe-details')).toContainText('덕타일 주철관')
  await page.getByRole('switch', { name: '상수·배수·전력관', exact: true }).click()
  await expect(page.getByRole('button', { name: '상수관 WP-001 상세 정보' })).toHaveCount(0)
  await page.getByRole('switch', { name: '상수·배수·전력관', exact: true }).click()
  await facility.selectOption('PL-001')
  await expect(page.locator('.pipe-measurements')).toContainText('1.55 × 0.95 × 0.06 m')
  await expect(page.getByRole('button', { name: '보호판 PL-001 상세 정보' })).toBeVisible()
  const before = await page.locator('canvas').screenshot()
  await page.getByRole('button', { name: '판 분해 보기' }).click()
  await expect(page.getByRole('button', { name: '판 분해 보기' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await page.locator('canvas').screenshot()).equals(before)).toBe(false)
  await capture(page, testInfo, 'network-exploded')
  await page.getByRole('switch', { name: '보호판·복공판·지지판', exact: true }).click()
  await expect(page.getByRole('button', { name: '보호판 PL-001 상세 정보' })).toHaveCount(0)
  await page.getByRole('switch', { name: '보호판·복공판·지지판', exact: true }).click()
  await page.getByRole('button', { name: '판 분해 보기' }).click()
  await facility.selectOption('EL-001')
  await expect(page.locator('.pipe-measurements')).toContainText('0.6')
  await expect(page.locator('.pipe-details')).toContainText('합성수지 보호관')
  await facility.selectOption('GP-001')
  await expect(page.locator('.viewer-location > span > strong')).toHaveCSS('filter', 'blur(4px)')
  await expectNoHorizontalOverflow(page)
  await capture(page, testInfo, 'network')
  await page.getByRole('switch', { name: '주변 건물·도로', exact: true }).click()
  await expect(page.locator('.private-map-name')).toHaveCount(0)
  await page.getByRole('button', { name: '판 분해 보기' }).click()
  await capture(page, testInfo, 'network-focus')
})

test('카메라 권한이 없어도 AR 시뮬레이션을 사용할 수 있다', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => { throw new DOMException('Camera permission denied for test', 'NotAllowedError') },
    })
  })
  await authenticate(page)
  await page.getByRole('button', { name: 'AR 보기', exact: true }).click()
  await expect(page).toHaveURL(/location=YS-001#ar$/)
  await expect(page.getByRole('heading', { name: '현장 위에, 배관을 보다', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '가스 주배관 GP-001 상세 정보', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '현장 카메라 켜기', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('카메라에 접근할 수 없습니다')
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: 'AR 위험구역 표시', exact: true }).click()
  await expect(page.getByRole('button', { name: 'AR 위험구역 표시', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'AR 시점 초기화', exact: true }).click()
  await expectNoHorizontalOverflow(page)
  await capture(page, testInfo, 'ar')
  await page.getByRole('button', { name: 'AR 닫기', exact: true }).click()
  await expect(page).toHaveURL(/location=YS-001#worker$/)
})

test('배포 주소로 생성한 QR에 마커 ID를 포함하고 다운로드할 수 있다', async ({ page }, testInfo) => {
  await page.goto(`${markerUrl}#qr`)
  await page.getByLabel('웹페이지 주소', { exact: true }).fill('https://demo:secret@gas-on-demo.vercel.app/demo')
  await page.getByRole('button', { name: '이 주소로 QR 생성', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('로그인 정보가 포함되지 않은')
  await page.getByLabel('웹페이지 주소', { exact: true }).fill('https://gas-on-demo.vercel.app/demo?source=stage#login')
  await page.getByRole('button', { name: '이 주소로 QR 생성', exact: true }).click()
  const target = 'https://gas-on-demo.vercel.app/demo/?source=stage&location=YS-001'
  const qr = page.getByRole('img', { name: `여수산단 YS-001 현장 접속 QR 코드: ${target}`, exact: true })
  await expect(qr).toBeVisible()
  await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/)
  await expect(page.getByText(target, { exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'QR 이미지 다운로드', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('QR-YS-001.png')
  expect(await download.failure()).toBeNull()
  await expectNoHorizontalOverflow(page)
  await capture(page, testInfo, 'qr')
})

test.describe('합성 카메라 스트림', () => {
  test('합성 영상이 재생되고 시뮬레이션 전환과 AR 종료 시 스트림을 해제한다', async ({ page }) => {
    test.setTimeout(60_000)
    // A real browser MediaStream exercises video playback and track cleanup.
    // Camera hardware/OS permission integration requires a physical-device check.
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: async () => {
          const canvas = document.createElement('canvas')
          canvas.width = 640
          canvas.height = 360
          const context = canvas.getContext('2d')!
          context.fillStyle = '#abc6b6'
          context.fillRect(0, 0, canvas.width, canvas.height)
          const stream = canvas.captureStream(10)
          requestAnimationFrame(() => {
            context.fillStyle = '#52786b'
            context.fillRect(0, 180, canvas.width, 180)
          })
          return stream
        },
      })
    })
    await authenticate(page)
    await page.getByRole('button', { name: 'AR 보기', exact: true }).click()
    await page.getByRole('button', { name: '현장 카메라 켜기', exact: true }).click()
    await expect(page.getByRole('button', { name: '시뮬레이션으로 전환', exact: true })).toBeVisible()
    const video = page.locator('video')
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBeGreaterThan(0)
    const firstTrack = await video.evaluateHandle((element: HTMLVideoElement) => (element.srcObject as MediaStream).getVideoTracks()[0])
    expect(await firstTrack.evaluate(track => track.readyState)).toBe('live')
    await page.getByRole('button', { name: '시뮬레이션으로 전환', exact: true }).click()
    await expect.poll(() => firstTrack.evaluate(track => track.readyState)).toBe('ended')
    expect(await video.evaluate((element: HTMLVideoElement) => element.srcObject === null)).toBe(true)
    await firstTrack.dispose()

    await page.getByRole('button', { name: '현장 카메라 켜기', exact: true }).click()
    await expect(page.getByRole('button', { name: '시뮬레이션으로 전환', exact: true })).toBeVisible()
    const secondTrack = await video.evaluateHandle((element: HTMLVideoElement) => (element.srcObject as MediaStream).getVideoTracks()[0])
    await page.getByRole('button', { name: 'AR 닫기', exact: true }).click()
    await expect(page).toHaveURL(/location=YS-001#worker$/)
    await expect.poll(() => secondTrack.evaluate(track => track.readyState)).toBe('ended')
    await secondTrack.dispose()
  })
})
