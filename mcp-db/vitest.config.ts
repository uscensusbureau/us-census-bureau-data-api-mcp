import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000, // Database tests might be slower
    hookTimeout: 10000,
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    coverage: {
      reporter: ['text', 'json-summary', 'json'],
      tresholds: {
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85
      }
    }
  }
});