import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { DatabaseService } from '../../src/services/database.service.js'
import {
  QueryCacheService,
  CacheDuration,
  CacheDurationUnit,
  CacheQueryRequest,
} from '../../src/services/queryCache.service.js'

vi.mock('../../src/services/database.service.js', () => ({
  DatabaseService: {
    getInstance: vi.fn(),
  },
}))

describe('QueryCacheService', () => {
  let cacheService: QueryCacheService
  let mockDbService: {
    query: Mock
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDbService = {
      query: vi.fn(),
    }
    ;(DatabaseService.getInstance as Mock).mockReturnValue(mockDbService)

    cacheService = new QueryCacheService()
  })

  describe('get', () => {
    const params: CacheQueryRequest = {
      dataset: 'acs/acs1',
      group: 'B01001',
      year: 2022,
      variables: ['B01001_001E'],
      geographySpec: JSON.stringify({ for: 'state:01', in: null }),
    }

    it('returns data when found in cache and not expired', async () => {
      const cachedData = [
        ['NAME', 'COUNT'],
        ['Alabama', '5000000'],
      ]
      mockDbService.query.mockResolvedValueOnce({
        rows: [{ response_data: cachedData }],
      })

      const result = await cacheService.get(params)

      expect(result).toEqual(cachedData)
      expect(mockDbService.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT\s+response_data\s+FROM\s+census_data_cache/,
        ),
        [
          params.dataset,
          params.group,
          params.year,
          params.variables,
          params.geographySpec,
        ],
      )
    })

    it('returns null when not found in cache', async () => {
      mockDbService.query.mockResolvedValueOnce({ rows: [] })

      const result = await cacheService.get(params)

      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    const params: CacheQueryRequest = {
      dataset: 'acs/acs1',
      group: 'B01001',
      year: 2022,
      variables: ['B01001_001E'],
      geographySpec: JSON.stringify({ for: 'state:01', in: null }),
    }
    const data = [
      ['NAME', 'COUNT'],
      ['Alabama', '5000000'],
    ]
    const duration = new CacheDuration(1, CacheDurationUnit.YEAR)

    it('successfully inserts data into cache', async () => {
      mockDbService.query.mockResolvedValueOnce({ rowCount: 1 })

      await cacheService.set(params, data, duration)

      expect(mockDbService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO census_data_cache'),
        [
          params.dataset,
          params.group,
          params.year,
          params.variables,
          params.geographySpec,
          JSON.stringify(data),
          data.length,
          '1 year',
        ],
      )
    })
  })

  describe('getInstance', () => {
    it('returns a singleton instance', () => {
      const instance1 = QueryCacheService.getInstance()
      const instance2 = QueryCacheService.getInstance()
      expect(instance1).toBe(instance2)
      expect(instance1).toBeInstanceOf(QueryCacheService)
    })
  })
})
