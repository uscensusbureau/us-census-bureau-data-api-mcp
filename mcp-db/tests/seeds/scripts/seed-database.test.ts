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
import {
  SeedConfig,
  GeographySeedConfig,
  GeographyContext,
} from '../../../src/schema/seed-config.schema.js'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import { SummaryLevelsConfig } from '../../../src/seeds/configs/summary-levels.config'
import {
  CountyConfig,
  DivisionConfig,
  NationConfig,
  RegionConfig,
  StateConfig,
  YearsConfig,
} from '../../../src/seeds/configs/index'
import {
  runSeedsWithRunner,
  runSeeds,
  runGeographySeeds,
  seeds,
  geographySeeds,
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
  seed: vi.Mock<[SeedConfig] | [GeographySeedConfig, GeographyContext]>
  getAvailableYears: vi.Mock<[], Promise<{ id: number; year: number }[]>>
}

function createMockRunner(overrides: Partial<MockRunner> = {}): MockRunner {
  return {
    connect: vi.fn().mockResolvedValue(void 0),
    disconnect: vi.fn().mockResolvedValue(void 0),
    seed: vi.fn().mockResolvedValue(void 0),
    getAvailableYears: vi.fn().mockResolvedValue([
      { year: 2020, id: 1 },
      { year: 2023, id: 2 },
    ]),
    ...overrides,
  }
}

async function setupMockSeedRunner(
  mockRunner: MockRunner = createMockRunner(),
) {
  const SeedRunnerSpy = vi
    .spyOn(await import('../../../src/seeds/scripts/seed-runner'), 'SeedRunner')
    .mockImplementation(() => mockRunner as MockRunner)

  return {
    mockRunner,
    SeedRunnerSpy,
    mockRunnerInstance:
      new (SeedRunnerSpy as typeof SeedRunner)() as SeedRunner,
  }
}

class MockRunnerManager {
  public mockRunner: MockRunner
  public SeedRunnerSpy: vi.SpyInstance
  public mockRunnerInstance: SeedRunner

  constructor(overrides: Partial<MockRunner> = {}) {
    this.mockRunner = createMockRunner(overrides)
  }

  async setup() {
    const result = await setupMockSeedRunner(this.mockRunner)
    this.SeedRunnerSpy = result.SeedRunnerSpy
    this.mockRunnerInstance = result.mockRunnerInstance
    return this
  }

  cleanup() {
    if (this.SeedRunnerSpy) {
      this.SeedRunnerSpy.mockRestore()
    }
  }

  withConnectionError(error = new Error('Connection failed')) {
    this.mockRunner.connect.mockRejectedValue(error)
    return this
  }

  withSeedError(error = new Error('Seeding failed')) {
    this.mockRunner.seed.mockRejectedValue(error)
    return this
  }

  withYearsError(error = new Error('Database query failed')) {
    this.mockRunner.getAvailableYears.mockRejectedValue(error)
    return this
  }

  withEmptyYears() {
    this.mockRunner.getAvailableYears.mockResolvedValue([])
    return this
  }

  withCustomYears(years: Array<{ year: number; id: number }>) {
    this.mockRunner.getAvailableYears.mockResolvedValue(years)
    return this
  }
}

