import { promises as fs } from 'fs'
import path from 'path'
import { Client } from 'pg'
import { fileURLToPath } from 'url'

import { GeographyRecord } from '../../schema/geography.schema'

import {
  GeographySeedConfig,
  GeographyContext,
  SeedConfig,
} from '../../schema/seed-config.schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface RateLimitConfig {
  requestsPerSecond: number
  burstLimit: number
  retryAttempts: number
  retryDelay: number
}

type StaticBeforeSeed = (
  client: Client,
  rawData: unknown[],
) => void | Promise<void>
type StaticAfterSeed = (client: Client) => void | Promise<void>

export class SeedRunner {
  private client: Client
  private dataPath: string
  private rateLimitConfig: RateLimitConfig
  private requestQueue: Array<() => Promise<any>> = []
  private activeRequests = 0
  private lastRequestTime = 0

  constructor(
    dbUrl: string,
    dataPath?: string,
    rateLimitConfig?: Partial<RateLimitConfig>,
  ) {
    this.client = new Client({ connectionString: dbUrl })
    // Only use __dirname as fallback if no dataPath provided
    const defaultPath = path.join(__dirname, '../../../data')
    this.dataPath = dataPath || defaultPath

    // Default rate limiting configuration
    this.rateLimitConfig = {
      requestsPerSecond: 10, // Max 10 requests per second
      burstLimit: 5, // Allow burst of 5 requests
      retryAttempts: 3, // Retry failed requests 3 times
      retryDelay: 1000, // 1 second delay between retries
      ...rateLimitConfig,
    }
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    // Wait for all queued requests to complete
    await this.waitForQueueToEmpty()
    await this.client.end()
  }

  async getAvailableYears(): Promise<{ id: number; year: number }[]> {
    const result = await this.client.query(
      'SELECT id, year FROM years ORDER BY year',
    )
    return result.rows.map((row) => ({
      id: parseInt(row.id, 10),
      year: parseInt(row.year, 10),
    }))
  }

  getStateCodesForYear(context: GeographyContext, year: number): string[] {
    if (context?.parentGeographies?.[year]?.states) {
      console.log(`Using state data from parentGeographies for year ${year}`)
      const stateCodes = context.parentGeographies[year].states
        .map((state: GeographyRecord) => state.state_code)
        .filter((code): code is string => code != null)
        .map((code: string) => String(code).padStart(2, '0')) // Ensure 2-digit format
        .sort()

      if (stateCodes.length > 0) {
        console.log(
          `Found ${stateCodes.length} states in parentGeographies for year ${year}`,
        )
        console.log(`States for ${year}: ${stateCodes.join(', ')}`)
        return stateCodes
      }
    }

    throw Error(`No states found in context of year ${year}`)
  }

