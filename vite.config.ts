import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.APP_PORT) || 8114
  const host = env.APP_HOST || '0.0.0.0'
  const base = env.APP_BASE || '/'

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Hydroponic Reservoir',
          short_name: 'Reservoir',
          description: 'Deterministic offline hydroponic reservoir monitoring',
          display: 'standalone',
          start_url: base,
          scope: base,
          background_color: '#ffffff',
          theme_color: '#006d77',
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: `${base}maskable-icon-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    server: {
      host,
      port,
      strictPort: true,
    },
    preview: {
      host,
      port,
      strictPort: true,
    },
  }
})
