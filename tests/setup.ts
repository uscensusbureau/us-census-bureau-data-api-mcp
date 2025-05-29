// Global test setup
import { vi } from 'vitest';

//Load the ENV
process.env.CENSUS_API_KEY="test-api-key-12345"

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
};

// Setup fetch mock globally
global.fetch = vi.fn();
 