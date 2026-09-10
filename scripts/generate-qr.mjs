import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import QRCode from 'qrcode'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const escapeHtml = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  )

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      'base-url': { type: 'string' },
      location: { type: 'string', default: 'YS-001' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  })
  if (values.help) {
    console.log(
      'Usage: npm run qr -- --url https://your-site.vercel.app/ --location YS-001\nAlias: --base-url. Default: http://localhost:5173/ (desktop only).\nFiles: artifacts/qr/YS-001.png, YS-001.svg, YS-001.html, urls.json',
    )
    return
  }
  if (values.url && values['base-url']) throw new Error('Use either --url or --base-url, not both.')
  if (values.location !== 'YS-001')
    throw new Error('Unknown location. This demo supports YS-001 only.')
  const inputUrl = values.url || values['base-url'] || 'http://localhost:5173/'
  let url
  try {
    url = new URL(inputUrl)
  } catch {
    throw new Error('--url must be a complete http:// or https:// URL.')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error('Use an HTTP(S) URL without embedded credentials.')
  }
  if (!url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += '/'
  url.searchParams.set('location', values.location)
  url.hash = ''
  const finalUrl = url.toString()
  const localOnly = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)
  const warning = localOnly
    ? '이 QR은 PC 로컬 확인용입니다. 스마트폰에서 사용하려면 배포 HTTPS 주소 또는 같은 Wi-Fi의 PC IP로 다시 생성하세요.'
    : url.protocol !== 'https:'
      ? 'HTTP 주소는 같은 네트워크의 UI 시연용입니다. 스마트폰 카메라와 PWA 설치에는 HTTPS 배포를 사용하세요.'
      : ''
  const outputDir = path.join(root, 'artifacts', 'qr')
  await mkdir(outputDir, { recursive: true })
  const options = {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 1200,
    color: { dark: '#172c2a', light: '#ffffff' },
  }
  const svg = await QRCode.toString(finalUrl, { ...options, type: 'svg' })
  await QRCode.toFile(path.join(outputDir, `${values.location}.png`), finalUrl, {
    ...options,
    type: 'png',
  })
  await writeFile(path.join(outputDir, `${values.location}.svg`), svg, 'utf8')
  const safeUrl = escapeHtml(finalUrl)
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>현장 접속 QR · YS-001</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf1f5;color:#172c2a;font-family:system-ui,-apple-system,"Malgun Gothic",sans-serif}.toolbar{padding:20px;text-align:center}.toolbar button{border:0;border-radius:10px;background:#167457;color:white;font-size:16px;padding:12px 22px;cursor:pointer}.marker{margin:12px auto 40px;padding:48px;background:#fff;width:min(92vw,710px);border:2px solid #167457;border-radius:20px;text-align:center}.brand{font-size:20px;font-weight:850;letter-spacing:3px;color:#167457}.tag{display:inline-block;margin:20px 0 4px;padding:8px 13px;border-radius:7px;background:#fff0df;color:#9d4d12;font-size:13px;font-weight:700}h1{font-size:32px;line-height:1.3;margin:20px 0 12px}.sub{color:#607083;line-height:1.7;font-size:17px}.qr{margin:20px auto;width:min(100%,365px)}.qr svg{width:100%;height:auto;display:block}.location{padding:17px;border-radius:10px;background:#f1f5f9;line-height:1.8}.id{font-size:14px;letter-spacing:2px}.url{display:block;overflow-wrap:anywhere;margin:19px 0;color:#607083;font-size:12px}.warning{padding:12px;border-radius:8px;background:#fff1ef;color:#9e3024;font-size:13px;line-height:1.6}.note{color:#788699;font-size:12px;line-height:1.7;margin-top:22px}@page{size:A4;margin:14mm}@media print{body{background:white}.toolbar{display:none}.marker{margin:0 auto;width:100%;max-width:175mm;border-radius:10px;padding:10mm;break-inside:avoid}.qr{width:88mm}.url{font-size:10px}}
</style></head><body><div class="toolbar"><button onclick="window.print()">QR 안내판 인쇄 / PDF 저장</button></div><main class="marker"><div class="tag">가스배관 매설 주의구역</div><h1>공사 조회 · 현장 신고</h1><p class="sub">카메라로 QR을 스캔하세요.<br>공사 등록 조회 · 사진 및 작업 내용 입력<br>작업자 로그인 → 배관 3D·AR 보기</p><div class="qr">${svg}</div><div class="location"><strong>여수산단 A-12 구역</strong><br><span class="id">QR ID · YS-001</span></div><a class="url" href="${safeUrl}">${safeUrl}</a>${warning ? `<p class="warning">${escapeHtml(warning)}</p>` : ''}<p class="note">가스안전공사 공모전 발표용 프로토타입<br>가상 데이터 기반 시연 · 실제 공사 조회 및 기관 신고 접수 기능 없음</p></main></body></html>`
  await writeFile(path.join(outputDir, `${values.location}.html`), html, 'utf8')
  await writeFile(
    path.join(outputDir, 'urls.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), markers: [{ locationId: values.location, locationName: '여수산단 A-12 구역', url: finalUrl, png: `${values.location}.png`, svg: `${values.location}.svg`, printable: `${values.location}.html`, warning: warning || null }] }, null, 2)}\n`,
    'utf8',
  )
  console.log(`QR generated: ${finalUrl}\nFiles: ${outputDir}`)
  if (warning) console.warn(`\n주의: ${warning}`)
}

main().catch((error) => {
  console.error(`QR generation failed: ${error.message}`)
  process.exitCode = 1
})
