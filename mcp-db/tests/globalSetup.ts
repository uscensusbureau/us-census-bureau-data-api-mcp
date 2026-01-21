import { spawn, ChildProcess } from 'child_process'
import { rm } from 'node:fs/promises'
import { promisify } from 'util'

import { dbConfig } from './test-helpers/database-config'

const sleep = promisify(setTimeout)

export async function setup(): Promise<void> {
  const isCI =
    process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

  if (!isCI) {
    console.log('Starting test database and running migrations...')

    // Start test database and run migrations
    const startDb: ChildProcess = spawn(
      'docker',
      ['compose', '--profile', 'test', 'up', '-d', '--build'],
      {
        stdio: 'pipe',
      },
    )

    startDb.stdout?.on('data', (data) => {
      console.log(`Docker stdout: ${data}`)
    })

    startDb.stderr?.on('data', (data) => {
      console.error(`Docker stderr: ${data}`)
    })

    await new Promise<void>((resolve, reject) => {
      startDb.on('close', (code: number | null) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Docker compose failed with code ${code}`))
        }
      })
    })

    console.log('Waiting for test database to be ready...')
    await sleep(10000)
  } else {
    console.log('Running in CI environment, using existing database service...')
  }

  // Test connectivity
  console.log('Testing database connectivity...')
  const { Client } = await import('pg')

  let retries = 15
  while (retries > 0) {
    const client = new Client(dbConfig)

    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      console.log('Test database is ready!')
      break
    } catch (error) {
      try {
        await client.end()
      } catch {
        //Ignore failed connection
      }

      retries--
      console.log(`Connection attempt failed, retries left: ${retries}`)
      if (retries === 0) {
        console.error('Database connection failed after all retries:', error)
        throw error
      }
      await sleep(2000)
    }
  }

  console.log('=== GLOBAL SETUP COMPLETE ===')
}

export async function teardown(): Promise<void> {
  const isCI =
    process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

  if (!isCI) {
    console.log('Cleaning up test database data...')

    // Clean up database before stopping containers
    try {
      const { Client } = await import('pg')

      const client = new Client(dbConfig)

      await client.connect()
      console.log('Connected to test database for cleanup...')

      // Clean up test data in summary_levels
      await client.query('TRUNCATE summary_levels RESTART IDENTITY CASCADE')
      console.log('✓ Cleaned summary_levels table')

      await client.end()
      console.log('✓ Database cleanup completed')
    } catch (error) {
      console.warn(
        'Database cleanup failed (container may already be down):',
        error.message,
      )
      // Don't fail teardown if database cleanup fails
    }

    console.log('Stopping test database containers...')

    const stopDb: ChildProcess = spawn(
      'docker',
      ['compose', '--profile', 'test', 'down', '--volumes', '--remove-orphans'],
      {
        stdio: 'inherit',
      },
    )

    await new Promise<void>((resolve) => {
      stopDb.on('close', () => resolve())
    })
  } else {
    console.log(
      'Running in CI environment, database cleanup handled automatically...',
    )
  }

  await deleteDirectory('tests/seeds/scripts/fixtures')
  await deleteDirectory('tests/seeds/configs/fixtures')
}

async function deleteDirectory(directoryPath: string): Promise<void> {
  try {
    await rm(directoryPath, { recursive: true, force: true })
    console.log(`Directory and its contents removed: ${directoryPath}`)
  } catch (error) {
    console.error(`Error removing directory: ${error}`)
  }
}
