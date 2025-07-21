// Global test setup
import {beforeAll, vi } from 'vitest';

beforeAll(() => {
  // Override DATABASE_URL for Testing Environment
  process.env.DATABASE_URL = 'postgresql://mcp_user_test:mcp_pass_test@localhost:5434/mcp_db_test';
});

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  //log: vi.fn(), //Remove this for robust logging
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
};

// Setup fetch mock globally
global.fetch = vi.fn();