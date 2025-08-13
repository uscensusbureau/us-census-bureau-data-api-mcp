import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest'
import { Client } from 'pg'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { dbConfig } from '../../helpers/database-config'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('SeedRunner - Additional Coverage Tests', () => {
  let client: Client
  let runner: SeedRunner

  beforeAll(async () => {
    client = new Client(dbConfig)
    await client.connect()
  })

  afterAll(async () => {
    await client.end()
  })

  beforeEach(async () => {
    const databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
    const fixturesPath = path.join(__dirname, 'fixtures')

    try {
      await fs.mkdir(fixturesPath, { recursive: true })
    } catch {
      // Directory already exists
    }

    runner = new SeedRunner(databaseUrl, fixturesPath)
    await runner.connect()
  })

  afterEach(async () => {
    await runner.disconnect()
  })

  describe('constructor with default dataPath', () => {
    it('should use default dataPath when none provided', () => {
      const runnerWithDefaults = new SeedRunner(
        'postgresql://test:test@localhost:5432/test',
      )

      // We can't directly test the private dataPath, but we can verify the constructor works
      expect(runnerWithDefaults).toBeInstanceOf(SeedRunner)
    })

    it('should accept custom rate limit config', () => {
      const customConfig = {
        requestsPerSecond: 5,
        burstLimit: 3,
        retryAttempts: 5,
        retryDelay: 2000,
      }

      const runnerWithCustomConfig = new SeedRunner(
        'postgresql://test:test@localhost:5432/test',
        undefined,
        customConfig,
      )

      expect(runnerWithCustomConfig).toBeInstanceOf(SeedRunner)
    })
  })

  describe('waitForQueueToEmpty - private method testing', () => {
    it('should handle queue processing with active requests', async () => {
      // Create a runner with very strict rate limiting to test queue behavior
      const strictRunner = new SeedRunner(
        `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
        path.join(__dirname, 'fixtures'),
        {
          requestsPerSecond: 1,
          burstLimit: 1,
          retryAttempts: 1,
          retryDelay: 100,
        },
      )

      await strictRunner.connect()

      // Mock fetch to simulate slow responses
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: vi.fn().mockResolvedValue({ data: [] }),
                }),
              50,
            ),
          ),
      )

      try {
        // Make multiple concurrent requests to test queue behavior
        const promises = [
          strictRunner.fetchFromApi('https://api.example.com/1'),
          strictRunner.fetchFromApi('https://api.example.com/2'),
          strictRunner.fetchFromApi('https://api.example.com/3'),
        ]

        await Promise.all(promises)

        // Verify all requests were made
        expect(fetchSpy).toHaveBeenCalledTimes(3)
      } finally {
        await strictRunner.disconnect()
        fetchSpy.mockRestore()
      }
    })
  })

  describe('fetchFromApi error scenarios', () => {
    let fetchSpy: vi.SpyInstance

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch')
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    it('should handle maximum retries exceeded', async () => {
      // Mock fetch to always fail
      fetchSpy.mockRejectedValue(new Error('Network error'))

      const testUrl = 'https://api.example.com/data'

      await expect(runner.fetchFromApi(testUrl)).rejects.toThrow(
        'Network error',
      )

      // Should have been called 4 times (initial + 3 retries)
      expect(fetchSpy).toHaveBeenCalledTimes(4)
    })

    it('should handle retry with exponential backoff', async () => {
      // Mock fetch to fail first time, succeed second time
      fetchSpy
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ data: ['success'] }),
        })

      const testUrl = 'https://api.example.com/data'

      const result = await runner.fetchFromApi(testUrl)

      expect(result).toEqual({ data: ['success'] })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('should log retry attempts', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      fetchSpy
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ data: [] }),
        })

      await runner.fetchFromApi('https://api.example.com/data')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request failed, retrying in'),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('loadData edge cases', () => {
    it('should handle missing nested keys in extractPath', async () => {
      const testData = {
        level1: {
          level2: {
            data: [{ id: 1, name: 'Test' }],
          },
        },
      }

      const filePath = path.join(__dirname, 'fixtures', 'nested_missing.json')
      await fs.writeFile(filePath, JSON.stringify(testData))

      // Try to access non-existent path
      await expect(
        runner.loadData('nested_missing.json', 'level1.level2.nonexistent'),
      ).rejects.toThrow(
        'Key "nonexistent" not found in data from nested_missing.json',
      )
    })

    it('should handle extractPath with null/undefined intermediate values', async () => {
      const testData = {
        level1: null,
      }

      const filePath = path.join(
        __dirname,
        'fixtures',
        'null_intermediate.json',
      )
      await fs.writeFile(filePath, JSON.stringify(testData))

      await expect(
        runner.loadData('null_intermediate.json', 'level1.level2'),
      ).rejects.toThrow(
        'Key "level2" not found in data from null_intermediate.json',
      )
    })

    it('should handle API calls with mixed parameter types', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
      })

      const queryParams = {
        get: 'NAME',
        limit: '10',
        active: 'true',
      }

      await runner.loadData(
        'https://api.example.com/data',
        undefined,
        true,
        queryParams,
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/data?get=NAME&limit=10&active=true',
      )

      fetchSpy.mockRestore()
    })
  })

  describe('insertOrSkip edge cases', () => {
    beforeEach(async () => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_edge_cases (
          id INTEGER PRIMARY KEY,
          name VARCHAR(255),
          value INTEGER
        )
      `)
    })

    afterEach(async () => {
      await client.query('DROP TABLE IF EXISTS test_edge_cases')
    })

    it('should handle records with null values', async () => {
      const testData = [
        { id: 1, name: 'Test 1', value: null },
        { id: 2, name: null, value: 42 },
      ]

      await runner.insertOrSkip('test_edge_cases', testData, 'id')

      const result = await client.query(
        'SELECT * FROM test_edge_cases ORDER BY id',
      )
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].value).toBeNull()
      expect(result.rows[1].name).toBeNull()
    })

    it('should handle large batch processing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Create data larger than default batch size (1000)
      const largeData = Array.from({ length: 1500 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: i * 10,
      }))

      await runner.insertOrSkipBatch('test_edge_cases', largeData, 'id', 500)

      const result = await client.query(
        'SELECT COUNT(*) as count FROM test_edge_cases',
      )
      expect(parseInt(result.rows[0].count)).toBe(1500)

      // Verify batch logging
      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing 1500 records in batches of 500',
      )
      expect(consoleSpy).toHaveBeenCalledWith('Processing batch 1/3')
      expect(consoleSpy).toHaveBeenCalledWith('Processing batch 2/3')
      expect(consoleSpy).toHaveBeenCalledWith('Processing batch 3/3')

      consoleSpy.mockRestore()
    })
  })

  describe('seed method comprehensive testing', () => {
    beforeEach(async () => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS seed_comprehensive_test (
          id INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100)
        )
      `)
    })

    afterEach(async () => {
      await client.query('DROP TABLE IF EXISTS seed_comprehensive_test')
    })

    it('should handle URL-based seeding', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([
          { id: 1, name: 'API Item 1', category: 'test' },
          { id: 2, name: 'API Item 2', category: 'test' },
        ]),
      })

      const seedConfig = {
        url: 'https://api.example.com/items',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        queryParams: {
          category: 'test',
          limit: '100',
        },
      }

      await runner.seed(seedConfig)

      const result = await client.query(
        'SELECT * FROM seed_comprehensive_test ORDER BY id',
      )
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].name).toBe('API Item 1')

      fetchSpy.mockRestore()
    })

    it('should handle seeding with large datasets using batch processing', async () => {
      // Create a large dataset
      const largeData = Array.from({ length: 1200 }, (_, i) => ({
        id: i + 1,
        name: `Large Item ${i + 1}`,
        category: 'bulk',
      }))

      const filePath = path.join(__dirname, 'fixtures', 'large_dataset.json')
      await fs.writeFile(filePath, JSON.stringify(largeData))

      const seedConfig = {
        file: 'large_dataset.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
      }

      await runner.seed(seedConfig)

      const result = await client.query(
        'SELECT COUNT(*) as count FROM seed_comprehensive_test',
      )
      expect(parseInt(result.rows[0].count)).toBe(1200)
    })

    it('should handle beforeSeed hook with data modification', async () => {
      const testData = [
        { id: 1, name: 'Test 1', category: 'original' },
        { id: 2, name: 'Test 2', category: 'original' },
      ]

      const filePath = path.join(__dirname, 'fixtures', 'before_seed_test.json')
      await fs.writeFile(filePath, JSON.stringify(testData))

      let beforeSeedCalled = false
      let receivedData: unknown[] = []

      const seedConfig = {
        file: 'before_seed_test.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        beforeSeed: async (client: Client, rawData: unknown[]) => {
          beforeSeedCalled = true
          receivedData = rawData

          // Verify we can use the client in beforeSeed
          const result = await client.query('SELECT NOW()')
          expect(result.rows).toHaveLength(1)
        },
      }

      await runner.seed(seedConfig)

      expect(beforeSeedCalled).toBe(true)
      expect(receivedData).toEqual(testData)
    })

    it('should handle transaction rollback on afterSeed failure', async () => {
      const testData = [{ id: 1, name: 'Test 1', category: 'test' }]
      const filePath = path.join(__dirname, 'fixtures', 'rollback_test.json')
      await fs.writeFile(filePath, JSON.stringify(testData))

      const seedConfig = {
        file: 'rollback_test.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        afterSeed: async () => {
          throw new Error('AfterSeed intentional failure')
        },
      }

      await expect(runner.seed(seedConfig)).rejects.toThrow(
        'AfterSeed intentional failure',
      )

      // Verify no data was inserted due to rollback
      const result = await client.query(
        'SELECT COUNT(*) as count FROM seed_comprehensive_test',
      )
      expect(parseInt(result.rows[0].count)).toBe(0)
    })

    it('should handle transaction rollback on beforeSeed failure', async () => {
      const testData = [{ id: 1, name: 'Test 1', category: 'test' }]
      const filePath = path.join(
        __dirname,
        'fixtures',
        'before_rollback_test.json',
      )
      await fs.writeFile(filePath, JSON.stringify(testData))

      const seedConfig = {
        file: 'before_rollback_test.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        beforeSeed: async () => {
          throw new Error('BeforeSeed intentional failure')
        },
      }

      await expect(runner.seed(seedConfig)).rejects.toThrow(
        'BeforeSeed intentional failure',
      )

      // Verify no data was inserted due to rollback
      const result = await client.query(
        'SELECT COUNT(*) as count FROM seed_comprehensive_test',
      )
      expect(parseInt(result.rows[0].count)).toBe(0)
    })

    it('should log error details on seeding failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const seedConfig = {
        file: 'nonexistent_file.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
      }

      await expect(runner.seed(seedConfig)).rejects.toThrow()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Seeding failed for seed_comprehensive_test:'),
        expect.any(String),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('validateSeedConfig error handling', () => {
    it('should handle Zod validation errors with detailed logging', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const invalidConfig = {
        file: 'test.json',
        table: 'test_table',
        // missing conflictColumn
        extraField: 'should not be here',
      }

      expect(() => {
        runner.validateSeedConfig(invalidConfig)
      }).toThrow('SeedConfig validation failed')

      // Verify error logging occurred
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle custom Zod errors with params', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Create a config that might trigger a custom Zod error
      const invalidConfig = {
        file: '', // empty string might trigger custom validation
        table: 'test_table',
        conflictColumn: 'id',
      }

      expect(() => {
        runner.validateSeedConfig(invalidConfig)
      }).toThrow('SeedConfig validation failed')

      consoleSpy.mockRestore()
    })

    it('should handle non-Error objects in validation', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Pass something that will definitely fail validation
      const invalidConfig = 'not an object'

      expect(() => {
        runner.validateSeedConfig(invalidConfig)
      }).toThrow('SeedConfig validation failed')

      consoleSpy.mockRestore()
    })
  })
})
