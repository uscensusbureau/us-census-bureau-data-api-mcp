// Global test setup
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  // Only set mock API key if no real one exists
  if (!process.env.CENSUS_API_KEY) {
    process.env.CENSUS_API_KEY = 'test-api-key-12345';
  }
});

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(), //Remove this for robust logging
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
};

// Setup fetch mock globally
global.fetch = vi.fn();
 