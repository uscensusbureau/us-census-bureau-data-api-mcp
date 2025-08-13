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

import { dbConfig } from '../../helpers/database-config'
import { GeographyLevel } from '../../../src/schema/geography-level.schema'
import { SeedConfig } from '../../../src/schema/seed-config.schema.js'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import { SummaryLevelsConfig } from '../../../src/seeds/configs/summary-levels.config'
import {
  runSeedsWithRunner,
  runSeeds,
  seeds,
} from '../../../src/seeds/scripts/seed-database'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface GeographyLevelRow extends GeographyLevel {
  id: number
  parent_summary_level_id: number | null
  created_at: Date
  updated_at: Date
}

interface MockRunner {
  connect: vi.Mock<[], Promise<void>>
  disconnect: vi.Mock<[], Promise<void>>
  seed: vi.Mock<[SeedConfig]>
}

async function createSeedRunnerSpy(mockRunner: MockRunner) {
  return vi
    .spyOn(await import('../../../src/seeds/scripts/seed-runner'), 'SeedRunner')
    .mockImplementation(() => mockRunner as MockRunner)
}

describe('Seed Database', () => {
  const testTableName = 'test_summary_levels'
  const databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  let runner: SeedRunner
  let client: Client

  beforeAll(async () => {
    // Initialize client once for the entire test suite
    client = new Client(dbConfig)
    await client.connect()

    // Construct database URL for SeedRunner

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${testTableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        description TEXT,
        get_variable VARCHAR,
        query_name VARCHAR,
        on_spine BOOLEAN,
        code VARCHAR UNIQUE NOT NULL,
        parent_summary_level VARCHAR,
        parent_summary_level_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  })

  afterAll(async () => {
    await client.query(`DROP TABLE IF EXISTS ${testTableName} CASCADE`)
    await client.end()
  })

  beforeEach(async () => {
    // Create test fixtures directory
    const fixturesPath = path.join(__dirname, 'fixtures')
    try {
      await fs.mkdir(fixturesPath, { recursive: true })
    } catch {
      console.log('Directory already exists.')
    }

    runner = new SeedRunner(databaseUrl, fixturesPath)
    await runner.connect()

    // Clean up summary_levels table before each test and handle deadlocks gracefully
    const cleanupWithRetry = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await client.query(
            `TRUNCATE TABLE ${testTableName} RESTART IDENTITY CASCADE`,
          )
          return // Success
        } catch (error: unknown) {
          if (error.code === '40P01' && attempt < maxRetries) {
            // Deadlock detected
            console.log(`Deadlock detected on attempt ${attempt}, retrying...`)
            await new Promise((resolve) => setTimeout(resolve, attempt * 100)) // Exponential backoff
          } else {
            throw error // Re-throw if not a deadlock or max retries exceeded
          }
        }
      }
    }

    await cleanupWithRetry()
  })

  afterEach(async () => {
    await runner.disconnect()
  })

  describe('main', () => {
    let originalArgv: string[]
    let processExitSpy: vi.SpyInstance
    let runSeedsMock: vi.SpyInstance

    beforeEach(() => {
      originalArgv = process.argv
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })
      runSeedsMock = vi.fn()
    })

    afterEach(() => {
      process.argv = originalArgv
      processExitSpy.mockRestore()
    })

    describe('success scenarios', () => {
      beforeEach(() => {
        runSeedsMock.mockResolvedValue()
      })

      it('should run all seeds when no seed name provided', async () => {
        process.argv = ['node', 'seed-database.js']

        const { main, seeds } = await import(
          '../../../src/seeds/scripts/seed-database'
        )
        await main(runSeedsMock)

        expect(runSeedsMock).toHaveBeenCalledTimes(1)
        expect(runSeedsMock).toHaveBeenCalledWith(
          expect.any(String), // DATABASE_URL
          seeds,
          undefined,
        )
        expect(processExitSpy).not.toHaveBeenCalled()
      })

      it('should run specific seed when seed name provided', async () => {
        process.argv = ['node', 'seed-database.js', 'summary_levels.json']

        const { main, seeds } = await import(
          '../../../src/seeds/scripts/seed-database'
        )
        await main(runSeedsMock)

        expect(runSeedsMock).toHaveBeenCalledWith(
          expect.any(String),
          seeds,
          'summary_levels.json',
        )
        expect(processExitSpy).not.toHaveBeenCalled()
      })
    })

    describe('failure scenarios', () => {
      it('should handle database connection errors', async () => {
        runSeedsMock.mockRejectedValue(new Error('Database connection failed'))

        process.argv = ['node', 'seed-database.js']

        const { main } = await import(
          '../../../src/seeds/scripts/seed-database'
        )

        await expect(main(runSeedsMock)).rejects.toThrow('process.exit called')

        expect(runSeedsMock).toHaveBeenCalledTimes(1)
        expect(processExitSpy).toHaveBeenCalledWith(1)
      })

      it('should handle seed validation errors', async () => {
        runSeedsMock.mockRejectedValue(new Error('Invalid seed configuration'))

        process.argv = ['node', 'seed-database.js', 'invalid-seed.json']

        const { main } = await import(
          '../../../src/seeds/scripts/seed-database'
        )

        await expect(main(runSeedsMock)).rejects.toThrow('process.exit called')

        expect(processExitSpy).toHaveBeenCalledWith(1)
      })

      it('should handle unknown errors gracefully', async () => {
        runSeedsMock.mockRejectedValue('Unknown error string')

        process.argv = ['node', 'seed-database.js']

        const { main } = await import(
          '../../../src/seeds/scripts/seed-database'
        )

        await expect(main(runSeedsMock)).rejects.toThrow('process.exit called')

        expect(processExitSpy).toHaveBeenCalledWith(1)
      })
    })
  })

  describe('seeds', () => {
    it('includes all configs', async () => {
      expect(seeds).toHaveLength(1)
      expect(seeds).toContain(SummaryLevelsConfig)
    })
  })

  describe('runSeeds', () => {
    it('should create and manage SeedRunner instance', async () => {
      // Mock SeedRunner to avoid database issues
      const mockRunner = {
        connect: vi.fn().mockResolvedValue(void 0),
        disconnect: vi.fn().mockResolvedValue(void 0),
        seed: vi.fn().mockResolvedValue(void 0),
      }

      // Mock the SeedRunner constructor
      const SeedRunnerSpy = await createSeedRunnerSpy(mockRunner)

      const customSeedConfigs = [
        {
          file: 'summary_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
      ]

      try {
        await runSeeds(databaseUrl, customSeedConfigs)

        // Verify SeedRunner was created with correct parameters
        expect(SeedRunnerSpy).toHaveBeenCalledWith(databaseUrl)

        // Verify the runner lifecycle
        expect(mockRunner.connect).toHaveBeenCalledOnce()
        expect(mockRunner.disconnect).toHaveBeenCalledOnce()

        // Verify seed was called with the config
        expect(mockRunner.seed).toHaveBeenCalledWith(customSeedConfigs[0])
      } finally {
        SeedRunnerSpy.mockRestore()
      }
    })

    it('should handle database connection errors', async () => {
      const mockRunner = {
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        disconnect: vi.fn().mockResolvedValue(void 0),
      }

      const SeedRunnerSpy = await createSeedRunnerSpy(mockRunner)

      const customSeedConfigs = [
        {
          file: 'summary_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
      ]

      try {
        await expect(runSeeds('bad://url', customSeedConfigs)).rejects.toThrow(
          'Connection failed',
        )

        // Verify cleanup was attempted even after error
        expect(mockRunner.disconnect).toHaveBeenCalledOnce()
      } finally {
        SeedRunnerSpy.mockRestore()
      }
    })

    it('should pass through seed filtering to runSeedsWithRunner', async () => {
      const mockRunner = {
        connect: vi.fn().mockResolvedValue(void 0),
        disconnect: vi.fn().mockResolvedValue(void 0),
        seed: vi.fn().mockResolvedValue(void 0),
      }

      const SeedRunnerSpy = await createSeedRunnerSpy(mockRunner)

      const customSeedConfigs = [
        {
          file: 'summary_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
        {
          file: 'other_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
      ]

      try {
        // Run only the specific seed
        await runSeeds(databaseUrl, customSeedConfigs, 'summary_levels.json')

        // Should only call seed once with the filtered config
        expect(mockRunner.seed).toHaveBeenCalledOnce()
        expect(mockRunner.seed).toHaveBeenCalledWith(customSeedConfigs[0])
      } finally {
        SeedRunnerSpy.mockRestore()
      }
    })

    it('should handle error during seeding and still cleanup', async () => {
      const mockRunner = {
        connect: vi.fn().mockResolvedValue(void 0),
        disconnect: vi.fn().mockResolvedValue(void 0),
        seed: vi.fn().mockRejectedValue(new Error('Seeding failed')),
      }

      const SeedRunnerSpy = await createSeedRunnerSpy(mockRunner)

      const customSeedConfigs = [
        {
          file: 'summary_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
      ]

      try {
        await expect(runSeeds(databaseUrl, customSeedConfigs)).rejects.toThrow(
          'Seeding failed',
        )

        // Verify cleanup was attempted even after seeding error
        expect(mockRunner.disconnect).toHaveBeenCalledOnce()
      } finally {
        SeedRunnerSpy.mockRestore()
      }
    })
  })

  describe('runSeedsWithRunner', () => {
    it('should run the complete seeding process with provided runner', async () => {
      // Create the expected summary_levels.json file
      const testGeographyData = {
        summary_levels: [
          {
            name: 'Nation',
            description: 'United States total',
            get_variable: 'NATION',
            query_name: 'us',
            on_spine: true,
            code: '010',
            parent_summary_level: null,
          },
          {
            name: 'State',
            description: 'States and State equivalents',
            get_variable: 'STATE',
            query_name: 'state',
            on_spine: true,
            code: '040',
            parent_summary_level: '010',
          },
        ],
      }

      const filePath = path.join(__dirname, 'fixtures', 'summary_levels.json')
      await fs.writeFile(filePath, JSON.stringify(testGeographyData))

      // Create a custom seed config that points to our fixtures directory
      const testSeedConfigs = [
        {
          file: 'summary_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
          beforeSeed: async (
            client: Client,
            rawData: unknown[],
          ): Promise<void> => {
            console.log(`Not required for this test: ${client}, ${rawData}`)
          },
          afterSeed: async (client: Client): Promise<void> => {
            await client.query(`
              UPDATE ${testTableName}
              SET parent_summary_level_id = (
                SELECT id FROM ${testTableName} parent 
                WHERE parent.code = ${testTableName}.parent_summary_level
              )
              WHERE parent_summary_level IS NOT NULL;
            `)
          },
        },
      ]

      // Test the orchestration logic using the existing runner
      await runSeedsWithRunner(runner, testSeedConfigs)

      // Verify the results
      const result = await client.query<GeographyLevelRow>(
        `SELECT * FROM ${testTableName} ORDER BY code`,
      )
      expect(result.rows).toHaveLength(2)

      const nation = result.rows.find((row) => row.code === '010')
      const state = result.rows.find((row) => row.code === '040')

      expect(nation?.name).toBe('Nation')
      expect(state?.parent_summary_level_id).toBe(nation?.id)
    })

    it('should handle specific seed file targeting', async () => {
      // Create multiple seed files
      const geographyData = {
        summary_levels: [
          {
            name: 'Nation',
            description: 'United States total',
            get_variable: 'NATION',
            query_name: 'us',
            on_spine: true,
            code: '010',
            parent_summary_level: null,
          },
        ],
      }

      const otherData = {
        summary_levels: [
          {
            name: 'State',
            description: 'States',
            get_variable: 'STATE',
            query_name: 'state',
            on_spine: true,
            code: '040',
            parent_summary_level: null,
          },
        ],
      }

      await fs.writeFile(
        path.join(__dirname, 'fixtures', 'summary_levels.json'),
        JSON.stringify(geographyData),
      )

      await fs.writeFile(
        path.join(__dirname, 'fixtures', 'other_levels.json'),
        JSON.stringify(otherData),
      )

      const testSeedConfigs = [
        {
          file: 'summary_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
        {
          file: 'other_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
      ]

      // Test seed filtering logic using the existing runner
      await runSeedsWithRunner(runner, testSeedConfigs, 'summary_levels.json')

      // Should only have the data from summary_levels.json
      const result = await client.query<GeographyLevelRow>(
        `SELECT * FROM ${testTableName}`,
      )
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Nation')
    })

    it('should throw error for non-existent seed file', async () => {
      const testSeedConfigs = [
        {
          file: 'summary_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
      ]

      await expect(
        runSeedsWithRunner(runner, testSeedConfigs, 'non_existent.json'),
      ).rejects.toThrow('Seed file "non_existent.json" not found')
    })

    it('should process multiple seeds sequentially', async () => {
      // Create multiple seed files with different data
      const firstSeedData = {
        summary_levels: [
          {
            name: 'Nation',
            description: 'United States total',
            get_variable: 'NATION',
            query_name: 'us',
            on_spine: true,
            code: '010',
            parent_summary_level: null,
          },
        ],
      }

      const secondSeedData = {
        summary_levels: [
          {
            name: 'State',
            description: 'States and State equivalents',
            get_variable: 'STATE',
            query_name: 'state',
            on_spine: true,
            code: '040',
            parent_summary_level: '010',
          },
        ],
      }

      await fs.writeFile(
        path.join(__dirname, 'fixtures', 'first_seed.json'),
        JSON.stringify(firstSeedData),
      )

      await fs.writeFile(
        path.join(__dirname, 'fixtures', 'second_seed.json'),
        JSON.stringify(secondSeedData),
      )

      const testSeedConfigs = [
        {
          file: 'first_seed.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
        {
          file: 'second_seed.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
      ]

      // Run all seeds
      await runSeedsWithRunner(runner, testSeedConfigs)

      // Should have data from both seeds
      const result = await client.query<GeographyLevelRow>(
        `SELECT * FROM ${testTableName} ORDER BY code`,
      )
      expect(result.rows).toHaveLength(2)

      const nation = result.rows.find((row) => row.code === '010')
      const state = result.rows.find((row) => row.code === '040')

      expect(nation?.name).toBe('Nation')
      expect(state?.name).toBe('State')
    })
  })
})
