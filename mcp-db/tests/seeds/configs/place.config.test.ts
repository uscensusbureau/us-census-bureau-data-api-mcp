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

import { dbConfig } from '../../helpers/database-config'
import {
  PlaceConfig,
  parentPlaceSQL,
} from '../../../src/seeds/configs/place.config'
import { cleanupWithRetry } from '../../helpers/database-cleanup'
import { normalizeSQL } from '../../helpers/normalize-sql'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import { GeographyContext } from '../../../src/schema/seed-config.schema'
import { transformApiGeographyData } from '../../../src/schema/geography.schema'
import { createGeographyYear } from '../../../src/helpers/geography-years.helper'

const rawApiData = [
  [
    'NAME',
    'SUMLEVEL',
    'GEO_ID',
    'STATE',
    'PLACE',
    'INTPTLAT',
    'INTPTLON',
    'state',
    'place',
  ],
  [
    'Abanda CDP, Alabama',
    '160',
    '1600000US0100100',
    '01',
    '00100',
    '33.0916268',
    '-85.5270288',
    '01',
    '00100',
  ],
]

const transformedData = [
  {
    name: 'Abanda CDP, Alabama',
    summary_level_code: '160',
    ucgid_code: '1600000US0100100',
    state_code: '01',
    region_code: '3',
    division_code: '6',
    place_code: '00100',
    latitude: '33.0916268',
    longitude: '-85.5270288',
  },
]

describe('Place Config', () => {
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
    const placeConfig = PlaceConfig
    const context = { year: 2023 }

    expect(placeConfig).toBeDefined()
    expect(placeConfig?.table).toBe('geographies')
    expect(placeConfig?.conflictColumn).toBe('ucgid_code')
    expect(placeConfig?.url(context)).toContain('for=place:*')
    expect(placeConfig?.beforeSeed).toBeDefined()
    expect(placeConfig?.afterSeed).toBeDefined()
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
          'STATE',
          'PLACE',
          'INTPTLAT',
          'INTPTLON',
          'state',
          'place',
        ],
        [
          'Abanda CDP, Alabama',
          '160',
          '1600000US0100100',
          '01',
          '00100',
          '33.0916268',
          '-85.5270288',
          '01',
          '00100',
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

      await PlaceConfig.beforeSeed!(
        mockClient as Client,
        rawApiData,
        mockContext,
      )

      expect(transformApiGeographyData).toHaveBeenCalledTimes(1)
      expect(callTracker).toHaveLength(1)

      expect(callTracker[0].type).toBe('place')
      expect(callTracker[0].data).toEqual(expectedRawData)
    })

    it('transforms and processes data correctly end-to-end', async () => {
      vi.mocked(transformApiGeographyData).mockReturnValue(transformedData)

      await PlaceConfig.beforeSeed!(
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

      await PlaceConfig.beforeSeed!(
        mockClient as Client,
        rawApiData,
        mockContext,
      )

      expect(callSpy).toHaveBeenCalledTimes(1)
      expect(callSpy).toHaveBeenCalledWith([...rawApiData], 'place')
      expect(rawApiData[0]).toHaveProperty('for_param', 'place:00100')
      expect(rawApiData[0]).toHaveProperty('in_param', 'state:01')
    })

    it('stores the states in the parentGeographies', async () => {
      const callSpy = vi.fn()

      // Mock returns synchronous value (no Promise.resolve)
      vi.mocked(transformApiGeographyData).mockImplementation((data, type) => {
        callSpy(JSON.parse(JSON.stringify(data)), type)
        return transformedData // Return directly, not wrapped in Promise
      })

      await PlaceConfig.beforeSeed!(
        mockClient as Client,
        rawApiData,
        mockContext,
      )

      expect(mockContext.parentGeographies).toHaveProperty('states')
      expect(mockContext.parentGeographies.states.length).toEqual(1)
      expect(mockContext.parentGeographies.states[0].name).toBe(
        'Abanda CDP, Alabama',
      )
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
          PlaceConfig.beforeSeed!(
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

      await PlaceConfig.afterSeed!(mockClient as Client, mockContext, geo_ids)

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

      await PlaceConfig.afterSeed!(mockClient as Client, mockContext, geo_ids)

      // Get the SQL that was actually called
      const mockQuery = vi.mocked(mockClient.query)
      expect(mockQuery).toHaveBeenCalled()

      // Get the first argument (the SQL string) from the last call
      const actualSQL = mockQuery.mock.calls[mockQuery.mock.calls.length - 1][0]

      // Compare normalized versions
      expect(normalizeSQL(actualSQL)).toBe(normalizeSQL(parentPlaceSQL))
    })
  })
})
