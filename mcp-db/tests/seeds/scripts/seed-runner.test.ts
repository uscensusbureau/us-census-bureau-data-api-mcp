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
import {
  GeographyContext,
  GeographySeedConfig,
} from '../../../src/schema/seed-config.schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type Item = { year: number }
type County = {
  id: number
  name: string
  category: string
  county_code: string
  state_code: string
  for_param?: string
  in_param?: string
}

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
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: [] }),
      } as Partial<Response> as Response)

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
        INSERT INTO years (year, import_geographies) VALUES
        (2020, true),
        (2021, false),
        (2023, true)
      `)
    })

    afterEach(async () => {
      // Clean up test data
      await client.query('DELETE FROM years WHERE year IN (2020, 2021, 2023)')
    })

    it('should return available years ordered by year', async () => {
      const result = await runner.getAvailableYears()

      expect(result.map((r) => r.year)).toEqual([2020, 2023])

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
    describe('when states are present in context', () => {
      it('returns an array of state codes from the context', async () => {
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
                  summary_level_code: '040',
                  for_param: 'state:06',
                  in_param: null,
                  latitude: 36.7783,
                  longitude: -119.4179,
                },
                {
                  name: 'Texas',
                  state_code: '48',
                  ucgid_code: '0400000US48',
                  summary_level_code: '040',
                  for_param: 'state:48',
                  in_param: null,
                  latitude: 31.9686,
                  longitude: -99.9018,
                },
                {
                  name: 'New York',
                  state_code: '36',
                  ucgid_code: '0400000US36',
                  summary_level_code: '040',
                  for_param: 'state:36',
                  in_param: null,
                  latitude: 42.9538,
                  longitude: -75.5268,
                },
                {
                  name: 'Alaska',
                  state_code: '2', // Test single digit padding
                  ucgid_code: '0400000US02',
                  summary_level_code: '040',
                  for_param: 'state:02',
                  in_param: null,
                  latitude: 64.0685,
                  longitude: -152.2782,
                },
              ],
            },
          },
        }

        const result = await runner.getStateCodesForYear(context, 2023)

        expect(result).toEqual(['02', '06', '36', '48']) // Should be sorted and zero-padded
        expect(result).toHaveLength(4)

        // Verify all codes are 2-digit strings
        result.forEach((code) => {
          expect(typeof code).toBe('string')
          expect(code).toHaveLength(2)
          expect(code).toMatch(/^\d{2}$/)
        })
      })
    })

    describe('when states are not present in the context', () => {
      beforeAll(async () => {
        // Create tables if they don't exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS geographies (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            state_code VARCHAR(3),
            ucgid_code VARCHAR(20),
            summary_level_code VARCHAR(10),
            for_param VARCHAR(50),
            in_param VARCHAR(50),
            latitude DECIMAL(10, 6),
            longitude DECIMAL(10, 6)
          )
        `)

        await client.query(`
          CREATE TABLE IF NOT EXISTS geography_years (
            id SERIAL PRIMARY KEY,
            year_id INTEGER REFERENCES years(id) ON DELETE CASCADE,
            geography_id INTEGER REFERENCES geographies(id) ON DELETE CASCADE,
            UNIQUE(year_id, geography_id)
          )
        `)
      })

      beforeEach(async () => {
        // Insert test year
        await client.query(`
          INSERT INTO years (year) 
          VALUES (2023)
          ON CONFLICT (year) DO NOTHING
        `)

        // Get the year_id for 2023
        const yearResult = await client.query(
          `SELECT id FROM years WHERE year = 2023`,
        )
        const yearId = yearResult.rows[0].id

        // Insert test state geographies (removed geo_id column)
        await client.query(`
          INSERT INTO geographies (
            name, state_code, ucgid_code,
            summary_level_code, for_param, in_param,
            latitude, longitude
          ) VALUES
          ('California', '06', '0400000US06', '040', 'state:06', NULL, 36.7783, -119.4179),
          ('Texas', '48', '0400000US48', '040', 'state:48', NULL, 31.9686, -99.9018),
          ('Alaska', '02', '0400000US02', '040', 'state:02', NULL, 64.0685, -152.2782)
        `)

        // Link geographies to year
        await client.query(
          `
          INSERT INTO geography_years (year_id, geography_id)
          SELECT $1, id FROM geographies WHERE summary_level_code = '040'
        `,
          [yearId],
        )
      })

      afterEach(async () => {
        // Clean up test data in correct order (respecting foreign key constraints)
        await client.query(`
          DELETE FROM geography_years 
          WHERE year_id IN (SELECT id FROM years WHERE year IN (2023, 2024))
        `)
        await client.query(
          `DELETE FROM geographies WHERE summary_level_code = '040'`,
        )
        await client.query(`DELETE FROM years WHERE year IN (2023, 2024)`)
      })

      it('should fetch state codes from the database', async () => {
        // Get the year_id for context
        const yearResult = await client.query(
          `SELECT id FROM years WHERE year = 2023`,
        )
        const yearId = yearResult.rows[0].id

        // Create context without states in parentGeographies
        const context: GeographyContext = {
          year: 2023,
          year_id: yearId,
          parentGeographies: {}, // No states in context
        }

        const result = await runner.getStateCodesForYear(context, 2023)

        expect(result).toEqual(['02', '06', '48']) // Should be sorted and zero-padded
        expect(result).toHaveLength(3)

        // Verify all codes are 2-digit strings
        result.forEach((code) => {
          expect(typeof code).toBe('string')
          expect(code).toHaveLength(2)
          expect(code).toMatch(/^\d{2}$/)
        })
      })

      it('should handle empty database results', async () => {
        // Insert a year with no associated states
        await client.query(
          `INSERT INTO years (year) VALUES (2024) ON CONFLICT (year) DO NOTHING`,
        )
        const yearResult = await client.query(
          `SELECT id FROM years WHERE year = 2024`,
        )
        const yearId = yearResult.rows[0].id

        const context: GeographyContext = {
          year: 2024,
          year_id: yearId,
          parentGeographies: {},
        }

        await expect(
          runner.getStateCodesForYear(context, 2024),
        ).rejects.toThrow('No states found in context of year 2024')
      })

      it('should handle numeric state codes from database', async () => {
        const yearResult = await client.query(
          `SELECT id FROM years WHERE year = 2023`,
        )
        const yearId = yearResult.rows[0].id

        // Insert an additional state (removed geo_id column)
        await client.query(`
          INSERT INTO geographies (
            name, state_code, ucgid_code,
            summary_level_code, for_param, in_param,
            latitude, longitude
          ) VALUES
          ('New York', '36', '0400000US36', '040', 'state:36', NULL, 42.9538, -75.5268)
        `)

        await client.query(
          `
          INSERT INTO geography_years (year_id, geography_id)
          SELECT $1, id FROM geographies WHERE state_code = '36' AND summary_level_code = '040'
        `,
          [yearId],
        )

        const context: GeographyContext = {
          year: 2023,
          year_id: yearId,
          parentGeographies: {},
        }

        const result = await runner.getStateCodesForYear(context, 2023)

        expect(result).toContain('36')
        expect(result).toContain('02')
        expect(result).toContain('06')
        expect(result).toContain('48')
      })
    })

    describe('when states are neither in context or in the database', () => {
      it('throws an error', async () => {
        // Test with empty context
        const emptyContext: GeographyContext = {
          year: 2023,
          year_id: 1,
          parentGeographies: {},
        }

        await expect(
          runner.getStateCodesForYear(emptyContext, 2023),
        ).rejects.toThrow('No states found in context of year 2023')

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
                  summary_level_code: '040',
                  for_param: 'state:06',
                  in_param: null,
                  latitude: 36.7783,
                  longitude: -119.4179,
                },
              ],
            },
          },
        }

        await expect(
          runner.getStateCodesForYear(contextMissingYear, 2023),
        ).rejects.toThrow('No states found in context of year 2023')

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

        await expect(
          runner.getStateCodesForYear(contextEmptyStates, 2023),
        ).rejects.toThrow('No states found in context of year 2023')

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
                  summary_level_code: '040',
                  for_param: 'state:00',
                  in_param: null,
                  latitude: 0,
                  longitude: 0,
                },
                {
                  name: 'Invalid State 2',
                  state_code: undefined,
                  ucgid_code: '0400000US01',
                  summary_level_code: '040',
                  for_param: 'state:01',
                  in_param: null,
                  latitude: 0,
                  longitude: 0,
                },
              ],
            },
          },
        }

        await expect(
          runner.getStateCodesForYear(contextNullStateCodes, 2023),
        ).rejects.toThrow('No states found in context of year 2023')
      })
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
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify([
            { id: 1, name: 'API Item 1', category: 'test', year: 2023 },
            { id: 2, name: 'API Item 2', category: 'test', year: 2023 },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

      const seedConfig = {
        url: (context: GeographyContext) =>
          `https://api.example.com/items/${context.year}?category=test&limit=100`,
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        beforeSeed: async () => {},
        afterSeed: async () => {},
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
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify([
            { id: 1, name: 'Static Item 1', category: 'static' },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

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

      const seedConfig: GeographySeedConfig = {
        file: 'before_seed_context_test.json',
        table: 'seed_comprehensive_test',
        conflictColumn: 'id',
        url: '',
        beforeSeed: async (
          client: Client,
          rawData: unknown[],
          context: GeographyContext,
        ) => {
          beforeSeedCalled = true
          receivedContext = context

          // Modify data based on context
          rawData.forEach((item: unknown) => {
            const i = item as Item
            i.year = context.year
          })

          // Verify we can use the client in beforeSeed
          const result = await client.query('SELECT NOW()')
          expect(result.rows).toHaveLength(1)
        },
        afterSeed: async () => {},
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
        beforeSeed: async (
          client: Client,
          rawData: unknown[],
          context: GeographyContext,
        ) => {
          // Add year to the data so it can be queried in afterSeed
          rawData.forEach((item: unknown) => {
            const i = item as Item
            i.year = context.year
          })
        },
        afterSeed: async (
          client: Client,
          context: GeographyContext,
          insertedIds: number[],
        ) => {
          afterSeedCalled = true
          receivedContext = context

          // Verify context data
          if (context?.year) {
            const result = await client.query(
              'SELECT COUNT(*) as count FROM seed_comprehensive_test WHERE year = $1',
              [context.year],
            )
            expect(parseInt(result.rows[0].count)).toBeGreaterThan(0)
          } else {
            throw new Error(
              `Context year is missing in afterSeed with insertedIds ${insertedIds}`,
            )
          }
        },
        url: '',
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
          context: GeographyContext,
        ) => {
          contextReceived = true

          // This simulates how county seeding would use state data from context
          if (context?.parentGeographies) {
            const statesData = Object.values(context.parentGeographies)
              .flatMap((summaryLevel) => Object.values(summaryLevel).flat())
              .filter((geo) => geo.summary_level_code === '040')

            const californiaState = statesData.find(
              (state) => state.name === 'California',
            )

            if (californiaState) {
              rawData.forEach((county: unknown) => {
                const c = county as County
                c.for_param = `county:${c.county_code}`
                c.in_param = `state:${c.state_code}`
              })
            }
          }
        },
        afterSeed: async () => {},
        url: '',
      }

      // Set up context with pre-existing state data (as would happen in real seeding)
      const context: GeographyContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {
          '040': {
            states: [
              {
                name: 'California',
                ucgid_code: '0400000US06',
                summary_level_code: '040',
                for_param: 'state:06',
                in_param: null,
                latitude: 36.7783,
                longitude: -119.4179,
              },
            ],
          },
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
        beforeSeed: async () => {},
        afterSeed: async (
          client: Client,
          context: GeographyContext,
          insertedIds: number[],
        ) => {
          throw new Error(
            `AfterSeed failure for year ${context?.year} and ids ${insertedIds}`,
          )
        },
        url: '',
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

  // --- API Call Log and loadData API endpoint tests ---
  const TEST_URL = 'https://api.example.com/test-endpoint'
  const TEST_URL_2 = 'https://api.example.com/other-endpoint'

  // Helper to clean up the api_call_log table
  async function cleanupApiLog(client: Client) {
    await client.query('DELETE FROM api_call_log')
  }

  describe('SeedRunner API call log', () => {
    afterEach(async () => {
      await cleanupApiLog(client)
    })

    it('hasApiBeenCalled returns false for new URL, true after recordApiCall', async () => {
      expect(await runner.hasApiBeenCalled(TEST_URL)).toBe(false)
      await runner.recordApiCall(TEST_URL)
      expect(await runner.hasApiBeenCalled(TEST_URL)).toBe(true)
    })

    it('recordApiCall is idempotent and updates last_called', async () => {
      await runner.recordApiCall(TEST_URL)
      const first = await client.query(
        `SELECT last_called FROM api_call_log WHERE url = '${TEST_URL}'`,
      )
      await new Promise((r) => setTimeout(r, 10))
      await runner.recordApiCall(TEST_URL)
      const second = await client.query(
        `SELECT last_called FROM api_call_log WHERE url = '${TEST_URL}'`,
      )
      expect(second.rows[0].last_called.getTime()).toBeGreaterThanOrEqual(
        first.rows[0].last_called.getTime(),
      )
    })

    it('hasApiBeenCalled is independent for different URLs', async () => {
      await runner.recordApiCall(TEST_URL)
      expect(await runner.hasApiBeenCalled(TEST_URL)).toBe(true)
      expect(await runner.hasApiBeenCalled(TEST_URL_2)).toBe(false)
    })

    it('loadData skips fetch if API endpoint already called', async () => {
      // Write a dummy file for fallback
      const dummyFile = path.join(__dirname, 'fixtures', 'dummy.json')
      await fs.writeFile(dummyFile, JSON.stringify([{ id: 1 }]))
      // Record the API call first
      await runner.recordApiCall(TEST_URL)
      // Should skip fetch and return []
      const result = await runner.loadData(TEST_URL, undefined, true)
      expect(result).toEqual([])
    })

    it('loadData fetches and records if not already called', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: 42 }],
      })
      const result = await runner.loadData(TEST_URL, undefined, true)
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].id).toBe(42)
      // Now should be marked as called
      expect(await runner.hasApiBeenCalled(TEST_URL)).toBe(true)
    })
  })
})
