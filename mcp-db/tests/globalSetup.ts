import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export async function setup(): Promise<void> {
  process.env.POSTGRES_HOST = 'localhost';
  process.env.POSTGRES_PORT = '5434';  // Test database port
  process.env.POSTGRES_DB = 'mcp_db_test';
  process.env.POSTGRES_USER = 'mcp_user_test';
  process.env.POSTGRES_PASSWORD = 'mcp_pass_test';
  
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  if (!isCI) {
    console.log('Starting test database and running migrations...');
    
    // Start test database and run migrations
    const startDb: ChildProcess = spawn('docker', ['compose', '--profile', 'test', 'up', '-d', '--build'], {
      stdio: 'pipe'
    });
    
    startDb.stdout?.on('data', (data) => {
      console.log(`Docker stdout: ${data}`);
    });
    
    startDb.stderr?.on('data', (data) => {
      console.error(`Docker stderr: ${data}`);
    });
    
    await new Promise<void>((resolve, reject) => {
      startDb.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker compose failed with code ${code}`));
        }
      });
    });
    
    console.log('Waiting for test database to be ready...');
    await sleep(10000);
  } else {
    console.log('Running in CI environment, using existing database service...');
  }
  
  // Test connectivity
  console.log('Testing database connectivity...');
  const { Client } = await import('pg');
  
  const connectionConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5434'),
    database: process.env.POSTGRES_DB || 'mcp_db_test',
    user: process.env.POSTGRES_USER || 'mcp_user_test',
    password: process.env.POSTGRES_PASSWORD || 'mcp_pass_test',
  };

  let retries = 15;
  while (retries > 0) {
    const client = new Client(connectionConfig);
    
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('Test database is ready!');
      break;
    } catch (error) {
      try {
        await client.end();
      } catch {
        //Ignore failed connection
      }
      
      retries--;
      console.log(`Connection attempt failed, retries left: ${retries}`);
      if (retries === 0) {
        console.error('Database connection failed after all retries:', error);
        throw error;
      }
      await sleep(2000);
    }
  }
  
  console.log('=== GLOBAL SETUP COMPLETE ===');
}

export async function teardown(): Promise<void> {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  if (!isCI) {
    console.log('Cleaning up test database...');
    
    const stopDb: ChildProcess = spawn('docker', ['compose', '--profile', 'test', 'down', '--volumes', '--remove-orphans'], {
      stdio: 'inherit'
    });
    
    await new Promise<void>((resolve) => {
      stopDb.on('close', () => resolve());
    });
  } else {
    console.log('Running in CI environment, database cleanup handled automatically...');
  }
}