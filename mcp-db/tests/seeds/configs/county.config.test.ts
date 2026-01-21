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

import { dbConfig } from '../../test-helpers/database-config'
import {
  CountyConfig,
  parentCountySQL,
} from '../../../src/seeds/configs/county.config'
import { cleanupWithRetry } from '../../test-helpers/database-cleanup'
import { normalizeSQL } from '../../test-helpers/normalize-sql'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import { GeographyContext } from '../../../src/schema/seed-config.schema'
import { transformApiGeographyData } from '../../../src/schema/geography.schema'
import { createGeographyYear } from '../../../src/helpers/geography-years.helper'

const rawApiData = [
  ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'state', 'county'],
  [
    'Delaware County, Pennsylvania',
    '050',
    '0500000US42045',
    '39.9166853',
    '-75.3988178',
    '42',
    '045',
  ],
]

const transformedData = [
  {
    name: 'Delaware County, Pennsylvania',
    summary_level_code: '050',
    ucgid_code: '0400000US42',
    state_code: '42',
    county_code: '045',
    region_code: '1',
    division_code: '2',
    latitude: '39.9166853',
    longitude: '-75.3988178',
  },
]

describe('County Config', () => {
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
    runner = new SeedRunner(databaseUrl)
    await runner.connect()

    await cleanupWithRetry(client, ['geographies', 'summary_levels', 'years'])
  })

  afterEach(async () => {
    await runner.disconnect()
    vi.mocked(transformApiGeographyData).mockClear()
    vi.mocked(createGeographyYear).mockClear()
  })

  it('should have valid configuration structure', () => {
    const countyConfig = CountyConfig
    const context = { year: 2023 }

    expect(countyConfig).toBeDefined()
    expect(countyConfig?.table).toBe('geographies')
    expect(countyConfig?.conflictColumn).toBe('ucgid_code')
    expect(countyConfig?.url(context)).toContain('county:*')
    expect(countyConfig?.beforeSeed).toBeDefined()
    expect(countyConfig?.afterSeed).toBeDefined()
  })

  describe('beforeSeed', async () => {
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

    it('calls transformApiGeographyData with correct raw API data', async () => {
      // Store original data for comparison
      const expectedRawData = [
        [
          'NAME',
          'SUMLEVEL',
          'GEO_ID',
          'INTPTLAT',
          'INTPTLON',
          'state',
          'county',
        ],
        [
          'Delaware County, Pennsylvania',
          '050',
          '0500000US42045',
          '39.9166853',
          '-75.3988178',
          '42',
          '045',
        ],
      ]

      const callTracker: Array<{ data: unknown; type: string }> = []

      vi.mocked(transformApiGeographyData).mockImplementation((data, type) => {
        callTracker.push({
          data: JSON.parse(JSON.stringify(data)),
          type: type,
        })
        return transformedData
      })

      await CountyConfig.beforeSeed!(
        mockClient as Client,
        rawApiData,
        mockContext,
      )

      expect(transformApiGeographyData).toHaveBeenCalledTimes(1)
      expect(callTracker).toHaveLength(1)

      expect(callTracker[0].type).toBe('county')
      expect(callTracker[0].data).toEqual(expectedRawData)
    })

    it('transforms and processes data correctly end-to-end', async () => {
      vi.mocked(transformApiGeographyData).mockReturnValue(transformedData)

      await CountyConfig.beforeSeed!(
        mockClient as Client,
        rawApiData,
        mockContext,
      )

      expect(rawApiData).toHaveLength(1)
      expect(rawApiData[0]).toEqual(transformedData[0])
    })

    it('verifies the complete workflow step by step', async () => {
      const callSpy = vi.fn()

      // Mock returns synchronous value (no Promise.resolve)
      vi.mocked(transformApiGeographyData).mockImplementation((data, type) => {
        callSpy(JSON.parse(JSON.stringify(data)), type)
        return transformedData // Return directly, not wrapped in Promise
      })

      await CountyConfig.beforeSeed!(
        mockClient as Client,
        rawApiData,
        mockContext,
      )

      expect(callSpy).toHaveBeenCalledTimes(1)
      expect(callSpy).toHaveBeenCalledWith([...rawApiData], 'county')
      expect(rawApiData[0]).toHaveProperty('for_param', 'county:045')
      expect(rawApiData[0]).toHaveProperty('in_param', 'state:42')
    })

    describe('when a state is missing region and division data', () => {
      it('does not throw an error', async () => {
        const callSpy = vi.fn()

        // Mock returns synchronous value (no Promise.resolve)
        vi.mocked(transformApiGeographyData).mockImplementation(
          (data, type) => {
            callSpy(JSON.parse(JSON.stringify(data)), type)
            return transformedData // Return directly, not wrapped in Promise
          },
        )

        await expect(
          CountyConfig.beforeSeed!(
            mockClient as Client,
            rawApiData,
            mockContext,
          ),
        ).resolves.not.toThrow()
      })
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

    it('should establish relationships with vintages', async () => {
      const geo_ids = [1, 2, 3, 4]

      await CountyConfig.afterSeed!(mockClient as Client, mockContext, geo_ids)

      expect(createGeographyYear).toHaveBeenCalledTimes(geo_ids.length)

      for (const geo_id of geo_ids) {
        expect(createGeographyYear).toHaveBeenCalledWith(
          mockClient,
          geo_id,
          mockContext.year_id,
        )
      }
    })

    it('should assign a parent geography', async () => {
      const geo_ids = [1, 2, 3, 4]

      await CountyConfig.afterSeed!(mockClient as Client, mockContext, geo_ids)

      // Get the SQL that was actually called
      const mockQuery = vi.mocked(mockClient.query)
      expect(mockQuery).toHaveBeenCalled()

      // Get the first argument (the SQL string) from the last call
      const actualSQL = mockQuery.mock.calls[mockQuery.mock.calls.length - 1][0]

      // Compare normalized versions
      expect(normalizeSQL(actualSQL)).toBe(normalizeSQL(parentCountySQL))
    })
  })
})
