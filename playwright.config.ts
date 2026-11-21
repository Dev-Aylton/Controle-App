import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173/Controle-App/',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev -- --mode test --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/Controle-App/',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_TEST_URL: 'https://example.supabase.co',
      VITE_SUPABASE_TEST_ANON_KEY: 'public-test-key',
    },
  },
})
