import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const requestedBase = env.BASE_PATH || '/'
  if (!requestedBase.startsWith('/') || requestedBase.startsWith('//') || /[?#\\]/.test(requestedBase)) {
    throw new Error('BASE_PATH must be an absolute path such as / or /gas-on/.')
  }
  const base = `${requestedBase.replace(/\/+$/, '')}/`

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'script',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: base,
          name: '현장 공사 조회',
          short_name: '현장 조회',
          description: '굴착공사 현장 확인과 지하 배관 AR / 3D 조회.',
          lang: 'ko-KR',
          start_url: `${base}?location=YS-001`,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#f5f7fa',
          theme_color: '#2D53BE',
          categories: ['utilities', 'productivity'],
          icons: [
            { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: `${base}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/^\/api\//, /\/qr\//],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      watch: { ignored: ['**/artifacts/**', '**/playwright-report/**', '**/test-results/**'] },
    },
    preview: { host: '0.0.0.0', port: 4173, strictPort: true },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1800,
    },
  }
})
