import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export async function setup(): Promise<void> {
  // Check if running in GitHub Actions (or other CI where database is already provided)
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  if (!isCI) {
    // Only start Docker container for local testing, not testing in GitHub Actions
    console.log('Starting test database...');
    
    // Start test database
    const startDb: ChildProcess = spawn('docker-compose', ['--profile', 'test', 'up', '-d', 'census-mcp-db-test'], {
      stdio: 'inherit'
    });
    
    await new Promise<void>((resolve, reject) => {
      startDb.on('close', (code: number | null) => {
        if (code === 0) resolve();
        else reject(new Error(`Docker compose failed with code ${code}`));
      });
    });
    
    console.log('Waiting for test database to be ready...');
    await sleep(10000); // Give it more time
  } else {
    console.log('Running in CI environment, using existing database service...');
  }
  
  // Test connectivity to ensure database is actually ready (works for both local and CI)
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
}

export async function teardown(): Promise<void> {
  // Check if running in GitHub Actions (or other CI where database cleanup is handled automatically)
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  if (!isCI) {
    // Only clean up Docker container locally, not in CI
    console.log('Cleaning up test database...');
    
    // Only stop the test container, not all containers
    const stopDb: ChildProcess = spawn('docker-compose', ['stop', 'census-mcp-db-test'], {
      stdio: 'inherit'
    });
    
    await new Promise<void>((resolve) => {
      stopDb.on('close', () => resolve());
    });
    
    // Optional: Remove the stopped container to free up resources
    const removeDb: ChildProcess = spawn('docker-compose', ['rm', '-f', 'census-mcp-db-test'], {
      stdio: 'inherit'
    });
    
    await new Promise<void>((resolve) => {
      removeDb.on('close', () => resolve());
    });
  } else {
    console.log('Running in CI environment, database cleanup handled automatically...');
  }
}