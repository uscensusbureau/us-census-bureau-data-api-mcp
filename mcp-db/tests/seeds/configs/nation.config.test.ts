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

vi.mock('../../../src/schema/geography.schema', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    transformApiGeographyData: vi.fn(),
  }
})

vi.mock('../../../src/helpers/geography-years.helper', async () => ({
  createGeographyYear: vi.fn(),
}))

import { cleanupWithRetry } from '../../helpers/database-cleanup'
import { dbConfig } from '../../helpers/database-config'
import { NationConfig } from '../../../src/seeds/configs/nation.config'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import { GeographyContext } from '../../../src/schema/seed-config'
import { transformApiGeographyData } from '../../../src/schema/geography.schema'
import { createGeographyYear } from '../../../src/helpers/geography-years.helper'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Nation Config', () => {
  let runner: SeedRunner
  let client: Client
  let databaseUrl: string
  let fixturesPath: string

  beforeAll(async () => {
    client = new Client(dbConfig)
    await client.connect()

    // Construct database URL for SeedRunner
    databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`

    // Set up fixtures path
    fixturesPath = path.join(__dirname, 'fixtures')
  })

  afterAll(async () => {
    await client.end()
  })

  beforeEach(async () => {
    // Clear the mock between tests
    vi.mocked(transformApiGeographyData).mockClear()
    vi.mocked(createGeographyYear).mockClear()

    // Create test fixtures directory
    try {
      await fs.mkdir(fixturesPath, { recursive: true })
    } catch {
      console.log('Directory already exists.')
    }

    runner = new SeedRunner(databaseUrl, fixturesPath)
    await runner.connect()

    await cleanupWithRetry(client, ['geographies', 'summary_levels', 'years'])
  })

  afterEach(async () => {
    await runner.disconnect()
  })

  it('should have valid configuration structure', () => {
    const geographySeed = NationConfig

    expect(geographySeed).toBeDefined()
    expect(geographySeed?.table).toBe('geographies')
    expect(geographySeed?.conflictColumn).toBe('ucgid_code')
    expect(geographySeed?.beforeSeed).toBeDefined()
    expect(geographySeed?.afterSeed).toBeDefined()
  })

  describe('beforeSeed', () => {
    let mockClient: Partial<Client>
    let mockContext: GeographyContext

    beforeEach(() => {
      mockClient = {
        query: vi.fn(),
      }

      mockContext = {
        year: 2023,
        parentGeographies: {},
      }
    })

    it('calls transformApiGeographyData with correct raw API data', () => {
      const rawApiData = [
        ['NAME', 'SUMLEVEL', 'GEO_ID'],
        ['United States', '010', '0100000US'],
      ]

      const transformedData = [
        {
          name: 'United States',
          code: '010',
          description: 'United States total',
        },
      ]

      const callTracker: Array<{ data: unknown; type: string }> = []

      vi.mocked(transformApiGeographyData).mockImplementation((data, type) => {
        callTracker.push({
          data: JSON.parse(JSON.stringify(data)),
          type: type,
        })
        return transformedData
      })

      // Store original data for comparison
      const expectedRawData = [
        ['NAME', 'SUMLEVEL', 'GEO_ID'],
        ['United States', '010', '0100000US'],
      ]

      NationConfig.beforeSeed!(mockClient as Client, rawApiData, mockContext)

      expect(transformApiGeographyData).toHaveBeenCalledTimes(1)
      expect(callTracker).toHaveLength(1)
      expect(callTracker[0].type).toBe('nation')
      expect(callTracker[0].data).toEqual(expectedRawData)
    })

    it('transforms and processes data correctly end-to-end', () => {
      const rawApiData = [
        ['NAME', 'SUMLEVEL', 'GEO_ID'],
        ['United States', '010', '0100000US'],
      ]

      const transformedData = [
        {
          name: 'United States',
          code: '010',
          description: 'United States total',
        },
      ]

      vi.mocked(transformApiGeographyData).mockReturnValue(transformedData)

      NationConfig.beforeSeed!(mockClient as Client, rawApiData, mockContext)

      expect(rawApiData).toHaveLength(1)
      expect(rawApiData[0]).toEqual({
        name: 'United States',
        code: '010',
        description: 'United States total',
        for_param: 'us:*',
        in_param: null,
      })
    })

    it('verifies the complete workflow step by step', () => {
      const rawApiData = [
        ['NAME', 'SUMLEVEL', 'GEO_ID'],
        ['United States', '010', '0100000US'],
      ]

      const transformedData = [
        {
          name: 'United States',
          code: '010',
          description: 'United States total',
        },
      ]

      const callSpy = vi.fn()

      // Mock returns synchronous value (no Promise.resolve)
      vi.mocked(transformApiGeographyData).mockImplementation((data, type) => {
        callSpy(JSON.parse(JSON.stringify(data)), type)
        return transformedData // Return directly, not wrapped in Promise
      })

      NationConfig.beforeSeed!(mockClient as Client, rawApiData, mockContext)

      expect(callSpy).toHaveBeenCalledTimes(1)
      expect(callSpy).toHaveBeenCalledWith(
        [
          ['NAME', 'SUMLEVEL', 'GEO_ID'],
          ['United States', '010', '0100000US'],
        ],
        'nation',
      )
      expect(rawApiData[0]).toHaveProperty('for_param', 'us:*')
      expect(rawApiData[0]).toHaveProperty('in_param', null)
    })
  })

  describe('afterSeed', () => {
    let mockClient: Partial<Client>
    let mockContext: GeographyContext

    beforeEach(() => {
      mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        year_id: 1,
      }

      mockContext = {
        year: 2023,
        year_id: 1,
        parentGeographies: {},
      }

      vi.mocked(createGeographyYear).mockResolvedValue({ created: true })
    })

    it('should execute afterSeed logic if defined', async () => {
      const geo_ids = [1, 2, 3, 4]

      if (NationConfig.afterSeed) {
        await NationConfig.afterSeed(mockClient as Client, mockContext, geo_ids)

        expect(createGeographyYear).toHaveBeenCalledTimes(geo_ids.length)

        for (const geo_id of geo_ids) {
          expect(createGeographyYear).toHaveBeenCalledWith(
            mockClient,
            geo_id,
            mockContext.year_id,
          )
        }
      } else {
        expect(NationConfig.afterSeed).toBeUndefined()
      }
    })
  })
})
