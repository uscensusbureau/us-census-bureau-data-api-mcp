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

import { dbConfig } from '../../test-helpers/database-config'
import {
  SeedConfig,
  GeographySeedConfig,
  GeographyContext,
  MultiStateGeographySeedConfig,
  EnhancedGeographySeedConfig,
} from '../../../src/schema/seed-config.schema.js'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import * as configs from '../../../src/seeds/configs/index'
import {
  geographySeeds,
  runSeedsWithRunner,
  runSeeds,
  runGeographySeeds,
  seeds,
  validateGeographyContext,
  zodErrorHandling,
} from '../../../src/seeds/scripts/seed-database'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface SummaryLevelRow {
  id: number
  name: string
  description: string | null
  get_variable: string
  query_name: string
  on_spine: boolean
  code: string
  parent_summary_level: string | null
  parent_summary_level_id: number | null
  created_at: Date
  updated_at: Date
}

type MockedSeedRunnerMethods = Pick<
  SeedRunner,
  | 'connect'
  | 'disconnect'
  | 'seed'
  | 'getAvailableYears'
  | 'getStateCodesForYear'
>

type MockSeedRunner = {
  [K in keyof MockedSeedRunnerMethods]: ReturnType<typeof vi.fn> &
    MockedSeedRunnerMethods[K]
}

function createMockRunner(
  overrides: Partial<MockSeedRunner> = {},
): MockSeedRunner {
  return {
    connect: vi.fn().mockResolvedValue(void 0),
    disconnect: vi.fn().mockResolvedValue(void 0),
    seed: vi.fn().mockResolvedValue(void 0),
    getAvailableYears: vi.fn().mockResolvedValue([
      { year: 2020, id: 1 },
      { year: 2023, id: 2 },
    ]),
    getStateCodesForYear: vi.fn().mockResolvedValue(['01', '42']),
    ...overrides,
  }
}

async function setupMockSeedRunner(
  mockRunner: MockSeedRunner = createMockRunner(),
) {
  const SeedRunnerSpy = vi
    .spyOn(await import('../../../src/seeds/scripts/seed-runner'), 'SeedRunner')
    .mockImplementation(() => mockRunner as unknown as SeedRunner)

  return {
    mockRunner,
    SeedRunnerSpy,
    mockRunnerInstance: mockRunner as unknown as SeedRunner,
  }
}

class MockRunnerManager {
  public mockRunner: MockSeedRunner
  public SeedRunnerSpy!: vi.SpyInstance
  public mockRunnerInstance!: SeedRunner

