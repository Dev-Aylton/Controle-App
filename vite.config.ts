import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
let commitHash = 'nogit'
try {
  commitHash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
} catch {
  // Build ainda funciona fora de um checkout Git.
}

export default defineConfig({
  base: '/Controle-App/',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_BUILD__: JSON.stringify(`${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${commitHash}`),
  },
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      closeBundle() {
        mkdirSync(new URL('./dist', import.meta.url), { recursive: true })
        writeFileSync(new URL('./dist/version.json', import.meta.url), JSON.stringify({
          version: packageJson.version,
          build: `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${commitHash}`,
        }), 'utf8')
      },
    },
    VitePWA({
      devOptions: {
        enabled: false,
      },
      registerType: 'prompt',
      manifest: {
        name: 'Controle-App',
        short_name: 'Controle-App',
        start_url: '/Controle-App/',
        scope: '/Controle-App/',
        display: 'standalone',
        theme_color: '#1F7A65',
        background_color: '#F7FAF8',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
})
