import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
  type Mock,
} from 'vitest'
import { Client } from 'pg'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import {
  GeographyContext,
  GeographySeedConfig,
  SeedConfig,
} from '../../../src/schema/seed-config.schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mock pg Client
vi.mock('pg', () => {
  const mockClient = {
    connect: vi.fn(),
    end: vi.fn(),
    query: vi.fn(),
  }
  return {
    Client: vi.fn(() => mockClient),
  }
})

describe('SeedRunner', () => {
  let runner: SeedRunner
  let mockClient: {
    connect: Mock
    end: Mock
    query: Mock
  }
  let mockFetch: Mock
  let fixturesPath: string

  beforeAll(async () => {
    // Create fixtures directory
    fixturesPath = path.join(__dirname, 'fixtures')
    try {
      await fs.mkdir(fixturesPath, { recursive: true })
    } catch {
      // Directory already exists
    }
  })

  afterAll(async () => {
    // Clean up fixtures directory
    try {
      const files = await fs.readdir(fixturesPath)
      for (const file of files) {
        await fs.unlink(path.join(fixturesPath, file))
      }
      await fs.rmdir(fixturesPath)
    } catch {
      // Directory might not exist or already cleaned
    }
  })

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup mock client
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    }
    ;(Client as unknown as Mock).mockImplementation(() => mockClient)

    // Setup mock fetch
    mockFetch = vi.fn()
    global.fetch = mockFetch

    // Create runner instance with fixtures path
    runner = new SeedRunner(
      'postgresql://test:test@localhost:5432/test',
      fixturesPath,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should create instance with default dataPath', () => {
      const instance = new SeedRunner(
        'postgresql://test:test@localhost:5432/test',
      )
      expect(instance).toBeInstanceOf(SeedRunner)
      expect(Client).toHaveBeenCalledWith({
        connectionString: 'postgresql://test:test@localhost:5432/test',
      })
    })

    it('should create instance with custom dataPath', () => {
      const customPath = '/custom/path'
      const instance = new SeedRunner(
        'postgresql://test:test@localhost:5432/test',
        customPath,
      )
      expect(instance).toBeInstanceOf(SeedRunner)
    })

    it('should accept custom rate limit config', () => {
      const customConfig = {
        requestsPerSecond: 5,
        burstLimit: 3,
        retryAttempts: 5,
        retryDelay: 2000,
      }

      const instance = new SeedRunner(
        'postgresql://test:test@localhost:5432/test',
        undefined,
        customConfig,
      )

      expect(instance).toBeInstanceOf(SeedRunner)
    })
  })

  describe('Connection Management', () => {
    it('should connect to database', async () => {
      await runner.connect()
      expect(mockClient.connect).toHaveBeenCalledTimes(1)
    })

    it('should disconnect from database', async () => {
      await runner.connect()
      await runner.disconnect()
      expect(mockClient.end).toHaveBeenCalledTimes(1)
    })

    it('should wait for queue to empty before disconnecting', async () => {
      await runner.connect()

      // Mock a pending request
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ data: [] }),
                }),
              100,
            ),
          ),
      )

      // Start a request
      const requestPromise = runner.fetchFromApi('https://api.example.com/test')

      // Disconnect should wait for the request
      await runner.disconnect()
      await requestPromise

      expect(mockClient.end).toHaveBeenCalled()
    })
  })

  describe('getAvailableYears', () => {
    it('should return available years ordered by year', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: '1', year: '2020' },
          { id: '2', year: '2023' },
        ],
        rowCount: 2,
      })

      await runner.connect()
      const result = await runner.getAvailableYears()

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT id, year FROM years WHERE import_geographies = true ORDER BY year',
      )
      expect(result).toEqual([
        { id: 1, year: 2020 },
        { id: 2, year: 2023 },
      ])
    })

    it('should return empty array when no years exist', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      })

      await runner.connect()
      const result = await runner.getAvailableYears()

      expect(result).toEqual([])
    })

    it('should properly parse string values to numbers', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: '5', year: '2021' },
          { id: '10', year: '2022' },
        ],
        rowCount: 2,
      })

      await runner.connect()
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
      it('should return state codes from context', async () => {
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
                  name: 'Alaska',
                  state_code: '2',
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

        await runner.connect()
        const result = await runner.getStateCodesForYear(context, 2023)

        expect(result).toEqual(['02', '06'])
        expect(mockClient.query).not.toHaveBeenCalled()
      })

      it('should filter out null/undefined state codes', async () => {
        const context: GeographyContext = {
          year: 2023,
          year_id: 1,
          parentGeographies: {
            2023: {
              states: [
                {
                  name: 'Valid State',
                  state_code: '06',
                  ucgid_code: '0400000US06',
                  summary_level_code: '040',
                  for_param: 'state:06',
                  in_param: null,
                  latitude: 36.7783,
                  longitude: -119.4179,
                },
                {
                  name: 'Invalid State',
                  state_code: null,
                  ucgid_code: '0400000US00',
                  summary_level_code: '040',
                  for_param: 'state:00',
                  in_param: null,
                  latitude: 0,
                  longitude: 0,
                },
              ],
            },
          },
        }

        await runner.connect()
        const result = await runner.getStateCodesForYear(context, 2023)

        // Should filter out null and return only valid state code
        expect(result).toEqual(['06'])
      })
    })

    describe('when states are not in context', () => {
      it('should fetch from database', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [{ state_code: '06' }, { state_code: '48' }, { state_code: 2 }],
          rowCount: 3,
        })

        const context: GeographyContext = {
          year: 2023,
          year_id: 1,
          parentGeographies: {},
        }

        await runner.connect()
        const result = await runner.getStateCodesForYear(context, 2023)

        expect(result).toEqual(['02', '06', '48'])
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT state_code'),
          [1],
        )
      })

      it('should throw error when no states found in database', async () => {
        mockClient.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        })

        const context: GeographyContext = {
          year: 2024,
          year_id: 2,
          parentGeographies: {},
        }

        await runner.connect()

        await expect(
          runner.getStateCodesForYear(context, 2024),
        ).rejects.toThrow('No states found in context of year 2024')
      })
    })

    describe('error cases', () => {
      it('should throw error for empty context', async () => {
        const context: GeographyContext = {
          year: 2023,
          year_id: 1,
          parentGeographies: {},
        }

        mockClient.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        })

        await runner.connect()

        await expect(
          runner.getStateCodesForYear(context, 2023),
        ).rejects.toThrow('No states found in context of year 2023')
      })

      it('should throw error when context has wrong year', async () => {
        const context: GeographyContext = {
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

        mockClient.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        })

        await runner.connect()

        await expect(
          runner.getStateCodesForYear(context, 2023),
        ).rejects.toThrow('No states found in context of year 2023')
      })
    })
  })

  describe('API Rate Limiting and Retry Logic', () => {
    beforeEach(async () => {
      await runner.connect()
    })

    it('should successfully fetch from API', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: ['test'] }),
        } as Partial<Response> as Response),
      )

      const result = await runner.fetchFromApi('https://api.example.com/data')

      expect(result).toEqual({ data: ['test'] })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and succeed', async () => {
      mockFetch
        .mockImplementationOnce(() =>
          Promise.reject(new Error('Network error')),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: ['success'] }),
          } as Partial<Response> as Response),
        )

      const result = await runner.fetchFromApi('https://api.example.com/data')

      expect(result).toEqual({ data: ['success'] })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should throw error after max retries', async () => {
      mockFetch.mockImplementation(() =>
        Promise.reject(new Error('Network error')),
      )

      await expect(
        runner.fetchFromApi('https://api.example.com/data'),
      ).rejects.toThrow('Network error')

      expect(mockFetch).toHaveBeenCalledTimes(4) // initial + 3 retries
    })

    it('should handle HTTP error responses', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: vi.fn().mockResolvedValue({}),
        } as Partial<Response> as Response),
      )

      await expect(
        runner.fetchFromApi('https://api.example.com/data'),
      ).rejects.toThrow('API request failed: 500 Internal Server Error')
    })

    it('should throttle multiple concurrent requests', async () => {
      const strictRunner = new SeedRunner(
        'postgresql://test:test@localhost:5432/test',
        undefined,
        {
          requestsPerSecond: 2,
          burstLimit: 2,
          retryAttempts: 1,
          retryDelay: 100,
        },
      )

      await strictRunner.connect()

      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Partial<Response> as Response),
      )

      const promises = [
        strictRunner.fetchFromApi('https://api.example.com/1'),
        strictRunner.fetchFromApi('https://api.example.com/2'),
        strictRunner.fetchFromApi('https://api.example.com/3'),
      ]

      await Promise.all(promises)

      expect(mockFetch).toHaveBeenCalledTimes(3)
      await strictRunner.disconnect()
    })
  })

  describe('API Call Logging', () => {
    beforeEach(async () => {
      await runner.connect()
      // Mock the table creation
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 })
    })

    it('should return false for uncalled API', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await runner.hasApiBeenCalled(
        'https://api.example.com/test',
      )

      expect(result).toBe(false)
    })

    it('should return true for called API', async () => {
      // First call for table check, second for hasApiBeenCalled
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // table creation
        .mockResolvedValueOnce({ rows: [{ url: 'test' }], rowCount: 1 }) // has been called check

      const result = await runner.hasApiBeenCalled(
        'https://api.example.com/test',
      )

      expect(result).toBe(true)
    })

    it('should record API call', async () => {
      await runner.recordApiCall('https://api.example.com/test')

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_call_log'),
      )
    })

    it('should be idempotent when recording same URL', async () => {
      await runner.recordApiCall('https://api.example.com/test')
      await runner.recordApiCall('https://api.example.com/test')

      // Should use ON CONFLICT to update
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
      )
    })
  })

  describe('loadData', () => {
    beforeEach(async () => {
      await runner.connect()
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 })
    })

    describe('File Loading', () => {
      it('should load data from JSON file', async () => {
        const mockData = [{ id: 1, name: 'test' }]
        const filePath = path.join(fixturesPath, 'test-load.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        const result = await runner.loadData('test-load.json')

        expect(result).toEqual(mockData)
      })

      it('should extract nested data with path', async () => {
        const mockData = {
          level1: {
            level2: {
              data: [{ id: 1, name: 'nested' }],
            },
          },
        }
        const filePath = path.join(fixturesPath, 'test-nested.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        const result = await runner.loadData(
          'test-nested.json',
          'level1.level2.data',
        )

        expect(result).toEqual([{ id: 1, name: 'nested' }])
      })

      it('should throw error for missing nested key', async () => {
        const mockData = { level1: { level2: {} } }
        const filePath = path.join(fixturesPath, 'test-missing-key.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        await expect(
          runner.loadData('test-missing-key.json', 'level1.level2.missing'),
        ).rejects.toThrow('Key "missing" not found')
      })

      it('should throw error for null intermediate value', async () => {
        const mockData = { level1: null }
        const filePath = path.join(fixturesPath, 'test-null-intermediate.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        await expect(
          runner.loadData('test-null-intermediate.json', 'level1.level2'),
        ).rejects.toThrow('Key "level2" not found')
      })

      it('should throw error if data is not an array', async () => {
        const mockData = { notArray: 'value' }
        const filePath = path.join(fixturesPath, 'test-not-array.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        await expect(runner.loadData('test-not-array.json')).rejects.toThrow(
          'Expected array data',
        )
      })
    })

    describe('URL Loading', () => {
      it('should load data from URL', async () => {
        const mockData = [{ id: 1, name: 'api-data' }]
        mockFetch.mockImplementation(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockData,
          } as Partial<Response> as Response),
        )

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // hasApiBeenCalled returns false
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable for recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recordApiCall

        const result = await runner.loadData(
          'https://api.example.com/data',
          undefined,
          true,
        )

        expect(result).toEqual(mockData)
        expect(mockFetch).toHaveBeenCalled()
      })

      it('should skip fetch if API already called', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable
          .mockResolvedValueOnce({ rows: [{}], rowCount: 1 }) // hasApiBeenCalled returns true

        const result = await runner.loadData(
          'https://api.example.com/data',
          undefined,
          true,
        )

        expect(result).toEqual([])
        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('should fetch when alwaysFetch is true', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable
          .mockResolvedValueOnce({ rows: [{}], rowCount: 1 }) // hasApiBeenCalled (returns true but ignored)
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable for recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recordApiCall

        mockFetch.mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: async () => [{ id: 1 }],
          } as Partial<Response> as Response),
        )

        const result = await runner.loadData(
          'https://api.example.com/data',
          undefined,
          true,
          true,
        )

        expect(result).toEqual([{ id: 1 }])
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })

  describe('insertOrSkip', () => {
    beforeEach(async () => {
      await runner.connect()
    })

    it('should insert new records', async () => {
      const testData = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' },
      ]

      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2,
      })

      const result = await runner.insertOrSkip('test_table', testData, 'id')

      expect(result).toEqual([1, 2])
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_table'),
        expect.any(Array),
      )
    })

    it('should handle empty data array', async () => {
      const result = await runner.insertOrSkip('test_table', [], 'id')

      expect(result).toEqual([])
      expect(mockClient.query).not.toHaveBeenCalled()
    })

    it('should handle records with null values', async () => {
      const testData = [
        { id: 1, name: 'Test', value: null },
        { id: 2, name: null, value: 42 },
      ]

      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2,
      })

      const result = await runner.insertOrSkip('test_table', testData, 'id')

      expect(result).toHaveLength(2)
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_table'),
        [1, 'Test', null, 2, null, 42],
      )
    })

    it('should throw error if conflict column not in data', async () => {
      const testData = [{ name: 'Test' }]

      await expect(
        runner.insertOrSkip('test_table', testData, 'id'),
      ).rejects.toThrow("Conflict column 'id' not found in data")
    })
  })

  describe('insertOrSkipBatch', () => {
    beforeEach(async () => {
      await runner.connect()
    })

    it('should process large datasets in batches', async () => {
      const largeData = Array.from({ length: 1500 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
      }))

      // Mock responses for each batch - each batch returns an array of IDs
      mockClient.query
        .mockResolvedValueOnce({
          rows: Array.from({ length: 500 }, (_, i) => ({ id: i + 1 })),
          rowCount: 500,
        })
        .mockResolvedValueOnce({
          rows: Array.from({ length: 500 }, (_, i) => ({ id: i + 501 })),
          rowCount: 500,
        })
        .mockResolvedValueOnce({
          rows: Array.from({ length: 500 }, (_, i) => ({ id: i + 1001 })),
          rowCount: 500,
        })

      const result = await runner.insertOrSkipBatch(
        'test_table',
        largeData,
        'id',
        500,
      )

      expect(result).toHaveLength(1500)
      expect(mockClient.query).toHaveBeenCalledTimes(3) // 3 batches
    })

    it('should handle empty data', async () => {
      const result = await runner.insertOrSkipBatch('test_table', [], 'id')

      expect(result).toEqual([])
      expect(mockClient.query).not.toHaveBeenCalled()
    })

    it('should use default batch size of 1000', async () => {
      const data = Array.from({ length: 2500 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
      }))

      mockClient.query.mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
      })

      await runner.insertOrSkipBatch('test_table', data, 'id')

      expect(mockClient.query).toHaveBeenCalledTimes(3) // 3 batches of 1000
    })
  })

  describe('seed', () => {
    beforeEach(async () => {
      await runner.connect()
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 })
    })

    describe('File-based seeding', () => {
      it('should seed from file without context', async () => {
        const mockData = [{ id: 1, name: 'Test' }]
        const filePath = path.join(fixturesPath, 'seed-test.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

        const config: SeedConfig = {
          file: 'seed-test.json',
          table: 'test_table',
          conflictColumn: 'id',
          url: '',
        }

        await runner.seed(config)

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN')
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT')
      })

      it('should execute beforeSeed hook', async () => {
        const mockData = [{ id: 1, name: 'Test' }]
        const filePath = path.join(fixturesPath, 'before-seed-test.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        const beforeSeedMock = vi.fn()

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

        const config: SeedConfig = {
          file: 'before-seed-test.json',
          table: 'test_table',
          conflictColumn: 'id',
          url: '',
          beforeSeed: beforeSeedMock,
        }

        await runner.seed(config)

        expect(beforeSeedMock).toHaveBeenCalledWith(mockClient, mockData)
      })

      it('should execute afterSeed hook', async () => {
        const mockData = [{ id: 1, name: 'Test' }]
        const filePath = path.join(fixturesPath, 'after-seed-test.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        const afterSeedMock = vi.fn()

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

        const config: SeedConfig = {
          file: 'after-seed-test.json',
          table: 'test_table',
          conflictColumn: 'id',
          url: '',
          afterSeed: afterSeedMock,
        }

        await runner.seed(config)

        expect(afterSeedMock).toHaveBeenCalledWith(mockClient)
      })
    })

    describe('URL-based seeding', () => {
      it('should seed from static URL', async () => {
        const mockData = [{ id: 1, name: 'API Data' }]
        mockFetch.mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: async () => mockData,
          } as Partial<Response> as Response),
        )

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // hasApiBeenCalled
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable for recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

        const config: SeedConfig = {
          url: 'https://api.example.com/data',
          table: 'test_table',
          conflictColumn: 'id',
        }

        await runner.seed(config)

        expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data')
      })

      it('should seed from dynamic URL with context', async () => {
        const mockData = [{ id: 1, name: 'Context Data', year: 2023 }]
        mockFetch.mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: async () => mockData,
          } as Partial<Response> as Response),
        )

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // hasApiBeenCalled
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable for recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

        const config: GeographySeedConfig = {
          url: (context: GeographyContext) =>
            `https://api.example.com/data/${context.year}`,
          table: 'test_table',
          conflictColumn: 'id',
        }

        const context: GeographyContext = {
          year: 2023,
          year_id: 1,
          parentGeographies: {},
        }

        await runner.seed(config, context)

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/data/2023',
        )
      })

      it('should pass context to beforeSeed hook', async () => {
        const mockData = [{ id: 1, name: 'Test' }]
        mockFetch.mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: async () => mockData,
          } as Partial<Response> as Response),
        )

        const beforeSeedMock = vi.fn()

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // hasApiBeenCalled
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable for recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

        const context: GeographyContext = {
          year: 2023,
          year_id: 1,
          parentGeographies: {},
        }

        const config: GeographySeedConfig = {
          url: (ctx: GeographyContext) => `https://api.example.com/${ctx.year}`,
          table: 'test_table',
          conflictColumn: 'id',
          beforeSeed: beforeSeedMock,
        }

        await runner.seed(config, context)

        expect(beforeSeedMock).toHaveBeenCalledWith(
          mockClient,
          mockData,
          context,
        )
      })

      it('should pass context to afterSeed hook', async () => {
        const mockData = [{ id: 1, name: 'Test' }]
        mockFetch.mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: async () => mockData,
          } as Partial<Response> as Response),
        )

        const afterSeedMock = vi.fn()

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // hasApiBeenCalled
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable for recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT - returns ID
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

        const context: GeographyContext = {
          year: 2023,
          year_id: 1,
          parentGeographies: {},
        }

        const config: GeographySeedConfig = {
          url: (ctx: GeographyContext) => `https://api.example.com/${ctx.year}`,
          table: 'test_table',
          conflictColumn: 'id',
          afterSeed: afterSeedMock,
        }

        await runner.seed(config, context)

        // With the INSERT returning id:1, we should get [1] in the insertedIds
        expect(afterSeedMock).toHaveBeenCalledWith(mockClient, context, [1])
      })
    })

    describe('alwaysFetch option', () => {
      it('should skip cached URLs by default', async () => {
        mockClient.query.mockImplementation(async (query: string) => {
          // CREATE TABLE for api_call_log
          if (query.includes('CREATE TABLE IF NOT EXISTS api_call_log')) {
            return { rows: [], rowCount: 0 }
          }
          // SELECT to check if API was called - return found (rowCount > 0)
          if (query.includes('SELECT 1 FROM api_call_log WHERE url')) {
            return { rows: [{ '?column?': 1 }], rowCount: 1 }
          }

          return { rows: [], rowCount: 0 }
        })

        // Mock fetch to throw if accidentally called
        mockFetch.mockImplementation(() => {
          throw new Error('Fetch should not be called when API is cached')
        })

        const config: SeedConfig = {
          url: 'https://api.example.com/data',
          table: 'test_table',
          conflictColumn: 'id',
        }

        await runner.seed(config)

        // Verify fetch was not called and no data was inserted
        expect(mockFetch).not.toHaveBeenCalled()
        const calls = mockClient.query.mock.calls.map((call) => call[0])
        expect(calls.some((call) => call.includes('INSERT'))).toBe(false)
      })

      it('should fetch when alwaysFetch is true', async () => {
        const mockData = [{ id: 1, name: 'Test' }]
        mockFetch.mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: async () => mockData,
          } as Partial<Response> as Response),
        )

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable
          .mockResolvedValueOnce({ rows: [{}], rowCount: 1 }) // hasApiBeenCalled (already called but we ignore it)
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureApiCallLogTable for recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // recordApiCall
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

        const config: SeedConfig = {
          url: 'https://api.example.com/data',
          table: 'test_table',
          conflictColumn: 'id',
          alwaysFetch: true,
        }

        await runner.seed(config)

        expect(mockFetch).toHaveBeenCalled()
      })
    })

    describe('Transaction handling', () => {
      it('should rollback on error', async () => {
        const mockData = [{ id: 1, name: 'Test' }]
        const filePath = path.join(fixturesPath, 'rollback-test.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockRejectedValueOnce(new Error('Insert failed')) // INSERT fails

        const config: SeedConfig = {
          file: 'rollback-test.json',
          table: 'test_table',
          conflictColumn: 'id',
          url: '',
        }

        await expect(runner.seed(config)).rejects.toThrow('Insert failed')

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
      })

      it('should rollback when afterSeed fails', async () => {
        const mockData = [{ id: 1, name: 'Test' }]
        const filePath = path.join(fixturesPath, 'after-fail-test.json')
        await fs.writeFile(filePath, JSON.stringify(mockData))

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT

        const config: SeedConfig = {
          file: 'after-fail-test.json',
          table: 'test_table',
          conflictColumn: 'id',
          url: '',
          afterSeed: async () => {
            throw new Error('AfterSeed failed')
          },
        }

        await expect(runner.seed(config)).rejects.toThrow('AfterSeed failed')

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
      })

      it('should use batch processing for large datasets', async () => {
        const largeData = Array.from({ length: 1500 }, (_, i) => ({
          id: i + 1,
          name: `Item ${i + 1}`,
        }))
        const filePath = path.join(fixturesPath, 'large-batch-test.json')
        await fs.writeFile(filePath, JSON.stringify(largeData))

        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({
            rows: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 })),
            rowCount: 1000,
          }) // Batch 1
          .mockResolvedValueOnce({
            rows: Array.from({ length: 500 }, (_, i) => ({ id: i + 1001 })),
            rowCount: 500,
          }) // Batch 2
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

        const config: SeedConfig = {
          file: 'large-batch-test.json',
          table: 'test_table',
          conflictColumn: 'id',
          url: '',
        }

        await runner.seed(config)

        // BEGIN + 2 batches (1000 + 500) + COMMIT
        expect(mockClient.query).toHaveBeenCalledTimes(4)
      })
    })

    describe('Edge cases', () => {
      it('should skip seeding when no new data', async () => {
        mockClient.query.mockImplementation(async (query: string) => {
          // CREATE TABLE for api_call_log
          if (query.includes('CREATE TABLE IF NOT EXISTS api_call_log')) {
            return { rows: [], rowCount: 0 }
          }
          // SELECT to check if API was called - return found (rowCount > 0)
          if (query.includes('SELECT 1 FROM api_call_log WHERE url')) {
            return { rows: [{ '?column?': 1 }], rowCount: 1 }
          }

          return { rows: [], rowCount: 0 }
        })

        // Mock fetch to throw if accidentally called
        mockFetch.mockImplementation(() => {
          throw new Error('Fetch should not be called when API is cached')
        })

        const config: SeedConfig = {
          url: 'https://api.example.com/data',
          table: 'test_table',
          conflictColumn: 'id',
        }

        await runner.seed(config)

        expect(mockFetch).not.toHaveBeenCalled()
        const calls = mockClient.query.mock.calls.map((call) => call[0])
        expect(calls.some((call) => call.includes('INSERT'))).toBe(false)
      })

      it('should handle context with cached URL', async () => {
        mockClient.query.mockImplementation(async (query: string) => {
          // CREATE TABLE for api_call_log
          if (query.includes('CREATE TABLE IF NOT EXISTS api_call_log')) {
            return { rows: [], rowCount: 0 }
          }
          // SELECT to check if API was called - return found (rowCount > 0)
          if (query.includes('SELECT 1 FROM api_call_log WHERE url')) {
            return { rows: [{ '?column?': 1 }], rowCount: 1 }
          }

          return { rows: [], rowCount: 0 }
        })

        // Mock fetch to throw if accidentally called
        mockFetch.mockImplementation(() => {
          throw new Error('Fetch should not be called when API is cached')
        })

        const config: SeedConfig = {
          url: 'https://api.example.com/data',
          table: 'test_table',
          conflictColumn: 'id',
        }

        const context: GeographyContext = {
          year: 2023,
          year_id: 1,
          parentGeographies: {},
        }

        await runner.seed(config, context)

        expect(mockFetch).not.toHaveBeenCalled()
        const calls = mockClient.query.mock.calls.map((call) => call[0])
        expect(calls.some((call) => call.includes('INSERT'))).toBe(false)
      })
    })
  })
})
