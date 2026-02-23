import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  vi,
  beforeAll,
} from 'vitest'
import fetch from 'node-fetch'

import { FetchAggregateDataTool } from '../../../src/tools/fetch-aggregate-data.tool'
import { DatabaseService } from '../../../src/services/database.service.js'
import { QueryCacheService } from '../../../src/services/queryCache.service.js'

// Mock node-fetch but keep its actual implementation in order to assert against its call args
// while still making real network requests.
vi.mock('node-fetch', async () => {
  const actual =
    await vi.importActual<typeof import('node-fetch')>('node-fetch')
  return {
    ...actual,
    default: vi.fn(actual.default),
  }
})

describe('FetchAggregateDataTool - Integration Tests', () => {
  let databaseService: DatabaseService
  let apiKey: string | undefined

  beforeAll(async () => {
    apiKey = process.env.CENSUS_API_KEY
    // Reset the DatabaseService singleton instances
    ;(
      DatabaseService as typeof DatabaseService & { instance: unknown }
    ).instance = undefined
    ;(
      QueryCacheService as typeof QueryCacheService & { instance: unknown }
    ).instance = undefined

    databaseService = DatabaseService.getInstance()
  })

  beforeEach(async () => {
    // Ensure cache is cleared before each test to force API calls.
    // Use the existing cleanup_expired_cache() database function after expiring entries.
    await databaseService.query(
      "UPDATE census_data_cache SET expires_at = NOW() - INTERVAL '1 second'",
    )
    await databaseService.query('SELECT public.cleanup_expired_cache()')

    // Clear the fetch spy between tests
    vi.mocked(fetch).mockClear()
  })

  afterAll(async () => {
    if (databaseService) {
      await databaseService.cleanup()
    }
    vi.restoreAllMocks()
  })

  it('should fetch real ACS data and then retrieve it from cache', async () => {
    const tool = new FetchAggregateDataTool()
    const datasetName = 'acs/acs1'
    const year = 2022
    const groupName = 'B17015'
    const args = {
      dataset: datasetName,
      year,
      get: {
        group: groupName,
      },
      for: 'state:*',
    }

    // First call should hit the web API
    const firstResponse = await tool.toolHandler(args, apiKey)
    expect(firstResponse.content[0].type).toBe('text')

    // Verify web API was called
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('api.census.gov')

    // Wait for the asynchronous cache save to complete (it's not awaited in toolHandler)
    let cached = false
    for (let i = 0; i < 20; i++) {
      const result = await databaseService.query(
        'SELECT 1 FROM census_data_cache WHERE dataset_code = $1 AND year = $2',
        [datasetName, year],
      )
      if (result.rows.length > 0) {
        cached = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    expect(cached).toBe(true)

    // Reset fetch spy for second call
    vi.mocked(fetch).mockClear()

    // Second call: should hit the cache
    const secondResponse = await tool.toolHandler(args, apiKey)
    expect(secondResponse.content[0].text).toBe(firstResponse.content[0].text)

    // Verify fetch was NOT called
    expect(fetch).not.toHaveBeenCalled()
  }, 60000)

  it('should fetch real ACS data with complex geography definitions', async () => {
    const tool = new FetchAggregateDataTool()
    const datasetName = 'acs/acs5'
    const groupName = 'B15003'

    const response = await tool.toolHandler(
      {
        dataset: datasetName,
        year: 2022,
        get: {
          group: groupName,
        },
        for: 'tract:*',
        in: 'state:17+county:031',
      },
      apiKey,
    )

    expect(response.content[0].type).toBe('text')
    const responseText = response.content[0].text
    expect(responseText).toContain(`${datasetName}`)
    expect(responseText).toContain(`${groupName}`)
    expect(fetch).toHaveBeenCalled()
  }, 15000) // Longer timeout for real API calls
})