  constructor(overrides: Partial<MockSeedRunner> = {}) {
    const baseRunner = createMockRunner()
    this.mockRunner = { ...baseRunner, ...overrides } as MockSeedRunner
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
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === '40P01' &&
            attempt < maxRetries
          ) {
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
    it('includes all non-geography configs', () => {
      expect(seeds).toHaveLength(4)
      expect(seeds).toContain(configs.SummaryLevelsConfig)
      expect(seeds).toContain(configs.YearsConfig)
      expect(seeds).toContain(configs.TopicsConfig)
      expect(seeds).toContain(configs.DatasetConfig)
    })
  })

  describe('geographySeeds', () => {
    it('includes geography configs', () => {
      expect(geographySeeds()).toHaveLength(8)
      expect(geographySeeds()).toContain(configs.NationConfig)
      expect(geographySeeds()).toContain(configs.RegionConfig)
      expect(geographySeeds()).toContain(configs.DivisionConfig)
      expect(geographySeeds()).toContain(configs.StateConfig)
      expect(geographySeeds()).toContain(configs.CountyConfig)
      expect(geographySeeds()).toContain(configs.CountySubdivisionConfig)
      expect(geographySeeds()).toContain(configs.PlaceConfig)
      expect(geographySeeds()).toContain(configs.ZipCodeTabulationAreaConfig)
    })

    it('does not include time intensive configs when set to slim', () => {
      process.env.SEED_MODE = 'slim'
      expect(geographySeeds).not.toContain(configs.CountySubdivisionConfig)
      expect(geographySeeds).not.toContain(configs.PlaceConfig)
      expect(geographySeeds).not.toContain(configs.ZipCodeTabulationAreaConfig)
      delete process.env.SEED_MODE
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
        // 4 Static Configs (Year, Summary Levels, DatasetConfig, TopicsConfig) ] = 4
        // +
        // 2 Years x 7 Std Geo Configs[Nation + Region + Division + State + County + Place + ZCTA ] = 14 Runs
        // +
        // 2 years x 2 Mocked States x 1 MultiStateConfig[CountySubdivisionConfig] = 4 State-specific Runs
        // ------------
        // EQUALS 22 Total Config Runs
        expect(mockRunner.seed).toHaveBeenCalledTimes(22)
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
    it('should run seed configs', async () => {
      const { mockRunner, SeedRunnerSpy, mockRunnerInstance } =
        await setupMockSeedRunner()

      try {
        await runSeedsWithRunner(mockRunnerInstance)

        // Non-GEO Configs
        expect(mockRunner.seed).toHaveBeenCalledTimes(4)
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

        expect(mockRunner.seed).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://api.census.gov/data/',
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

      const result = await client.query<SummaryLevelRow>(
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

    describe('when the config is a MultiStateConfig', () => {
      let mockRunnerManager: MockRunnerManager
      let validateGeographySeedConfigSpy: vi.SpyInstance

      beforeEach(async () => {
        mockRunnerManager = await new MockRunnerManager().setup()

        // Mock getStateCodesForYear to return test state codes
        mockRunnerManager.mockRunner.getStateCodesForYear = vi
          .fn()
          .mockReturnValue(['06', '48', '36'])

        // Mock the validation function to allow our test configs
        validateGeographySeedConfigSpy = vi
          .spyOn(
            await import('../../../src/seeds/scripts/seed-database'),
            'validateGeographySeedConfig',
          )
          .mockImplementation(() => {}) // No-op, allows any config
      })

      afterEach(() => {
        mockRunnerManager.cleanup()
        validateGeographySeedConfigSpy?.mockRestore()
      })

      it('fetches the State codes from the context', async () => {
        const multiStateConfig: MultiStateGeographySeedConfig = {
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          urlGenerator: (context: GeographyContext, stateCode: string) =>
            `https://api.census.gov/data/${context.year}/acs/acs5?get=NAME,GEO_ID&for=county:*&in=state:${stateCode}`,
          requiresStateIteration: true,
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
        }

        // Mock isMultiStateConfig to return true for our test config
        const isMultiStateConfigSpy = vi
          .spyOn(
            await import('../../../src/schema/seed-config.schema'),
            'isMultiStateConfig',
          )
          .mockReturnValue(true)

        try {
          await runGeographySeeds(mockRunnerManager.mockRunnerInstance, [
            multiStateConfig,
          ])

          // Verify getStateCodesForYear was called for each year
          expect(
            mockRunnerManager.mockRunner.getStateCodesForYear,
          ).toHaveBeenCalledTimes(2) // 2 years
          expect(
            mockRunnerManager.mockRunner.getStateCodesForYear,
          ).toHaveBeenCalledWith(
            expect.objectContaining({ year: 2020, year_id: 1 }),
            2020,
          )
          expect(
            mockRunnerManager.mockRunner.getStateCodesForYear,
          ).toHaveBeenCalledWith(
            expect.objectContaining({ year: 2023, year_id: 2 }),
            2023,
          )
        } finally {
          isMultiStateConfigSpy.mockRestore()
        }
      })

      it('iterates over each state and runs the config', async () => {
        const multiStateConfig: MultiStateGeographySeedConfig = {
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          urlGenerator: (context: GeographyContext, stateCode: string) =>
            `https://api.census.gov/data/${context.year}/acs/acs5?get=NAME,GEO_ID&for=county:*&in=state:${stateCode}`,
          requiresStateIteration: true,
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
        }

        // Mock isMultiStateConfig to return true for our test config
        const isMultiStateConfigSpy = vi
          .spyOn(
            await import('../../../src/schema/seed-config.schema'),
            'isMultiStateConfig',
          )
          .mockReturnValue(true)

        try {
          await runGeographySeeds(mockRunnerManager.mockRunnerInstance, [
            multiStateConfig,
          ])

          // Should call seed for each year * each state
          // 2 years * 3 states = 6 total calls
          expect(mockRunnerManager.mockRunner.seed).toHaveBeenCalledTimes(6)

          // Verify each call has the correct structure
          const seedCalls = mockRunnerManager.mockRunner.seed.mock.calls

          // First year (2020) calls
          expect(seedCalls[0]).toEqual([
            expect.objectContaining({
              table: 'geographies',
              conflictColumn: 'ucgid_code',
              url: expect.any(Function),
            }),
            expect.objectContaining({ year: 2020, year_id: 1 }),
          ])

          // Verify the URL function works correctly
          const firstCallConfig = seedCalls[0][0] as GeographySeedConfig
          const firstCallContext = seedCalls[0][1] as GeographyContext
          const generatedUrl = firstCallConfig.url!(firstCallContext)
          expect(generatedUrl).toBe(
            'https://api.census.gov/data/2020/acs/acs5?get=NAME,GEO_ID&for=county:*&in=state:06',
          )

          // Check a few more calls to ensure state codes are being used correctly
          const secondCallConfig = seedCalls[1][0] as GeographySeedConfig
          const secondCallContext = seedCalls[1][1] as GeographyContext
          expect(secondCallConfig.url!(secondCallContext)).toBe(
            'https://api.census.gov/data/2020/acs/acs5?get=NAME,GEO_ID&for=county:*&in=state:48',
          )

          const thirdCallConfig = seedCalls[2][0] as GeographySeedConfig
          const thirdCallContext = seedCalls[2][1] as GeographyContext
          expect(thirdCallConfig.url!(thirdCallContext)).toBe(
            'https://api.census.gov/data/2020/acs/acs5?get=NAME,GEO_ID&for=county:*&in=state:36',
          )

          // Second year (2023) calls should start at index 3
          const fourthCallConfig = seedCalls[3][0] as GeographySeedConfig
          const fourthCallContext = seedCalls[3][1] as GeographyContext
          expect(fourthCallConfig.url!(fourthCallContext)).toBe(
            'https://api.census.gov/data/2023/acs/acs5?get=NAME,GEO_ID&for=county:*&in=state:06',
          )
        } finally {
          isMultiStateConfigSpy.mockRestore()
        }
      })

      it('handles errors from getStateCodesForYear', async () => {
        const multiStateConfig: MultiStateGeographySeedConfig = {
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          urlGenerator: (context: GeographyContext, stateCode: string) =>
            `https://api.census.gov/data/${context.year}/acs/acs5?get=NAME,GEO_ID&for=county:*&in=state:${stateCode}`,
          requiresStateIteration: true,
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
        }

        // Mock getStateCodesForYear to throw an error
        mockRunnerManager.mockRunner.getStateCodesForYear = vi
          .fn()
          .mockRejectedValue(
            new Error('No states found in context of year 2020'),
          )

        const isMultiStateConfigSpy = vi
          .spyOn(
            await import('../../../src/schema/seed-config.schema'),
            'isMultiStateConfig',
          )
          .mockReturnValue(true)

        try {
          await expect(
            runGeographySeeds(mockRunnerManager.mockRunnerInstance, [
              multiStateConfig,
            ]),
          ).rejects.toThrow('No states found in context of year 2020')

          // Should have attempted to get state codes but failed
          expect(
            mockRunnerManager.mockRunner.getStateCodesForYear,
          ).toHaveBeenCalledTimes(1)
          expect(mockRunnerManager.mockRunner.seed).not.toHaveBeenCalled()
        } finally {
          isMultiStateConfigSpy.mockRestore()
        }
      })

      it('handles empty state codes array', async () => {
        const multiStateConfig: MultiStateGeographySeedConfig = {
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          urlGenerator: (context: GeographyContext, stateCode: string) =>
            `https://api.census.gov/data/${context.year}/acs/acs5?get=NAME,GEO_ID&for=county:*&in=state:${stateCode}`,
          requiresStateIteration: true,
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
        }

        // Mock getStateCodesForYear to return empty array
        mockRunnerManager.mockRunner.getStateCodesForYear = vi
          .fn()
          .mockResolvedValue([])

        const isMultiStateConfigSpy = vi
          .spyOn(
            await import('../../../src/schema/seed-config.schema'),
            'isMultiStateConfig',
          )
          .mockReturnValue(true)

        try {
          await runGeographySeeds(mockRunnerManager.mockRunnerInstance, [
            multiStateConfig,
          ])

          // Should have called getStateCodesForYear but not seed
          expect(
            mockRunnerManager.mockRunner.getStateCodesForYear,
          ).toHaveBeenCalledTimes(2) // 2 years
          expect(mockRunnerManager.mockRunner.seed).not.toHaveBeenCalled()
        } finally {
          isMultiStateConfigSpy.mockRestore()
        }
      })

      it('handles mixed config types (multi-state and regular)', async () => {
        const multiStateConfig: MultiStateGeographySeedConfig = {
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          urlGenerator: (context: GeographyContext, stateCode: string) =>
            `https://api.census.gov/data/${context.year}/counties?state=${stateCode}`,
          requiresStateIteration: true,
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
        }

        const regularConfig: GeographySeedConfig = {
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          url: (context: GeographyContext) =>
            `https://api.census.gov/data/${context.year}/states`,
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
        }

        const isMultiStateConfigSpy = vi
          .spyOn(
            await import('../../../src/schema/seed-config.schema'),
            'isMultiStateConfig',
          )
          .mockImplementation((config) => {
            return (
              'urlGenerator' in config &&
              typeof config.urlGenerator === 'function'
            )
          })

        try {
          await runGeographySeeds(mockRunnerManager.mockRunnerInstance, [
            multiStateConfig,
            regularConfig,
          ])

          // Multi-state config: 2 years * 3 states = 6 calls
          // Regular config: 2 years * 1 config = 2 calls
          // Total: 8 calls
          expect(mockRunnerManager.mockRunner.seed).toHaveBeenCalledTimes(8)

          // Verify getStateCodesForYear was only called for multi-state configs
          expect(
            mockRunnerManager.mockRunner.getStateCodesForYear,
          ).toHaveBeenCalledTimes(2) // 2 years

          // Check that regular config calls use the original url function
          const seedCalls = mockRunnerManager.mockRunner.seed.mock.calls
          const regularConfigCalls = seedCalls.filter((call) => {
            const config = call[0] as GeographySeedConfig
            return !('urlGenerator' in config)
          })

          expect(regularConfigCalls).toHaveLength(2) // 2 years

          const regularCallConfig =
            regularConfigCalls[0][0] as GeographySeedConfig
          const regularCallContext =
            regularConfigCalls[0][1] as GeographyContext
          expect(regularCallConfig.url!(regularCallContext)).toBe(
            'https://api.census.gov/data/2020/states',
          )
        } finally {
          isMultiStateConfigSpy.mockRestore()
        }
      })

      it('preserves beforeSeed and afterSeed hooks for multi-state configs', async () => {
        const beforeSeedMock = vi.fn()
        const afterSeedMock = vi.fn()

        const multiStateConfig: MultiStateGeographySeedConfig = {
          table: 'geographies',
          conflictColumn: 'ucgid_code',
          urlGenerator: (context: GeographyContext, stateCode: string) =>
            `https://api.census.gov/data/${context.year}/counties?state=${stateCode}`,
          requiresStateIteration: true,
          beforeSeed: beforeSeedMock,
          afterSeed: afterSeedMock,
        }

        const isMultiStateConfigSpy = vi
          .spyOn(
            await import('../../../src/schema/seed-config.schema'),
            'isMultiStateConfig',
          )
          .mockReturnValue(true)

        try {
          await runGeographySeeds(mockRunnerManager.mockRunnerInstance, [
            multiStateConfig,
          ])

          // Verify that each generated config preserves the hooks
          const seedCalls = mockRunnerManager.mockRunner.seed.mock.calls
          seedCalls.forEach((call) => {
            const config = call[0] as GeographySeedConfig
            expect(config.beforeSeed).toBe(beforeSeedMock)
            expect(config.afterSeed).toBe(afterSeedMock)
          })
        } finally {
          isMultiStateConfigSpy.mockRestore()
        }
      })
    })

    it('should fetch available years and run seeds for each year', async () => {
      await runGeographySeeds(mockRunnerManager.mockRunnerInstance)

      expect(
        mockRunnerManager.mockRunner.getAvailableYears,
      ).toHaveBeenCalledOnce()
      // 2 Years x 7 Std Geo Configs = 14
      // +
      // 2 Years x 2 Mocked States x 1 MultiState Geo Configs = 4
      // = 18 Config Runs
      expect(mockRunnerManager.mockRunner.seed).toHaveBeenCalledTimes(18)

      const seedCalls = mockRunnerManager.mockRunner.seed.mock.calls

      expect(seedCalls[0]).toEqual([
        expect.objectContaining({ table: 'geographies' }),
        expect.objectContaining({ year: 2020, year_id: 1 }),
      ])

      expect(seedCalls[10]).toEqual([
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
    let consoleSpy: vi.SpyInstance

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    describe('validateGeographySeedConfig', () => {
      it('should handle validation errors in runGeographySeeds', async () => {
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
        ] as unknown[]

        const { mockRunnerInstance } = await setupMockSeedRunner()

        await expect(
          runGeographySeeds(
            mockRunnerInstance,
            invalidConfigs as EnhancedGeographySeedConfig[],
          ),
        ).rejects.toThrow('GeographySeedConfig validation failed')

        expect(consoleSpy).toHaveBeenCalledWith(
          'GeographySeedConfig validation failed:',
        )
      })

      it('should handle Zod validation errors with detailed output', async () => {
        // Create config that will fail Zod schema validation
        const invalidConfig = {
          // Missing required fields and wrong types
          table: 123, // Wrong type - should be string
          conflictColumn: null, // Wrong type - should be string
          extraField: 'should-fail-validation',
        } as unknown

        const { mockRunnerInstance } = await setupMockSeedRunner()

        await expect(
          runGeographySeeds(mockRunnerInstance, [
            invalidConfig,
          ] as EnhancedGeographySeedConfig[]),
        ).rejects.toThrow('GeographySeedConfig validation failed')

        // Verify error logging occurred
        expect(consoleSpy).toHaveBeenCalledWith(
          'GeographySeedConfig validation failed:',
        )
      })

      it('should handle constraint validation errors for regular configs', async () => {
        // Create config that passes Zod but fails constraint validation
        const invalidConfig = {
          table: 'test_table',
          conflictColumn: 'id',
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
          // Missing both file and url - should fail validateSeedConfigConstraints
        } as unknown

        const { mockRunnerInstance } = await setupMockSeedRunner()

        await expect(
          runGeographySeeds(mockRunnerInstance, [
            invalidConfig,
          ] as EnhancedGeographySeedConfig[]),
        ).rejects.toThrow("Either 'file' or 'url' must be provided")
      })

      it('should handle constraint validation errors for multi-state configs', async () => {
        // Create multi-state config that passes Zod but fails constraint validation
        const invalidConfig = {
          table: 'test_table',
          conflictColumn: 'id',
          requiresStateIteration: true,
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
          // Missing urlGenerator - should fail validateEnhancedGeographySeedConfigConstraints
        } as unknown

        const { mockRunnerInstance } = await setupMockSeedRunner()

        await expect(
          runGeographySeeds(mockRunnerInstance, [
            invalidConfig,
          ] as EnhancedGeographySeedConfig[]),
        ).rejects.toThrow(
          "MultiStateGeographySeedConfig must have 'urlGenerator' function",
        )
      })

      it('should handle non-Zod errors', async () => {
        // Spy on constraint validation to throw a custom error
        const validateSpy = vi
          .spyOn(
            await import('../../../src/schema/seed-config.schema'),
            'validateSeedConfigConstraints',
          )
          .mockImplementation(() => {
            throw new Error('Custom constraint error')
          })

        const validConfig = {
          table: 'test_table',
          conflictColumn: 'id',
          url: vi.fn(),
          beforeSeed: vi.fn(),
          afterSeed: vi.fn(),
        } as unknown

        const { mockRunnerInstance } = await setupMockSeedRunner()

        try {
          await expect(
            runGeographySeeds(mockRunnerInstance, [
              validConfig,
            ] as EnhancedGeographySeedConfig[]),
          ).rejects.toThrow(
            'GeographySeedConfig validation failed: Custom constraint error',
          )
        } finally {
          validateSpy.mockRestore()
        }
      })
    })

    describe('validateSeedConfig', () => {
      it('should handle Zod validation errors with detailed output', async () => {
        // Create config that will fail Zod schema validation
        const invalidConfig = {
          // Missing required table and conflictColumn
          file: 'test.json',
          extraField: 'should-fail-validation',
          table: 123, // Wrong type - should be string
          conflictColumn: null, // Wrong type - should be string
        }

        const { mockRunnerInstance } = await setupMockSeedRunner()

        await expect(
          runSeedsWithRunner(mockRunnerInstance, undefined, [
            invalidConfig,
          ] as unknown as SeedConfig[]),
        ).rejects.toThrow('SeedConfig validation failed')

        // Verify error logging occurred
        expect(consoleSpy).toHaveBeenCalledWith('SeedConfig validation failed:')
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('table'),
        )
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('conflictColumn'),
        )
      })

      it('should handle constraint validation errors (no file or url)', async () => {
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
      })

      it('should handle constraint validation errors (both file and url)', async () => {
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
      })

      it('should handle non-Zod errors', async () => {
        // Spy on the constraint validation function to throw a custom error
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

        try {
          await expect(
            runSeedsWithRunner(mockRunnerInstance, undefined, [validConfig]),
          ).rejects.toThrow(
            'SeedConfig validation failed: Custom constraint error',
          )
        } finally {
          validateSpy.mockRestore()
        }
      })
    })

    describe('validateGeographyContext', () => {
      it('should handle Zod validation errors', () => {
        const invalidContext = {
          year: 'not-a-number', // Should be number
          year_id: 'not-a-number', // Should be number
          parentGeographies: 'not-an-object', // Should be object
        } as unknown

        expect(() => {
          validateGeographyContext(invalidContext)
        }).toThrow('GeographyContext validation failed')

        expect(consoleSpy).toHaveBeenCalledWith(
          'GeographyContext validation failed:',
        )
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('year'))
      })

      it('should pass valid context', () => {
        const validContext = {
          year: 2023,
          year_id: 1,
          parentGeographies: {},
        }

        const result = validateGeographyContext(validContext)

        expect(result).toEqual(validContext)
        expect(consoleSpy).not.toHaveBeenCalled()
      })

      it('should handle minimum year validation', () => {
        const invalidContext = {
          year: 1775, // Below minimum of 1776
          year_id: 1,
          parentGeographies: {},
        } as unknown

        expect(() => {
          validateGeographyContext(invalidContext)
        }).toThrow('GeographyContext validation failed')

        expect(consoleSpy).toHaveBeenCalledWith(
          'GeographyContext validation failed:',
        )
      })
    })

    describe('zodErrorHandling', () => {
      it('should handle regular Error objects', () => {
        const regularError = new Error('Some error message')

        expect(() => {
          zodErrorHandling(regularError, 'Test validation failed')
        }).toThrow('Test validation failed: Some error message')

        // Should not log for non-Zod errors
        expect(consoleSpy).not.toHaveBeenCalled()
      })

      it('should handle non-Error objects', () => {
        const stringError = 'Some string error'

        expect(() => {
          zodErrorHandling(stringError, 'Test validation failed')
        }).toThrow('Test validation failed: Some string error')

        expect(consoleSpy).not.toHaveBeenCalled()
      })
    })
  })
})
