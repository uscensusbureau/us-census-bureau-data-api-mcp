import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    testTimeout: 30000, // Database tests might be slower
    hookTimeout: 10000,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/globalSetup.ts']
  }
});