import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'
import QRCode from 'qrcode'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicUrl = 'https://chuljoon2026-boop.github.io/gaspring-pipes/'
const escapeHtml = (value) => value.replace(/[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      'base-url': { type: 'string' },
      location: { type: 'string', default: 'YS-001' },
      exact: { type: 'boolean', default: false },
      publish: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  })
  if (values.help) {
    console.log(`Usage: npm run qr -- [--url https://your-site.example/] [--location YS-001] [--publish]
Default: ${publicUrl}?location=YS-001
Alias: --base-url. --exact keeps the supplied URL without modifying its query/hash.
--publish copies the canonical public QR files into public/qr for website downloads.
Files: artifacts/qr/YS-001.png, YS-001.svg, YS-001-marker.png, YS-001.html, urls.json`)
    return
  }
  if (values.url && values['base-url']) throw new Error('Use either --url or --base-url, not both.')
  if (values.location !== 'YS-001') throw new Error('Unknown location. Only YS-001 is registered.')
  let url
  try {
    url = new URL(values.url || values['base-url'] || publicUrl)
  } catch {
    throw new Error('--url must be a complete http:// or https:// URL.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('Use an HTTP(S) URL without embedded credentials.')
  }
  if (!values.exact) {
    if (!url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += '/'
    url.searchParams.set('location', values.location)
    url.hash = ''
  }
  const finalUrl = url.href
  if (values.publish && finalUrl !== `${publicUrl}?location=YS-001`) {
    throw new Error('--publish requires the canonical public URL to keep website downloads consistent.')
  }
  const localOnly = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)
  const warning = localOnly
    ? '로컬 주소입니다. 외부에서 스캔하려면 공개 HTTPS 주소로 생성하세요.'
    : url.protocol !== 'https:' ? '카메라 기능에는 HTTPS 주소가 필요합니다.' : null
  const outputDir = path.join(root, 'artifacts', 'qr')
  await mkdir(outputDir, { recursive: true })
  const options = {
    errorCorrectionLevel: 'Q', margin: 4, width: 1200,
    color: { dark: '#142b50', light: '#ffffff' },
  }
  const svg = await QRCode.toString(finalUrl, { ...options, type: 'svg' })
  await QRCode.toFile(path.join(outputDir, 'YS-001.png'), finalUrl, { ...options, type: 'png' })
  await writeFile(path.join(outputDir, 'YS-001.svg'), svg, 'utf8')
  const font = (await readFile(path.join(root, 'src/assets/fonts/PretendardVariable.woff2'))).toString('base64')
  const fontLicense = await readFile(path.join(root, 'src/assets/fonts/OFL.txt'), 'utf8')
  const safeUrl = escapeHtml(finalUrl)
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#2D53BE"><title>현장 공사 조회 · YS-001</title>
<style>
@font-face{font-family:Pretendard;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-display:swap}
*{box-sizing:border-box}body{margin:0;background:#eef1f6;color:#142b50;font-family:Pretendard,"Malgun Gothic",sans-serif}
.toolbar{display:flex;justify-content:center;gap:12px;padding:24px;flex-wrap:wrap}.toolbar button,.toolbar a{border:0;border-radius:8px;background:#2D53BE;color:white;font:600 15px Pretendard,sans-serif;padding:13px 20px;cursor:pointer;text-decoration:none}.toolbar a{background:white;color:#203A78;border:1px solid #D4DCE8}
.marker{background:#fff;width:750px;min-height:1000px;margin:0 auto 32px;padding:46px 54px 34px;border-top:10px solid #2D53BE;display:flex;flex-direction:column;align-items:center;text-align:center}
.marker-header{width:100%;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #D4DCE8;padding-bottom:22px;font-size:20px;font-weight:650;color:#203A78}.marker-id{letter-spacing:1.3px;font-weight:750;font-size:19px}
h1{font-size:52px;letter-spacing:-2px;line-height:1.2;margin:32px 0 12px;font-weight:800}.subtitle{font-size:24px;letter-spacing:-.5px;color:#667386;margin:0 0 20px;line-height:1.5}
.qr{width:438px;max-width:100%;display:block;margin:0 auto;color:inherit}.qr svg{display:block;width:100%;height:auto}.scan{font-size:27px;font-weight:700;letter-spacing:-.7px;margin:18px 0 30px;line-height:1.4}
.features{width:100%;display:flex;justify-content:center;align-items:center;gap:24px;border-top:1px solid #D4DCE8;border-bottom:1px solid #D4DCE8;padding:21px 0;color:#203A78;font-size:20px;font-weight:650}.features span+span{border-left:1px solid #D4DCE8;padding-left:24px}
.url{margin-top:auto;padding-top:26px;font-size:15px;line-height:1.6;color:#667386;text-decoration:none;overflow-wrap:anywhere;width:100%}.url strong{display:block;color:#203A78;font-weight:550;margin-bottom:3px}
.warning{max-width:750px;margin:12px auto;padding:14px;color:#8a4400;background:#fff4df}
@media(max-width:780px){.marker{width:calc(100% - 28px);min-height:0;padding:28px 24px 26px}.marker-header{font-size:15px;padding-bottom:18px}.marker-id{font-size:14px}h1{font-size:clamp(28px,7vw,48px);letter-spacing:-1.3px;margin-top:26px}.subtitle{font-size:clamp(16px,3.4vw,23px);margin-bottom:12px}.qr{width:min(100%,438px)}.scan{font-size:clamp(18px,4vw,26px);margin:12px 0 24px}.features{font-size:clamp(12px,2.8vw,18px);gap:15px;padding:18px 0}.features span+span{padding-left:15px}.url{font-size:11px;padding-top:23px}.toolbar{padding:18px 12px}}
@page{size:150mm 200mm;margin:0}
@media print{html,body{background:#fff;width:150mm;height:200mm}.toolbar,.warning{display:none}.marker{width:150mm;height:200mm;min-height:0;margin:0;padding:9.2mm 10.8mm 6.8mm;border-top:2mm solid #2D53BE;print-color-adjust:exact;-webkit-print-color-adjust:exact}.marker-header{font-size:4mm;padding-bottom:4.4mm}.marker-id{font-size:3.8mm}h1{font-size:10.4mm;letter-spacing:-.4mm;margin:6.4mm 0 2.4mm}.subtitle{font-size:4.8mm;margin-bottom:4mm}.qr{width:87.6mm}.scan{font-size:5.4mm;margin:3.6mm 0 6mm}.features{gap:4.8mm;font-size:4mm;padding:4.2mm 0}.features span+span{padding-left:4.8mm}.url{font-size:3mm;padding-top:5.2mm}}
</style></head><body>
<div class="toolbar"><button type="button" onclick="window.print()">안내판 인쇄 / PDF 저장</button><a href="${safeUrl}">현장 페이지 열기</a></div>
${warning ? `<p class="warning">${escapeHtml(warning)}</p>` : ''}
<main class="marker">
  <div class="marker-header"><span>여수산단 안전정보</span><span class="marker-id">YS-001</span></div>
  <h1>현장 공사 조회</h1>
  <p class="subtitle">공사 현황 확인 · 현장 제보</p>
  <a class="qr" href="${safeUrl}" aria-label="현장 공사 조회 열기">${svg}</a>
  <p class="scan">스마트폰 카메라로 스캔하세요</p>
  <div class="features"><span>현장 조회</span><span>현장 제보</span><span>배관 열람</span></div>
  <a class="url" href="${safeUrl}"><strong>여수산단 · 구간 YS-001</strong>${escapeHtml(url.host + url.pathname)}</a>
</main><!-- Embedded Pretendard font license:
${fontLicense.replace(/--/g, '—')}
--></body></html>`
  const htmlPath = path.join(outputDir, 'YS-001.html')
  await writeFile(htmlPath, html, 'utf8')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1250 }, deviceScaleFactor: 2 })
    await page.goto(pathToFileURL(htmlPath).href)
    await page.evaluate(() => document.fonts.ready)
    await page.locator('.marker').screenshot({ path: path.join(outputDir, 'YS-001-marker.png') })
  } finally {
    await browser.close()
  }
  await writeFile(path.join(outputDir, 'urls.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    markers: [{ locationId: values.location, locationName: '여수산단', url: finalUrl,
      png: 'YS-001.png', svg: 'YS-001.svg', marker: 'YS-001-marker.png', printable: 'YS-001.html', warning }],
  }, null, 2)}\n`, 'utf8')
  if (values.publish) {
    const publishDir = path.join(root, 'public', 'qr')
    await mkdir(publishDir, { recursive: true })
    for (const filename of ['YS-001.png', 'YS-001.svg', 'YS-001-marker.png', 'YS-001.html']) {
      await copyFile(path.join(outputDir, filename), path.join(publishDir, filename))
    }
  }
  console.log(`QR generated: ${finalUrl}\nFiles: ${outputDir}${values.publish ? '\nWebsite downloads: public/qr/' : ''}`)
  if (warning) console.warn(warning)
}

main().catch((error) => {
  console.error(`QR generation failed: ${error.message}`)
  process.exitCode = 1
})
