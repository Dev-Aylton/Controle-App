import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173/Controle-App/',
    headless: true,
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev -- --mode test --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/Controle-App/',
    reuseExistingServer: false,
    env: {
      VITE_DEMO_MODE: 'true',
    },
  },
})
