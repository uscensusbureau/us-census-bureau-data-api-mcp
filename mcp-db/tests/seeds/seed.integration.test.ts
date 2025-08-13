import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest'
import { Client } from 'pg'
import { dbConfig } from '../helpers/database-config'
import { SeedRunner } from '../../src/seeds/scripts/seed-runner'
import {
  CloseAction,
  HttpAction,
  setupMockServer,
} from '../helpers/mock-server'

interface MockServer {
  port: number
  get: HttpAction
  post: HttpAction
  close(): CloseAction
}

interface QueryParams {
  format: string
  limit: string
}

describe('Seed Database - API Integration Tests', () => {
  let runner: SeedRunner
  let client: Client
  let mockServer: MockServer
  const databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`

  beforeAll(async () => {
    // Set up mock HTTP server for API responses
    mockServer = setupMockServer()
    client = new Client(dbConfig)

    await client.connect()
  })

  afterAll(async () => {
    await mockServer.close()
    await client.end()
  })

  beforeEach(async () => {
    runner = new SeedRunner(databaseUrl)
    await runner.connect()

    // Clean up test table
    await client.query('DROP TABLE IF EXISTS api_test_data')
    await client.query(`
      CREATE TABLE api_test_data (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        value INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
  })

  afterEach(async () => {
    await runner.disconnect()
  })

  it('should seed data from API endpoint', async () => {
    // Mock API response
    mockServer.get('/test-data', (req, res) => {
      res.json({
        data: [
          { id: 1, name: 'API Record 1', value: 100 },
          { id: 2, name: 'API Record 2', value: 200 },
          { id: 3, name: 'API Record 3', value: 300 },
        ],
      })
    })

    const seedConfig = {
      url: `http://localhost:${mockServer.port}/test-data`,
      table: 'api_test_data',
      conflictColumn: 'id',
      dataPath: 'data',
      queryParams: {
        format: 'json',
        limit: '100',
      },
      beforeSeed: async (client: Client) => {
        // Create indexes for performance
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_api_test_data_id 
          ON api_test_data(id);
        `)
      },
      afterSeed: async (client: Client) => {
        // Verify data integrity
        const result = await client.query('SELECT COUNT(*) FROM api_test_data')
        console.log(`Seeded ${result.rows[0].count} records from API`)
      },
    }

    // This tests the entire API workflow through seed-database
    await runner.seed(seedConfig)

    // Verify the data was correctly inserted
    const result = await client.query('SELECT * FROM api_test_data ORDER BY id')
    expect(result.rows).toHaveLength(3)

    expect(result.rows[0]).toMatchObject({
      id: 1,
      name: 'API Record 1',
      value: 100,
    })

    expect(result.rows[1]).toMatchObject({
      id: 2,
      name: 'API Record 2',
      value: 200,
    })

    expect(result.rows[2]).toMatchObject({
      id: 3,
      name: 'API Record 3',
      value: 300,
    })
  })

  it('should handle API errors gracefully', async () => {
    // Mock API error response
    mockServer.get('/error-endpoint', (req, res) => {
      res.status(500).json({ error: 'Internal Server Error' })
    })

    const seedConfig = {
      url: `http://localhost:${mockServer.port}/error-endpoint`,
      table: 'api_test_data',
      conflictColumn: 'id',
    }

    await expect(runner.seed(seedConfig)).rejects.toThrow(
      'API request failed: 500 Internal Server Error',
    )

    // Verify no data was inserted due to rollback
    const result = await client.query('SELECT COUNT(*) FROM api_test_data')
    expect(result.rows[0].count).toBe('0')
  })

  it('should handle query parameters correctly', async () => {
    // Verify query params are sent to API
    let receivedParams: QueryParams = {}

    mockServer.get('/test-with-params', (req, res) => {
      receivedParams = req.query
      res.json({ data: [{ id: 1, name: 'Test', value: 42 }] })
    })

    const seedConfig = {
      url: `http://localhost:${mockServer.port}/test-with-params`,
      table: 'api_test_data',
      conflictColumn: 'id',
      dataPath: 'data',
      queryParams: {
        api_key: 'test123',
        format: 'json',
        year: '2024',
      },
    }

    await runner.seed(seedConfig)

    // Verify query params were sent correctly
    expect(receivedParams).toMatchObject({
      api_key: 'test123',
      format: 'json',
      year: '2024',
    })

    // Verify data was inserted
    const result = await client.query('SELECT * FROM api_test_data')
    expect(result.rows).toHaveLength(1)
  })
})
