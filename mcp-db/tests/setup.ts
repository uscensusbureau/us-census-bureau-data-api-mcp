export function setup(): void {
  // Set test environment variables
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
  
  if (isTestEnv) {
    // Use test database
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5433';  // Different port
    process.env.POSTGRES_DB = 'mcp_db_test';
    process.env.POSTGRES_USER = 'mcp_user_test';
    process.env.POSTGRES_PASSWORD = 'mcp_pass_test';
  } else {
    // Use development database
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DB = 'mcp_db';
    process.env.POSTGRES_USER = 'mcp_user';
    process.env.POSTGRES_PASSWORD = 'mcp_pass';
  }
}