interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export const dbConfig: DatabaseConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  database: process.env.POSTGRES_DB || 'mcp_db_test',
  user: process.env.POSTGRES_USER || 'mcp_user_test',
  password: process.env.POSTGRES_PASSWORD || 'mcp_pass_test',
};