import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/rls/**/*.test.ts'],
    exclude: [],
    hookTimeout: 120000,
    testTimeout: 60000,
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
  },
})
