// Custom migration configuration for Heroku
const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
  // Parse the DATABASE_URL and add SSL configuration
  const url = new URL(DATABASE_URL);

  module.exports = {
    databaseUrl: DATABASE_URL + '?sslmode=require',
    migrationsTable: 'pgmigrations',
    dir: 'migrations',
    direction: 'up',
    verbose: true,
  };
} else {
  // Local development configuration
  module.exports = {
    databaseUrl: 'postgresql://mcp_user:mcp_pass@localhost:5432/mcp_db',
    migrationsTable: 'pgmigrations',
    dir: 'migrations',
    direction: 'up',
    verbose: true,
  };
}