  private async waitForQueueToEmpty(): Promise<void> {
    while (this.requestQueue.length > 0 || this.activeRequests > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  private async throttleRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (
      this.requestQueue.length === 0 ||
      this.activeRequests >= this.rateLimitConfig.burstLimit
    ) {
      return
    }

    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const minInterval = 1000 / this.rateLimitConfig.requestsPerSecond

    if (timeSinceLastRequest < minInterval) {
      // Wait before processing next request
      setTimeout(() => this.processQueue(), minInterval - timeSinceLastRequest)
      return
    }

    const requestFn = this.requestQueue.shift()
    if (!requestFn) return

    this.activeRequests++
    this.lastRequestTime = now

    try {
      await requestFn()
    } catch (error) {
      console.error('Request failed:', error)
    } finally {
      this.activeRequests--
      // Process next request after a brief delay
      setTimeout(() => this.processQueue(), 10)
    }
  }

  async fetchFromApi(url: string, retryCount = 0): Promise<any> {
    return this.throttleRequest(async () => {
      return this.performFetch(url, retryCount)
    })
  }

  private async performFetch(url: string, retryCount = 0): Promise<any> {
    const urlObj = new URL(url)

    console.log(`Making API request to: ${urlObj.toString()}`)

    try {
      const response = await fetch(urlObj.toString())

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        )
      }

      return response.json()
    } catch (error) {
      if (retryCount < this.rateLimitConfig.retryAttempts) {
        console.warn(
          `Request failed, retrying in ${this.rateLimitConfig.retryDelay}ms (attempt ${retryCount + 1}/${this.rateLimitConfig.retryAttempts})`,
        )

        await new Promise((resolve) =>
          setTimeout(
            resolve,
            this.rateLimitConfig.retryDelay * (retryCount + 1),
          ),
        )

        // Retry with the same throttled request - no new throttling
        return this.performFetch(url, retryCount + 1)
      }

      throw error
    }
  }

  // Check if an API endpoint has been called before
  async hasApiBeenCalled(url: string): Promise<boolean> {
    await this.ensureApiCallLogTable();
    const query = `SELECT 1 FROM api_call_log WHERE url = '${url}' LIMIT 1`;
    const res = await this.client.query(query);
  return (res.rowCount ?? 0) > 0;
  }

  // Record an API call in the log
  async recordApiCall(url: string): Promise<void> {
    await this.ensureApiCallLogTable();
    const query = `INSERT INTO api_call_log (url, last_called) VALUES ('${url}', NOW())
      ON CONFLICT (url) DO UPDATE SET last_called = NOW();`;

    await this.client.query(query);
  }

  // Ensure the api_call_log table exists
  private async ensureApiCallLogTable(): Promise<void> {
    const createTableQuery = `CREATE TABLE IF NOT EXISTS api_call_log (
      url TEXT PRIMARY KEY,
      last_called TIMESTAMP
    )`;

    await this.client.query(createTableQuery);
  }

  // Load JSON file and extract data
  async loadData(
    source: string,
    extractPath?: string,
    isUrl: boolean = false,
  ): Promise<any[]> {
    let data: unknown

    if (isUrl) {
      // Check if this API endpoint has been called before
      const alreadyCalled = await this.hasApiBeenCalled(source);
      if (alreadyCalled) {
        console.log(`API endpoint ${source} has already been called. Skipping fetch.`);
        return []; // Return empty array to skip processing
      }
      // Fetch Data from the API with rate limiting
      data = await this.fetchFromApi(source);
      // Record the API call
      await this.recordApiCall(source);
    } else {
      // Use the filepath
      const filePath = path.join(this.dataPath, source)
      const content = await fs.readFile(filePath, 'utf8')
      data = JSON.parse(content)
    }

    // Extract nested data if needed
    if (extractPath) {
      const keys = extractPath.split('.')
      data = keys.reduce((currentData, key) => {
        if (
          currentData &&
          typeof currentData === 'object' &&
          key in currentData
        ) {
          return (currentData as Record<string, unknown>)[key]
        }
        throw new Error(`Key "${key}" not found in data from ${source}`)
      }, data)
    }

    if (!Array.isArray(data)) {
      throw new Error(`Expected array data from ${source}, got ${typeof data}`)
    }

    return data
  }

  // Insert with skip-on-conflict behavior
  async insertOrSkip(
    tableName: string,
    data: Record<string, any>[],
    conflictColumn: string,
  ): Promise<number[]> {
    if (!data.length) return []

    const columns = Object.keys(data[0])

    // Validate that conflict column exists in data
    if (!columns.includes(conflictColumn)) {
      throw new Error(
        `Conflict column '${conflictColumn}' not found in data. Available columns: ${columns.join(', ')}`,
      )
    }

    const values = data.map((record) => columns.map((col) => record[col]))

    // Build parameterized query
    const placeholders = values
      .map(
        (_, i) =>
          `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`,
      )
      .join(', ')

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT (${conflictColumn})
      DO UPDATE SET ${conflictColumn} = ${tableName}.${conflictColumn}
      RETURNING id
    `

    console.log(
      `Executing insert-or-skip query with conflict on: ${conflictColumn}`,
    )
    console.log(
      'Existing records will be skipped, only new records will be inserted',
    )

    const result = await this.client.query(query, values.flat())
    console.log(
      `Processed ${data.length} records for ${tableName} (inserted new, skipped existing)`,
    )

    return result.rows.map((row) => row.id)
  }

  // Batch processing for large datasets
  async insertOrSkipBatch(
    tableName: string,
    data: Record<string, any>[],
    conflictColumn: string,
    batchSize: number = 1000,
  ): Promise<number[]> {
    if (!data.length) return []

    console.log(`Processing ${data.length} records in batches of ${batchSize}`)

    const allInsertedIds: number[] = []

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)}`,
      )

      const batchIds = await this.insertOrSkip(tableName, batch, conflictColumn)
      allInsertedIds.push(...batchIds)

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < data.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return allInsertedIds
  }

  async seed(config: SeedConfig): Promise<void>
  async seed(
    config: GeographySeedConfig,
    context: GeographyContext,
  ): Promise<void>
  async seed(
    config: SeedConfig | GeographySeedConfig,
    context?: GeographyContext,
  ): Promise<void> {
    if (context && !('url' in config)) {
      console.warn('Context provided but config does not use dynamic URLs')
    }

    const url =
      typeof config.url === 'function'
        ? context
          ? config.url(context)
          : undefined
        : config.url

    const source = config.file || url!
    const isUrl = !!url

    console.log(`Seeding table ${config.table} from ${source}.`)

    try {
      await this.client.query('BEGIN')

      // Load raw data with rate limiting if from API
      const rawData = await this.loadData(source, config.dataPath, isUrl)
      if (rawData.length === 0) {
        console.log(`No new data to process for ${config.table}. Skipping seeding.`)

        return;
      }
      if (config.beforeSeed) {
        if (context) {
          // Pass context to beforeSeed
          await config.beforeSeed(this.client, rawData, context)
        } else {
          await (config.beforeSeed as StaticBeforeSeed)(this.client, rawData)
        }
      }

      let insertedIds: number[] = []

      // Use batch processing for large datasets
      if (rawData.length > 1000) {
        insertedIds = await this.insertOrSkipBatch(
          config.table,
          rawData,
          config.conflictColumn,
        )
      } else {
        insertedIds = await this.insertOrSkip(
          config.table,
          rawData,
          config.conflictColumn,
        )
      }

      if (config.afterSeed) {
        if (context) {
          await config.afterSeed(this.client, context, insertedIds)
        } else {
          await (config.afterSeed as StaticAfterSeed)(this.client)
        }
      }

      await this.client.query('COMMIT')
    } catch (error) {
      await this.client.query('ROLLBACK')
      console.error(
        `Seeding failed for ${config.table}: `,
        (error as Error).message,
      )
      throw error
    }
  }
}

export default SeedRunner
