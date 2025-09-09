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
import { GeographyContext } from '../../../src/schema/seed-config.schema.js'

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
  })

  describe('getAvailableYears', () => {
    beforeEach(async () => {
      // Clean up first, then insert test data
      await client.query('DELETE FROM years WHERE year IN (2020, 2021, 2023)')

      await client.query(`
        INSERT INTO years (year) VALUES 
        (2020),
        (2021),
        (2023)
      `)
    })

    afterEach(async () => {
      // Clean up test data
      await client.query('DELETE FROM years WHERE year IN (2020, 2021, 2023)')
    })

    it('should return available years ordered by year', async () => {
      const result = await runner.getAvailableYears()

      expect(result).toHaveLength(3)

      // Don't assert specific IDs since they're auto-generated
      expect(result.map((r) => r.year)).toEqual([2020, 2021, 2023])

      // Verify structure and ordering
      expect(result[0].year).toBe(2020)
      expect(result[1].year).toBe(2021)
      expect(result[2].year).toBe(2023)

      // Verify all have valid IDs
      result.forEach((yearRow) => {
        expect(typeof yearRow.id).toBe('number')
        expect(yearRow.id).toBeGreaterThan(0)
      })
    })

    it('should return empty array when no years exist', async () => {
      // Clear all years
      await client.query('DELETE FROM years')

      const result = await runner.getAvailableYears()

      expect(result).toHaveLength(0)
      expect(result).toEqual([])
    })

    it('should properly parse string values to numbers', async () => {
      const result = await runner.getAvailableYears()

      result.forEach((yearRow) => {
        expect(typeof yearRow.id).toBe('number')
        expect(typeof yearRow.year).toBe('number')
        expect(Number.isInteger(yearRow.id)).toBe(true)
        expect(Number.isInteger(yearRow.year)).toBe(true)
      })
    })
  })

  describe('getStateCodesForYear', () => {
    it('returns an array of state codes from the context', () => {
      const context: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {
          2023: {
            states: [
              {
                name: 'California',
                state_code: '06',
                ucgid_code: '0400000US06',
                geo_id: '0400000US06',
                summary_level_code: '040',
                for_param: 'state:06',
                in_param: null,
                year: 2023,
                intptlat: 36.7783,
                intptlon: -119.4179,
              },
              {
                name: 'Texas',
                state_code: '48',
                ucgid_code: '0400000US48',
                geo_id: '0400000US48',
                summary_level_code: '040',
                for_param: 'state:48',
                in_param: null,
                year: 2023,
                intptlat: 31.9686,
                intptlon: -99.9018,
              },
              {
                name: 'New York',
                state_code: '36',
                ucgid_code: '0400000US36',
                geo_id: '0400000US36',
                summary_level_code: '040',
                for_param: 'state:36',
                in_param: null,
                year: 2023,
                intptlat: 42.9538,
                intptlon: -75.5268,
              },
              {
                name: 'Alaska',
                state_code: '2', // Test single digit padding
                ucgid_code: '0400000US02',
                geo_id: '0400000US02',
                summary_level_code: '040',
                for_param: 'state:02',
                in_param: null,
                year: 2023,
                intptlat: 64.0685,
                intptlon: -152.2782,
              },
            ],
          },
        },
      }

      const result = runner.getStateCodesForYear(context, 2023)

      expect(result).toEqual(['02', '06', '36', '48']) // Should be sorted and zero-padded
      expect(result).toHaveLength(4)

      // Verify all codes are 2-digit strings
      result.forEach((code) => {
        expect(typeof code).toBe('string')
        expect(code).toHaveLength(2)
        expect(code).toMatch(/^\d{2}$/)
      })
    })

    it('throws an error when no states are found', () => {
      // Test with empty context
      const emptyContext: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {},
      }

      expect(() => runner.getStateCodesForYear(emptyContext, 2023)).toThrow(
        'No states found in context of year 2023',
      )

      // Test with context missing the specific year
      const contextMissingYear: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {
          2022: {
            states: [
              {
                name: 'California',
                state_code: '06',
                ucgid_code: '0400000US06',
                geo_id: '0400000US06',
                summary_level_code: '040',
                for_param: 'state:06',
                in_param: null,
                year: 2022,
                intptlat: 36.7783,
                intptlon: -119.4179,
              },
            ],
          },
        },
      }

      expect(() =>
        runner.getStateCodesForYear(contextMissingYear, 2023),
      ).toThrow('No states found in context of year 2023')

      // Test with context having the year but empty states array
      const contextEmptyStates: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {
          2023: {
            states: [],
          },
        },
      }

      expect(() =>
        runner.getStateCodesForYear(contextEmptyStates, 2023),
      ).toThrow('No states found in context of year 2023')

      // Test with context having states with null/undefined state_code values
      const contextNullStateCodes: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {
          2023: {
            states: [
              {
                name: 'Invalid State 1',
                state_code: null,
                ucgid_code: '0400000US00',
                geo_id: '0400000US00',
                summary_level_code: '040',
                for_param: 'state:00',
                in_param: null,
                year: 2023,
                intptlat: 0,
                intptlon: 0,
              },
              {
                name: 'Invalid State 2',
                state_code: undefined,
                ucgid_code: '0400000US01',
                geo_id: '0400000US01',
                summary_level_code: '040',
                for_param: 'state:01',
                in_param: null,
                year: 2023,
                intptlat: 0,
                intptlon: 0,
              },
            ],
          },
        },
      }

      expect(() =>
        runner.getStateCodesForYear(contextNullStateCodes, 2023),
      ).toThrow('No states found in context of year 2023')

      // Test with undefined context
      expect(() => runner.getStateCodesForYear(undefined, 2023)).toThrow(
        'No states found in context of year 2023',
      )
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
          category VARCHAR(100),
          year INTEGER,
          county_code VARCHAR(3),
          state_code VARCHAR(3),
          for_param VARCHAR(15),
          in_param VARCHAR(15)
        )
      `)
    })

    afterEach(async () => {
      await client.query('DROP TABLE IF EXISTS seed_comprehensive_test')
    })

    it('should handle URL-based seeding with context', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([
          { id: 1, name: 'API Item 1', category: 'test', year: 2023 },
          { id: 2, name: 'API Item 2', category: 'test', year: 2023 },
        ]),
      })

      const seedConfig = {
        url: (context: GeographyContext) =>
          `https://api.example.com/items/${context.year}?category=test&limit=100`,
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
      }

      const context: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {},
      }

      await runner.seed(seedConfig, context)

      // Verify the URL was called with the year from context
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/items/2023?category=test&limit=100',
      )

      const result = await client.query(
        'SELECT * FROM seed_comprehensive_test ORDER BY id',
      )
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].name).toBe('API Item 1')

      fetchSpy.mockRestore()
    })

    it('should handle static URL seeding', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue([
            { id: 1, name: 'Static Item 1', category: 'static' },
          ]),
      })

      const seedConfig = {
        url: 'https://api.example.com/static-items',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
      }

      await runner.seed(seedConfig)

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/static-items',
      )

      fetchSpy.mockRestore()
    })

    it('should handle beforeSeed hook with context', async () => {
      const testData = [
        { id: 1, name: 'Test 1', category: 'original' },
        { id: 2, name: 'Test 2', category: 'original' },
      ]

      const filePath = path.join(
        __dirname,
        'fixtures',
        'before_seed_context_test.json',
      )
      await fs.writeFile(filePath, JSON.stringify(testData))

      let beforeSeedCalled = false
      let receivedContext: GeographyContext | undefined

      const seedConfig = {
        file: 'before_seed_context_test.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        beforeSeed: async (
          client: Client,
          rawData: unknown[],
          context?: GeographyContext,
        ) => {
          beforeSeedCalled = true
          receivedContext = context

          // Modify data based on context
          if (context?.year) {
            rawData.forEach((item: unknown) => {
              item.year = context.year
            })
          }

          // Verify we can use the client in beforeSeed
          const result = await client.query('SELECT NOW()')
          expect(result.rows).toHaveLength(1)
        },
      }

      const context: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {},
      }

      await runner.seed(seedConfig, context)

      expect(beforeSeedCalled).toBe(true)
      expect(receivedContext).toEqual(context)

      // Verify data was modified with year
      const result = await client.query(
        'SELECT * FROM seed_comprehensive_test ORDER BY id',
      )
      expect(result.rows[0].year).toBe(2023)
      expect(result.rows[1].year).toBe(2023)
    })

    it('should handle afterSeed hook with context', async () => {
      const testData = [{ id: 1, name: 'Test 1', category: 'test' }]
      const filePath = path.join(
        __dirname,
        'fixtures',
        'after_seed_context_test.json',
      )
      await fs.writeFile(filePath, JSON.stringify(testData))

      let afterSeedCalled = false
      let receivedContext: GeographyContext | undefined

      const seedConfig = {
        file: 'after_seed_context_test.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        afterSeed: async (client: Client, context?: GeographyContext) => {
          afterSeedCalled = true
          receivedContext = context

          // Verify context data
          if (context?.year) {
            const result = await client.query(
              'SELECT COUNT(*) as count FROM seed_comprehensive_test WHERE year = $1',
              [context.year],
            )
            expect(parseInt(result.rows[0].count)).toBeGreaterThan(0)
          }
        },
        beforeSeed: async (
          client: Client,
          rawData: unknown[],
          context?: GeographyContext,
        ) => {
          // Add year to data
          if (context?.year) {
            rawData.forEach((item: unknown) => {
              item.year = context.year
            })
          }
        },
      }

      const context: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {},
      }

      await runner.seed(seedConfig, context)

      expect(afterSeedCalled).toBe(true)
      expect(receivedContext).toEqual(context)
    })

    it('should work without context', async () => {
      const testData = [{ id: 1, name: 'No Context Test', category: 'test' }]
      const filePath = path.join(__dirname, 'fixtures', 'no_context_test.json')
      await fs.writeFile(filePath, JSON.stringify(testData))

      const seedConfig = {
        file: 'no_context_test.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
      }

      // Call without context
      await runner.seed(seedConfig)

      const result = await client.query(
        'SELECT * FROM seed_comprehensive_test ORDER BY id',
      )
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('No Context Test')
    })

    it('should handle context with existing parentGeographies', async () => {
      const testData = [
        {
          id: 1,
          name: 'Los Angeles County',
          category: 'county',
          county_code: '037',
          state_code: '06',
        },
        {
          id: 2,
          name: 'Orange County',
          category: 'county',
          county_code: '059',
          state_code: '06',
        },
      ]
      const filePath = path.join(__dirname, 'fixtures', 'county_test.json')
      await fs.writeFile(filePath, JSON.stringify(testData))

      let contextReceived = false

      const seedConfig = {
        file: 'county_test.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        beforeSeed: async (
          client: Client,
          rawData: unknown[],
          context?: GeographyContext,
        ) => {
          contextReceived = true

          // This simulates how county seeding would use state data from context
          if (context?.parentGeographies?.states) {
            const californiaState = context.parentGeographies.states.find(
              (state) => state.name === 'California',
            )

            if (californiaState) {
              rawData.forEach((county: unknown) => {
                county.year = context.year
                county.for_param = `county:${county.county_code}`
                county.in_param = `state:${county.state_code}`
              })
            }
          }
        },
      }

      // Set up context with pre-existing state data (as would happen in real seeding)
      const context: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {
          states: [
            {
              name: 'California',
              ucgid_code: '0400000US06',
              geo_id: '0400000US06',
              summary_level_code: '040',
              for_param: 'state:06',
              in_param: null,
              year: 2023,
              intptlat: 36.7783,
              intptlon: -119.4179,
            },
          ],
        },
      }

      await runner.seed(seedConfig, context)

      expect(contextReceived).toBe(true)

      // Verify the data was processed correctly
      const result = await client.query(
        'SELECT * FROM seed_comprehensive_test ORDER BY id',
      )
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].name).toBe('Los Angeles County')
      expect(result.rows[0].for_param).toBe('county:037')
      expect(result.rows[0].in_param).toBe('state:06')
      expect(result.rows[0].year).toBe(2023)
    })

    // ... keep existing rollback tests but update them for context support ...

    it('should handle transaction rollback on afterSeed failure with context', async () => {
      const testData = [{ id: 1, name: 'Test 1', category: 'test' }]
      const filePath = path.join(
        __dirname,
        'fixtures',
        'rollback_context_test.json',
      )
      await fs.writeFile(filePath, JSON.stringify(testData))

      const seedConfig = {
        file: 'rollback_context_test.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        afterSeed: async (client: Client, context?: GeographyContext) => {
          throw new Error(`AfterSeed failure for year ${context?.year}`)
        },
      }

      const context: GeographyContext = { year: 2023, year_id: 1 }

      await expect(runner.seed(seedConfig, context)).rejects.toThrow(
        'AfterSeed failure for year 2023',
      )

      // Verify no data was inserted due to rollback
      const result = await client.query(
        'SELECT COUNT(*) as count FROM seed_comprehensive_test',
      )
      expect(parseInt(result.rows[0].count)).toBe(0)
    })
  })
})
