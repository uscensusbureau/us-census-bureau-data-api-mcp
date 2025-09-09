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
import { RegionConfig } from '../../../src/seeds/configs/region.config'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import { GeographyContext } from '../../../src/schema/seed-config.schema'
import { transformApiGeographyData } from '../../../src/schema/geography.schema'
import { createGeographyYear } from '../../../src/helpers/geography-years.helper'

describe('Region Config', () => {
  let runner: SeedRunner
  let client: Client
  let databaseUrl: string

  beforeAll(async () => {
    client = new Client(dbConfig)
    await client.connect()

    // Construct database URL for SeedRunner
    databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  })

  afterAll(async () => {
    await client.end()
  })

  beforeEach(async () => {
    // Clear the mock between tests
    vi.mocked(transformApiGeographyData).mockClear()
    vi.mocked(createGeographyYear).mockClear()

    runner = new SeedRunner(databaseUrl)
    await runner.connect()

    // Clean Up Geographies Table
    await cleanupWithRetry(client, ['geographies', 'summary_levels', 'years'])
  })

  afterEach(async () => {
    await runner.disconnect()
  })

  it('should have valid configuration structure', () => {
    const regionConfig = RegionConfig
    const context = { year: 2023 }

    expect(regionConfig).toBeDefined()
    expect(regionConfig?.table).toBe('geographies')
    expect(regionConfig?.conflictColumn).toBe('ucgid_code')
    expect(regionConfig?.url(context)).toContain('region:*')
    expect(regionConfig?.beforeSeed).toBeDefined()
    expect(regionConfig?.afterSeed).toBeDefined()
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
        [
          'NAME',
          'SUMLEVEL',
          'GEO_ID',
          'REGION',
          'INTPTLAT',
          'INTPTLON',
          'region',
        ],
        [
          'Northeast Region',
          '020',
          '0200000US1',
          '1',
          '42.7778249',
          '-74.2123732',
          '1',
        ],
      ]

      const transformedData = [
        {
          name: 'Northeast Region',
          code: '020',
          region_code: 1,
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
        [
          'NAME',
          'SUMLEVEL',
          'GEO_ID',
          'REGION',
          'INTPTLAT',
          'INTPTLON',
          'region',
        ],
        [
          'Northeast Region',
          '020',
          '0200000US1',
          '1',
          '42.7778249',
          '-74.2123732',
          '1',
        ],
      ]

      RegionConfig.beforeSeed!(mockClient as Client, rawApiData, mockContext)

      expect(transformApiGeographyData).toHaveBeenCalledTimes(1)
      expect(callTracker).toHaveLength(1)
      expect(callTracker[0].type).toBe('region')
      expect(callTracker[0].data).toEqual(expectedRawData)
    })

    it('transforms and processes data correctly end-to-end', () => {
      const rawApiData = [
        [
          'NAME',
          'SUMLEVEL',
          'GEO_ID',
          'REGION',
          'INTPTLAT',
          'INTPTLON',
          'region',
        ],
        [
          'Northeast Region',
          '020',
          '0200000US1',
          '1',
          '42.7778249',
          '-74.2123732',
          '1',
        ],
      ]

      const transformedData = [
        {
          name: 'Northeast Region',
          code: '020',
          region_code: 1,
        },
      ]

      vi.mocked(transformApiGeographyData).mockReturnValue(transformedData)

      RegionConfig.beforeSeed!(mockClient as Client, rawApiData, mockContext)

      expect(rawApiData).toHaveLength(1)
      expect(rawApiData[0]).toEqual({
        name: 'Northeast Region',
        code: '020',
        region_code: 1,
        for_param: 'region:1',
        in_param: null,
      })
    })

    it('verifies the complete workflow step by step', () => {
      const rawApiData = [
        [
          'NAME',
          'SUMLEVEL',
          'GEO_ID',
          'REGION',
          'INTPTLAT',
          'INTPTLON',
          'region',
        ],
        [
          'Northeast Region',
          '020',
          '0200000US1',
          '1',
          '42.7778249',
          '-74.2123732',
          '1',
        ],
      ]

      const transformedData = [
        {
          name: 'United States',
          code: '020',
          region_code: 1,
        },
      ]

      const callSpy = vi.fn()

      // Mock returns synchronous value (no Promise.resolve)
      vi.mocked(transformApiGeographyData).mockImplementation((data, type) => {
        callSpy(JSON.parse(JSON.stringify(data)), type)
        return transformedData // Return directly, not wrapped in Promise
      })

      RegionConfig.beforeSeed!(mockClient as Client, rawApiData, mockContext)

      expect(callSpy).toHaveBeenCalledTimes(1)
      expect(callSpy).toHaveBeenCalledWith(
        [
          [
            'NAME',
            'SUMLEVEL',
            'GEO_ID',
            'REGION',
            'INTPTLAT',
            'INTPTLON',
            'region',
          ],
          [
            'Northeast Region',
            '020',
            '0200000US1',
            '1',
            '42.7778249',
            '-74.2123732',
            '1',
          ],
        ],
        'region',
      )
      expect(rawApiData[0]).toHaveProperty('for_param', 'region:1')
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

      if (RegionConfig.afterSeed) {
        await RegionConfig.afterSeed(mockClient as Client, mockContext, geo_ids)

        expect(createGeographyYear).toHaveBeenCalledTimes(geo_ids.length)

        for (const geo_id of geo_ids) {
          expect(createGeographyYear).toHaveBeenCalledWith(
            mockClient,
            geo_id,
            mockContext.year_id,
          )
        }
      } else {
        expect(RegionConfig.afterSeed).toBeUndefined()
      }
    })
  })
})
