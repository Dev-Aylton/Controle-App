import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/company-e2e',
  use: {
    baseURL: 'http://127.0.0.1:4174/Controle-App/',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev -- --mode test --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/Controle-App/',
    reuseExistingServer: false,
    env: {
      VITE_DEMO_MODE: 'false',
      VITE_SUPABASE_TEST_URL: 'https://example.supabase.co',
      VITE_SUPABASE_TEST_ANON_KEY: 'test-key',
    },
  },
})
