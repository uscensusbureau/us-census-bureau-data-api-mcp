import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: loadEnv('', process.cwd(), ''), // Load .env files
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    coverage: {
      reporter: ['text', 'json-summary', 'json'],
      thresholds: {
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
      },
    },
  },
})
