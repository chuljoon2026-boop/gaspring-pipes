import { defineConfig, mergeConfig } from 'vite'
import base from '../vite.config'

// Single-chunk build for hosting the app as one HTML file (claude.ai artifact).
// npx vite build --config scripts/artifact.vite.config.ts && node scripts/inline-artifact.mjs
export default defineConfig(async (env) => {
  const resolved = typeof base === 'function' ? await base(env) : base
  // No service worker or manifest in a single-file page.
  resolved.plugins = (resolved.plugins as unknown[]).flat().filter((p) => !String((p as { name?: string })?.name ?? '').includes('pwa'))
  return mergeConfig(resolved, {
    base: './',
    build: {
      outDir: 'artifacts/dist-artifact',
      emptyOutDir: true,
      assetsInlineLimit: 0,
      cssCodeSplit: false,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  })
})
