interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
}

export const dbConfig: DatabaseConfig = {
  host: 'localhost',
  port: 5434,
  database: 'mcp_db_test',
  user: 'mcp_user_test',
  password: 'mcp_pass_test',
}
