import { promises as fs } from 'fs'
import path from 'path'
import { Client } from 'pg'
import { fileURLToPath } from 'url'
import { z } from 'zod'

import {
  SeedConfig,
  SeedConfigSchema,
} from '../../schema/seed-config.schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface RateLimitConfig {
  requestsPerSecond: number
  burstLimit: number
  retryAttempts: number
  retryDelay: number
}

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

  async fetchFromApi(
    url: string,
    queryParams?: Record<string, string>,
    retryCount = 0,
  ): Promise<any> {
    return this.throttleRequest(async () => {
      return this.performFetch(url, queryParams, retryCount)
    })
  }

  private async performFetch(
    url: string,
    queryParams?: Record<string, string>,
    retryCount = 0,
  ): Promise<any> {
    const urlObj = new URL(url)

    // Add query parameters
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        urlObj.searchParams.append(key, value)
      }
    }

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
        return this.performFetch(url, queryParams, retryCount + 1)
      }

      throw error
    }
  }

  // Load JSON file and extract data
  async loadData(
    source: string,
    extractPath?: string,
    isUrl: boolean = false,
    queryParams?: Record<string, string | number | boolean>,
  ): Promise<any[]> {
    let data: unknown

    if (isUrl) {
      let stringParams: Record<string, string> | undefined

      if (queryParams) {
        stringParams = {}
        for (const [key, value] of Object.entries(queryParams)) {
          stringParams[key] = String(value)
        }
      }

      // Fetch Data from the API with rate limiting
      data = await this.fetchFromApi(source, stringParams)
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
  ): Promise<void> {
    if (!data.length) return

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
      DO NOTHING
    `

    console.log(
      `Executing insert-or-skip query with conflict on: ${conflictColumn}`,
    )
    console.log(
      'Existing records will be skipped, only new records will be inserted',
    )

    await this.client.query(query, values.flat())
    console.log(
      `Processed ${data.length} records for ${tableName} (inserted new, skipped existing)`,
    )
  }

  // Batch processing for large datasets
  async insertOrSkipBatch(
    tableName: string,
    data: Record<string, any>[],
    conflictColumn: string,
    batchSize: number = 1000,
  ): Promise<void> {
    if (!data.length) return

    console.log(`Processing ${data.length} records in batches of ${batchSize}`)

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)}`,
      )

      await this.insertOrSkip(tableName, batch, conflictColumn)

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < data.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  }

  // Run a seed with optional setup/cleanup hooks
  async seed(config: unknown): Promise<void> {
    // Validate Seed Config
    const validConfig = this.validateSeedConfig(config)

    const {
      file,
      url,
      table,
      conflictColumn,
      dataPath,
      beforeSeed,
      afterSeed,
      queryParams,
    } = validConfig

    const source = file || url!
    const isUrl = !!url

    console.log(`Seeding table ${table} from ${source}.`)

    try {
      await this.client.query('BEGIN')

      // Load raw data with rate limiting if from API
      const rawData = await this.loadData(source, dataPath, isUrl, queryParams)

      if (beforeSeed) {
        // Run beforeSeed logic
        await beforeSeed(this.client, rawData)
      }

      // Use batch processing for large datasets
      if (rawData.length > 1000) {
        await this.insertOrSkipBatch(table, rawData, conflictColumn)
      } else {
        await this.insertOrSkip(table, rawData, conflictColumn)
      }

      if (afterSeed) {
        // Run afterSeed logic
        await afterSeed(this.client)
      }

      await this.client.query('COMMIT')
    } catch (error) {
      await this.client.query('ROLLBACK')
      console.error(`Seeding failed for ${table}: `, (error as Error).message)
      throw error
    }
  }

  private validateSeedConfig(config: unknown): SeedConfig {
    try {
      return SeedConfigSchema.parse(config)
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue, i) => {
          const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
          console.error(`${i + 1}. ${path}: ${issue.message}`)

          if (issue.code === 'custom' && 'params' in issue) {
            console.error(`Details: ${JSON.stringify(issue.params)}`)
          }
        })
      }
      throw new Error(
        `SeedConfig validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}

export default SeedRunner
