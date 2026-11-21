import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Controle-App/',
  plugins: [
    react(),
    VitePWA({
      devOptions: {
        enabled: false,
      },
      registerType: 'autoUpdate',
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
