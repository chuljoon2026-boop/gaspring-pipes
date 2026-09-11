import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Folds artifacts/dist-artifact (see artifact.vite.config.ts) into artifacts/yeosu-pipes.html:
// CSS, the Pretendard font (data URI) and the JS bundle are inlined. The output has no
// <html>/<head>/<body> wrapper because the artifact host adds its own.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'artifacts', 'dist-artifact')
const out = path.join(root, 'artifacts', 'yeosu-pipes.html')
const assets = readdirSync(path.join(dir, 'assets'))
const pick = (ext) => path.join(dir, 'assets', assets.find((f) => f.endsWith(ext)))
const js = readFileSync(pick('.js'), 'utf8')
const font = readFileSync(pick('.woff2')).toString('base64')
const css = readFileSync(pick('.css'), 'utf8').replace(/url\(\.\/PretendardVariable[^)]*\)/g, `url(data:font/woff2;base64,${font})`)
if (js.includes('</script')) throw new Error('bundle contains </script')
const html = `<title>여수산단 배관 조회</title>
<meta name="description" content="여수산단 도로 하부 15개 관로의 전체 3D·평면·도로 단면·교차부 조회와 현장 신고.">
<meta name="theme-color" content="#167457">
<style>
html, body { min-height: 100%; }
body { background: #f5f7fa; color: #1c2a26; font-family: 'Pretendard Variable', Pretendard, -apple-system, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif; }
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`
writeFileSync(out, html)
console.log(`written ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`)