describe('Seed Database', () => {
  const testTableName = 'test_summary_levels'
  const databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  let runner: SeedRunner
  let client: Client

  beforeAll(async () => {
    client = new Client(dbConfig)
    await client.connect()

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
    const fixturesPath = path.join(__dirname, 'fixtures')
    try {
      await fs.mkdir(fixturesPath, { recursive: true })
    } catch {
      console.log('Directory already exists.')
    }

    runner = new SeedRunner(databaseUrl, fixturesPath)
    await runner.connect()

    const cleanupWithRetry = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await client.query(
            `TRUNCATE TABLE ${testTableName} RESTART IDENTITY CASCADE`,
          )
          return
        } catch (error: unknown) {
          if (error.code === '40P01' && attempt < maxRetries) {
            console.log(`Deadlock detected on attempt ${attempt}, retrying...`)
            await new Promise((resolve) => setTimeout(resolve, attempt * 100))
          } else {
            throw error
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

        const { main } = await import(
          '../../../src/seeds/scripts/seed-database'
        )
        await main(runSeedsMock)

        expect(runSeedsMock).toHaveBeenCalledTimes(1)
        expect(runSeedsMock).toHaveBeenCalledWith(expect.any(String), undefined)
        expect(processExitSpy).not.toHaveBeenCalled()
      })

      it('should run specific seed when seed name provided', async () => {
        process.argv = ['node', 'seed-database.js', 'summary_levels.json']

        const { main } = await import(
          '../../../src/seeds/scripts/seed-database'
        )
        await main(runSeedsMock)

        expect(runSeedsMock).toHaveBeenCalledWith(
          expect.any(String),
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
    it('includes all configs', () => {
      expect(seeds).toHaveLength(2)
      expect(seeds).toContain(SummaryLevelsConfig)
      expect(seeds).toContain(YearsConfig)
    })
  })

  describe('geographySeeds', () => {
    it('includes geography configs', () => {
      expect(geographySeeds).toHaveLength(5)
      expect(geographySeeds).toContain(NationConfig)
      expect(geographySeeds).toContain(RegionConfig)
      expect(geographySeeds).toContain(DivisionConfig)
      expect(geographySeeds).toContain(StateConfig)
      expect(geographySeeds).toContain(CountyConfig)
    })
  })

  describe('runSeeds', () => {
    it('should create and manage SeedRunner instance', async () => {
      const { mockRunner, SeedRunnerSpy } = await setupMockSeedRunner()

      try {
        await runSeeds(databaseUrl)

        expect(SeedRunnerSpy).toHaveBeenCalledWith(databaseUrl)
        expect(mockRunner.connect).toHaveBeenCalledOnce()
        expect(mockRunner.disconnect).toHaveBeenCalledOnce()

        // Time for Math!
        //
        // 2 Static Configs (Year, Summary Levels) ] = 2
        // +
        // 2 Years x 5[Nation + Region + Division + State + County] = 10 Geo Configs
        // ------------
        // EQUALS 10 Total Config Runs
        expect(mockRunner.seed).toHaveBeenCalledTimes(12)
      } finally {
        SeedRunnerSpy.mockRestore()
      }
    })

    it('should handle database connection errors', async () => {
      const manager = await new MockRunnerManager()
        .withConnectionError()
        .setup()

      try {
        await expect(runSeeds('bad://url')).rejects.toThrow('Connection failed')
        expect(manager.mockRunner.disconnect).not.toHaveBeenCalled()
      } finally {
        manager.cleanup()
      }
    })

    it('should handle error during seeding and still cleanup', async () => {
      const manager = await new MockRunnerManager().withSeedError().setup()

      try {
        await expect(runSeeds(databaseUrl)).rejects.toThrow('Seeding failed')
        expect(manager.mockRunner.disconnect).toHaveBeenCalledOnce()
      } finally {
        manager.cleanup()
      }
    })

    it('should skip geography seeds when targetSeedName provided', async () => {
      const { mockRunner, SeedRunnerSpy } = await setupMockSeedRunner()

      try {
        await runSeeds(databaseUrl, 'summary_levels.json')

        // Should only call seed once for the targeted file
        expect(mockRunner.seed).toHaveBeenCalledTimes(1)
        // Should not call getAvailableYears for geography seeding
        expect(mockRunner.getAvailableYears).not.toHaveBeenCalled()
      } finally {
        SeedRunnerSpy.mockRestore()
      }
    })
  })

  describe('runSeedsWithRunner', () => {
    it('should run static seed configs', async () => {
      const { mockRunner, SeedRunnerSpy, mockRunnerInstance } =
        await setupMockSeedRunner()

      try {
        await runSeedsWithRunner(mockRunnerInstance)

        expect(mockRunner.seed).toHaveBeenCalledTimes(2)
        expect(mockRunner.seed).toHaveBeenCalledWith(
          expect.objectContaining({
            file: 'summary_levels.json',
          }),
        )
        expect(mockRunner.seed).toHaveBeenCalledWith(
          expect.objectContaining({
            file: 'years.json',
          }),
        )
      } finally {
        SeedRunnerSpy.mockRestore()
      }
    })

    it('should filter seeds by target name', async () => {
      const { mockRunner, SeedRunnerSpy, mockRunnerInstance } =
        await setupMockSeedRunner()

      try {
        await runSeedsWithRunner(mockRunnerInstance, 'summary_levels.json')

        expect(mockRunner.seed).toHaveBeenCalledTimes(1)
        expect(mockRunner.seed).toHaveBeenCalledWith(
          expect.objectContaining({
            file: 'summary_levels.json',
          }),
        )
      } finally {
        SeedRunnerSpy.mockRestore()
      }
    })

    it('should throw error for non-existent seed file', async () => {
      const { SeedRunnerSpy, mockRunnerInstance } = await setupMockSeedRunner()

      try {
        await expect(
          runSeedsWithRunner(mockRunnerInstance, 'non_existent.json'),
        ).rejects.toThrow('Seed file "non_existent.json" not found')
      } finally {
        SeedRunnerSpy.mockRestore()
      }
    })

    it('should run the complete seeding process with provided runner', async () => {
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

      const testConfigs: SeedConfig[] = [
        {
          file: 'summary_levels.json',
          table: testTableName,
          dataPath: 'summary_levels',
          conflictColumn: 'code',
        },
      ]

      const filePath = path.join(__dirname, 'fixtures', 'summary_levels.json')
      await fs.writeFile(filePath, JSON.stringify(testGeographyData))

      await runSeedsWithRunner(runner, 'summary_levels.json', testConfigs)

      const result = await client.query<GeographyLevelRow>(
        `SELECT * FROM ${testTableName} ORDER BY code`,
      )
      expect(result.rows).toHaveLength(2)

      const nation = result.rows.find((row) => row.code === '010')

      expect(nation?.name).toBe('Nation')
    })
  })

  describe('runGeographySeeds', () => {
    let mockRunnerManager: MockRunnerManager

    beforeEach(async () => {
      mockRunnerManager = await new MockRunnerManager().setup()
    })

    afterEach(() => {
      mockRunnerManager.cleanup()
    })

    it('should fetch available years and run seeds for each year', async () => {
      await runGeographySeeds(mockRunnerManager.mockRunnerInstance)

      expect(
        mockRunnerManager.mockRunner.getAvailableYears,
      ).toHaveBeenCalledOnce()
      // Should call seed for each year * each geography config (2 years * 5 configs = 10)
      expect(mockRunnerManager.mockRunner.seed).toHaveBeenCalledTimes(10)

      const seedCalls = mockRunnerManager.mockRunner.seed.mock.calls

      expect(seedCalls[0]).toEqual([
        expect.objectContaining({ table: 'geographies' }),
        expect.objectContaining({ year: 2020, year_id: 1 }),
      ])

      expect(seedCalls[5]).toEqual([
        expect.objectContaining({ table: 'geographies' }),
        expect.objectContaining({ year: 2023, year_id: 2 }),
      ])
    })

    it('should handle empty years array', async () => {
      mockRunnerManager.withEmptyYears()

      await runGeographySeeds(mockRunnerManager.mockRunnerInstance)

      expect(
        mockRunnerManager.mockRunner.getAvailableYears,
      ).toHaveBeenCalledOnce()
      expect(mockRunnerManager.mockRunner.seed).not.toHaveBeenCalled()
    })

    it('should handle errors from getAvailableYears', async () => {
      mockRunnerManager.withYearsError()

      await expect(
        runGeographySeeds(mockRunnerManager.mockRunnerInstance),
      ).rejects.toThrow('Database query failed')

      expect(
        mockRunnerManager.mockRunner.getAvailableYears,
      ).toHaveBeenCalledOnce()
      expect(mockRunnerManager.mockRunner.seed).not.toHaveBeenCalled()
    })

    it('should handle errors during individual seed operations', async () => {
      mockRunnerManager.mockRunner.seed
        .mockResolvedValueOnce(void 0)
        .mockRejectedValueOnce(new Error('Seed failed'))

      const testSeedConfigs: GeographySeedConfig[] = [
        {
          url: (context: GeographyContext) =>
            `https://api.census.gov/data/${context.year}/config1`,
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
        },
        {
          url: (context: GeographyContext) =>
            `https://api.census.gov/data/${context.year}/config2`,
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
        },
      ]

      await expect(
        runGeographySeeds(
          mockRunnerManager.mockRunnerInstance,
          testSeedConfigs,
        ),
      ).rejects.toThrow('Seed failed')

      expect(
        mockRunnerManager.mockRunner.getAvailableYears,
      ).toHaveBeenCalledOnce()
      expect(mockRunnerManager.mockRunner.seed).toHaveBeenCalledTimes(2)
    })
  })

  describe('validation functions', () => {
    it('should handle validation errors in runGeographySeeds', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Create configs that will definitely fail Zod validation
      const invalidConfigs = [
        {
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          url: 'not-a-function', // Wrong type - should be function for geography
          beforeSeed: 'not-a-function', // Wrong type
          afterSeed: 'not-a-function', // Wrong type
          extraField: 'should-fail-strict-validation',
        },
      ] as unknown[] // Use any instead of type assertion

      const { mockRunnerInstance } = await setupMockSeedRunner()

      await expect(
        runGeographySeeds(
          mockRunnerInstance,
          invalidConfigs as GeographySeedConfig[],
        ),
      ).rejects.toThrow('GeographySeedConfig validation failed')

      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    describe('validateSeedConfig', () => {
      it('should handle Zod validation errors with detailed output', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})

        // Create config that will fail Zod schema validation
        const invalidConfig = {
          // Missing required table and conflictColumn
          file: 'test.json',
          extraField: 'should-fail-validation',
          table: 123, // Wrong type - should be string
          conflictColumn: null, // Wrong type - should be string
        } as unknown

        const { mockRunnerInstance } = await setupMockSeedRunner()

        await expect(
          runSeedsWithRunner(mockRunnerInstance, undefined, [invalidConfig]),
        ).rejects.toThrow('SeedConfig validation failed')

        // Verify error logging occurred
        expect(consoleSpy).toHaveBeenCalledWith('SeedConfig validation failed:')
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('table'),
        )
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('conflictColumn'),
        )

        consoleSpy.mockRestore()
      })

      it('should handle constraint validation errors (no file or url)', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})

        // Create config that passes Zod but fails constraint validation
        const invalidConfig: SeedConfig = {
          table: 'test_table',
          conflictColumn: 'id',
          // Missing both file and url - should fail validateSeedConfigConstraints
        }

        const { mockRunnerInstance } = await setupMockSeedRunner()

        await expect(
          runSeedsWithRunner(mockRunnerInstance, undefined, [invalidConfig]),
        ).rejects.toThrow("Either 'file' or 'url' must be provided")

        consoleSpy.mockRestore()
      })

      it('should handle constraint validation errors (both file and url)', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})

        // Create config that passes Zod but fails constraint validation
        const invalidConfig: SeedConfig = {
          file: 'test.json',
          url: 'https://api.example.com/data',
          table: 'test_table',
          conflictColumn: 'id',
          // Both file and url present - should fail validateSeedConfigConstraints
        }

        const { mockRunnerInstance } = await setupMockSeedRunner()

        await expect(
          runSeedsWithRunner(mockRunnerInstance, undefined, [invalidConfig]),
        ).rejects.toThrow("Cannot specify both 'file' and 'url'")

        consoleSpy.mockRestore()
      })

      it('should handle non-Zod errors', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {})

        // Spy on the function first, then mock its implementation
        const validateSpy = vi
          .spyOn(
            await import('../../../src/schema/seed-config.schema'),
            'validateSeedConfigConstraints',
          )
          .mockImplementation(() => {
            throw new Error('Custom constraint error')
          })

        const validConfig: SeedConfig = {
          file: 'test.json',
          table: 'test_table',
          conflictColumn: 'id',
        }

        const { mockRunnerInstance } = await setupMockSeedRunner()

        await expect(
          runSeedsWithRunner(mockRunnerInstance, undefined, [validConfig]),
        ).rejects.toThrow(
          'SeedConfig validation failed: Custom constraint error',
        )

        // Restore the spy
        validateSpy.mockRestore()
        consoleSpy.mockRestore()
      })
    })
  })
})
