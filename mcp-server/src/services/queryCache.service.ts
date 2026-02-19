import { DatabaseService } from './database.service.js'

export enum CacheDurationUnit {
  YEAR = 'year',
  MONTH = 'month',
  DAY = 'day',
  HOUR = 'hour',
}

export class CacheDuration {
  constructor(
    public readonly n: number,
    public readonly unit: CacheDurationUnit,
  ) {
    if (!Number.isInteger(n)) {
      throw new Error(`Expected 'n' argument to be an integer but got ${n}.`)
    }
    if (n <= 0) {
      throw new Error(
        `Expected 'n' argument to be greater than zero but got ${n}.`,
      )
    }
  }

  toString() {
    return `${this.n} ${this.unit}`
  }
}

export interface CacheQueryRequest {
  dataset: string
  group: string | null
  year: string | number
  variables: string[]
  geographySpec: string
}

export class QueryCacheService {
  private static instance: QueryCacheService
  private dbService: DatabaseService

  constructor(dbService?: DatabaseService) {
    this.dbService = dbService || DatabaseService.getInstance()
  }

  public static getInstance(): QueryCacheService {
    if (!QueryCacheService.instance) {
      QueryCacheService.instance = new QueryCacheService()
    }
    return QueryCacheService.instance
  }

  /**
   * Checks whether a query result is already in the cache and returns it if valid.
   */
  async get(params: CacheQueryRequest): Promise<string[][] | null> {
    const cacheResult = await this.dbService.query<{
      response_data: string[][]
    }>(
      `SELECT response_data 
         FROM census_data_cache 
         WHERE request_hash = public.generate_cache_hash($1, $2, $3, $4, $5)
           AND expires_at > NOW()`,
      [
        params.dataset,
        params.group,
        params.year,
        params.variables,
        params.geographySpec,
      ],
    )

    if (cacheResult.rows.length > 0) {
      return cacheResult.rows[0].response_data
    }
    return null
  }

  /**
   * Adds or updates a query result in the cache.
   */
  async set(
    params: CacheQueryRequest,
    data: string[][],
    duration: CacheDuration,
  ): Promise<void> {
    await this.dbService.query(
      `INSERT INTO census_data_cache (
           request_hash,
           dataset_code,
           year,
           variables,
           geography_spec,
           response_data,
           row_count,
           expires_at
         )
         VALUES (
           public.generate_cache_hash($1, $2, $3, $4, $5),
           $1,
           $3,
           $4,
           $5,
           $6,
           $7,
           NOW() + $8::interval
         )
         ON CONFLICT (request_hash) DO UPDATE SET
           response_data = EXCLUDED.response_data,
           row_count = EXCLUDED.row_count,
           expires_at = EXCLUDED.expires_at,
           last_accessed = NOW()`,
      [
        params.dataset,
        params.group,
        params.year,
        params.variables,
        params.geographySpec,
        JSON.stringify(data),
        data.length,
        duration.toString(),
      ],
    )
  }
}
