import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export async function setup(): Promise<void> {
  // Check if running in GitHub Actions (or other CI where database is already provided)
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  if (!isCI) {
    console.log('Starting test database...');
    
    // Start test database
    const startDb: ChildProcess = spawn('docker', ['compose', '--profile', 'test', 'up', '-d', 'census-mcp-db-test'], {
      stdio: 'inherit'
    });
    
    await new Promise<void>((resolve, reject) => {
      startDb.on('close', (code: number | null) => {
        if (code === 0) resolve();
        else reject(new Error(`Docker compose failed with code ${code}`));
      });
    });
    
    console.log('Waiting for test database to be ready...');
    await sleep(10000);
  } else {
    console.log('Running in CI environment, using existing database service...');
  }
  
  // Test connectivity to ensure database is actually ready
  console.log('Testing database connectivity...');
  const { Client } = await import('pg');
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    database: process.env.POSTGRES_DB || 'mcp_db_test',
    user: process.env.POSTGRES_USER || 'mcp_user_test',
    password: process.env.POSTGRES_PASSWORD || 'mcp_pass_test',
  });
  
  let retries = 15;
  while (retries > 0) {
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('Test database is ready!');
      break;
    } catch (error) {
      retries--;
      console.log(`Connection attempt failed, retries left: ${retries}`);
      if (retries === 0) {
        console.error('Database connection failed after all retries:', error);
        throw error;
      }
      await sleep(2000);
    }
  }

  // Run migrations on the test database in Docker
  if (!isCI) {
    console.log('Running migrations on test database...');
    
    const runMigrations: ChildProcess = spawn('docker', ['compose', '--profile', 'test', 'up', 'census-mcp-db-test-init'], {
      stdio: 'inherit'
    });
    
    await new Promise<void>((resolve, reject) => {
      runMigrations.on('close', (code: number | null) => {
        if (code === 0) {
          console.log('Test database migrations completed!');
          resolve();
        } else {
          reject(new Error(`Migration failed with code ${code}`));
        }
      });
    });
  }
}

export async function teardown(): Promise<void> {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  if (!isCI) {
    console.log('Cleaning up test database...');
    
    // Stop the test containers
    const stopDb: ChildProcess = spawn('docker', ['compose', 'stop', 'census-mcp-db-test', 'census-mcp-db-test-init'], {
      stdio: 'inherit'
    });
    
    await new Promise<void>((resolve) => {
      stopDb.on('close', () => resolve());
    });
    
    // Remove the stopped containers
    const removeDb: ChildProcess = spawn('docker', ['compose', 'rm', '-f', 'census-mcp-db-test', 'census-mcp-db-test-init'], {
      stdio: 'inherit'
    });
    
    await new Promise<void>((resolve) => {
      removeDb.on('close', () => resolve());
    });
  } else {
    console.log('Running in CI environment, database cleanup handled automatically...');
  }
}