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

import { cleanupWithRetry } from '../../test-helpers/database-cleanup'
import { dbConfig } from '../../test-helpers/database-config'
import { ZipCodeTabulationAreaConfig } from '../../../src/seeds/configs/zip-code-tabulation-area.config'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import { GeographyContext } from '../../../src/schema/seed-config.schema'
import { transformApiGeographyData } from '../../../src/schema/geography.schema'
import { createGeographyYear } from '../../../src/helpers/geography-years.helper'

describe('Zip Code Tabulation Area Config', () => {
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
    const zipCodeTabulationAreaConfig = ZipCodeTabulationAreaConfig
    const context = { year: 2023 }

    expect(zipCodeTabulationAreaConfig).toBeDefined()
    expect(zipCodeTabulationAreaConfig?.table).toBe('geographies')
    expect(zipCodeTabulationAreaConfig?.conflictColumn).toBe('ucgid_code')
    expect(zipCodeTabulationAreaConfig?.url(context)).toContain(
      'zip%20code%20tabulation%20area:*',
    )
    expect(zipCodeTabulationAreaConfig?.beforeSeed).toBeDefined()
    expect(zipCodeTabulationAreaConfig?.afterSeed).toBeDefined()
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
        ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'ZCTA'],
        [
          'ZCTA5 00601',
          '860',
          '8600000US00601',
          '18.18055550',
          '-66.74996150',
          '00601',
        ],
      ]

      const transformedData = [
        {
          name: 'ZCTA5 00601',
          code: '860',
          zip_code_tabulation_area: '00601',
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
        ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'ZCTA'],
        [
          'ZCTA5 00601',
          '860',
          '8600000US00601',
          '18.18055550',
          '-66.74996150',
          '00601',
        ],
      ]

      ZipCodeTabulationAreaConfig.beforeSeed!(
        mockClient as Client,
        rawApiData,
        mockContext,
      )

      expect(transformApiGeographyData).toHaveBeenCalledTimes(1)
      expect(callTracker).toHaveLength(1)
      expect(callTracker[0].type).toBe('zip_code_tabulation_area')
      expect(callTracker[0].data).toEqual(expectedRawData)
    })

    it('transforms and processes data correctly end-to-end', () => {
      const rawApiData = [
        ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'ZCTA'],
        [
          'ZCTA5 00601',
          '860',
          '8600000US00601',
          '18.18055550',
          '-66.74996150',
          '00601',
        ],
      ]

      const transformedData = [
        {
          name: 'ZCTA5 00601',
          code: '860',
          zip_code_tabulation_area: '00601',
        },
      ]

      vi.mocked(transformApiGeographyData).mockReturnValue(transformedData)

      ZipCodeTabulationAreaConfig.beforeSeed!(
        mockClient as Client,
        rawApiData,
        mockContext,
      )

      expect(rawApiData).toHaveLength(1)
      expect(rawApiData[0]).toEqual({
        name: 'ZCTA5 00601',
        code: '860',
        zip_code_tabulation_area: '00601',
        for_param: 'zip%20code%20tabulation%20area:00601',
        in_param: null,
      })
    })

    it('verifies the complete workflow step by step', () => {
      const rawApiData = [
        ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'ZCTA'],
        [
          'ZCTA5 00601',
          '860',
          '8600000US00601',
          '18.18055550',
          '-66.74996150',
          '00601',
        ],
      ]

      const transformedData = [
        {
          name: 'ZCTA5 00601',
          code: '860',
          zip_code_tabulation_area: '00601',
        },
      ]

      const callSpy = vi.fn()

      // Mock returns synchronous value (no Promise.resolve)
      vi.mocked(transformApiGeographyData).mockImplementation((data, type) => {
        callSpy(JSON.parse(JSON.stringify(data)), type)
        return transformedData // Return directly, not wrapped in Promise
      })

      ZipCodeTabulationAreaConfig.beforeSeed!(
        mockClient as Client,
        rawApiData,
        mockContext,
      )

      expect(callSpy).toHaveBeenCalledTimes(1)
      expect(callSpy).toHaveBeenCalledWith(
        [
          ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'ZCTA'],
          [
            'ZCTA5 00601',
            '860',
            '8600000US00601',
            '18.18055550',
            '-66.74996150',
            '00601',
          ],
        ],
        'zip_code_tabulation_area',
      )
      expect(rawApiData[0]).toHaveProperty(
        'for_param',
        'zip%20code%20tabulation%20area:00601',
      )
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

      if (ZipCodeTabulationAreaConfig.afterSeed) {
        await ZipCodeTabulationAreaConfig.afterSeed(
          mockClient as Client,
          mockContext,
          geo_ids,
        )

        expect(createGeographyYear).toHaveBeenCalledTimes(geo_ids.length)

        for (const geo_id of geo_ids) {
          expect(createGeographyYear).toHaveBeenCalledWith(
            mockClient,
            geo_id,
            mockContext.year_id,
          )
        }
      } else {
        expect(ZipCodeTabulationAreaConfig.afterSeed).toBeUndefined()
      }
    })
  })
})
