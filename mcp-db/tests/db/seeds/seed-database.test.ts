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
  let runner: SeedRunner
  let client: Client
  let databaseUrl: string

  beforeAll(async () => {
    // Initialize client once for the entire test suite
    client = new Client(dbConfig)
    await client.connect()

    // Construct database URL for SeedRunner
    databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  })

  afterAll(async () => {
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
            'TRUNCATE TABLE summary_levels RESTART IDENTITY CASCADE',
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

  describe('seeds', () => {
    describe('summary_levels seed configuration', () => {
      it('should have valid configuration structure', () => {
        const geographySeed = seeds.find(
          (s) => s.file === 'summary_levels.json',
        )

        expect(geographySeed).toBeDefined()
        expect(geographySeed?.table).toBe('summary_levels')
        expect(geographySeed?.dataPath).toBe('summary_levels')
        expect(geographySeed?.conflictColumn).toBe('summary_level')
        expect(geographySeed?.beforeSeed).toBeDefined()
        expect(geographySeed?.afterSeed).toBeDefined()
      })

      describe('beforeSeed logic', () => {
        it('should validate correct data structure', async () => {
          const geographySeed = seeds.find(
            (s) => s.file === 'summary_levels.json',
          )
          expect(geographySeed?.beforeSeed).toBeDefined()

          const validData = [
            {
              name: 'Nation',
              description: 'United States total',
              get_variable: 'NATION',
              query_name: 'us',
              on_spine: true,
              summary_level: '010',
              parent_summary_level: null,
            },
          ]

          // Mock client for validation testing
          const mockClient = {} as Client

          // Should not throw with valid data
          await expect(
            geographySeed!.beforeSeed!(mockClient, validData),
          ).resolves.not.toThrow()
        })

        it('should reject invalid data structure', async () => {
          const geographySeed = seeds.find(
            (s) => s.file === 'summary_levels.json',
          )
          expect(geographySeed?.beforeSeed).toBeDefined()

          const invalidData = [
            {
              name: 'Nation',
              // Missing required fields
              summary_level: '010',
            },
          ]

          const mockClient = {} as Client

          // Should throw with invalid data
          await expect(
            geographySeed!.beforeSeed!(mockClient, invalidData),
          ).rejects.toThrow(/validation failed/i)
        })

        it('should handle empty data array', async () => {
          const geographySeed = seeds.find(
            (s) => s.file === 'summary_levels.json',
          )
          expect(geographySeed?.beforeSeed).toBeDefined()

          const emptyData: unknown[] = []
          const mockClient = {} as Client

          // Should handle empty data gracefully
          await expect(
            geographySeed!.beforeSeed!(mockClient, emptyData),
          ).resolves.not.toThrow()
        })

        it('should provide detailed validation error messages', async () => {
          const geographySeed = seeds.find(
            (s) => s.file === 'summary_levels.json',
          )
          expect(geographySeed?.beforeSeed).toBeDefined()

          const invalidData = [
            {
              name: 'Nation',
              description: 'United States total',
              get_variable: 'NATION',
              query_name: 'us',
              on_spine: 'not_boolean', // Invalid type
              summary_level: 123, // Invalid type
              parent_summary_level: null,
            },
          ]

          const mockClient = {} as Client

          try {
            await geographySeed!.beforeSeed!(mockClient, invalidData)
            fail('Expected validation to fail')
          } catch (error) {
            expect(error).toBeInstanceOf(Error)
            expect((error as Error).message).toContain('validation failed')
            // Could also test for specific field errors if your validation provides them
          }
        })
      })

      describe('afterSeed logic', () => {
        beforeEach(async () => {
          // Insert test data first
          await client.query(`
            INSERT INTO summary_levels (name, description, get_variable, query_name, on_spine, summary_level, parent_summary_level)
            VALUES 
              ('Nation', 'United States total', 'NATION', 'us', true, '010', null),
              ('State', 'States and State equivalents', 'STATE', 'state', true, '040', '010'),
              ('County', 'Counties and county equivalents', 'COUNTY', 'county', true, '050', '040')
          `)
        })

        it('should establish parent relationships correctly', async () => {
          const geographySeed = seeds.find(
            (s) => s.file === 'summary_levels.json',
          )
          expect(geographySeed?.afterSeed).toBeDefined()

          // Run the afterSeed logic
          await geographySeed!.afterSeed!(client)

          // Verify relationships were established
          const result = await client.query<{
            name: string
            summary_level: string
            parent_name: string | null
            parent_summary_level: string | null
          }>(`
            SELECT 
              g.name,
              g.summary_level,
              p.name as parent_name,
              g.parent_summary_level
            FROM summary_levels g
            LEFT JOIN summary_levels p ON g.parent_summary_level_id = p.id
            ORDER BY g.summary_level
          `)

          expect(result.rows).toHaveLength(3)

          const nation = result.rows.find((row) => row.summary_level === '010')
          const state = result.rows.find((row) => row.summary_level === '040')
          const county = result.rows.find((row) => row.summary_level === '050')

          expect(nation?.parent_name).toBeNull()
          expect(state?.parent_name).toBe('Nation')
          expect(county?.parent_name).toBe('State')
        })

        it('should handle missing parent references gracefully', async () => {
          // Add a record with non-existent parent
          await client.query(`
            INSERT INTO summary_levels (name, description, get_variable, query_name, on_spine, summary_level, parent_summary_level)
            VALUES ('Orphan', 'Orphaned level', 'ORPHAN', 'orphan', true, '999', '888')
          `)

          const geographySeed = seeds.find(
            (s) => s.file === 'summary_levels.json',
          )
          expect(geographySeed?.afterSeed).toBeDefined()

          // Should not throw
          await expect(geographySeed!.afterSeed!(client)).resolves.not.toThrow()

          // Verify orphan has null parent_summary_level_id
          const orphanResult = await client.query(`
            SELECT parent_summary_level_id 
            FROM summary_levels 
            WHERE summary_level = '999'
          `)

          expect(orphanResult.rows[0].parent_summary_level_id).toBeNull()
        })

        it('should log relationship statistics', async () => {
          const geographySeed = seeds.find(
            (s) => s.file === 'summary_levels.json',
          )
          expect(geographySeed?.afterSeed).toBeDefined()

          // Capture console output
          const consoleSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {})
          const consoleWarnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {})

          try {
            await geographySeed!.afterSeed!(client)

            // Should log relationship statistics
            expect(consoleSpy).toHaveBeenCalledWith(
              expect.stringContaining(
                'Geography levels: 3 total, 2/2 with parents',
              ),
            )

            // Should not warn about orphans (all parents exist)
            expect(consoleWarnSpy).not.toHaveBeenCalledWith(
              expect.stringContaining('Orphaned records'),
            )
          } finally {
            consoleSpy.mockRestore()
            consoleWarnSpy.mockRestore()
          }
        })

        it('should warn about orphaned records when parents are missing', async () => {
          // Add orphaned records
          await client.query(`
            INSERT INTO summary_levels (name, description, get_variable, query_name, on_spine, summary_level, parent_summary_level)
            VALUES 
              ('Orphan1', 'First orphan', 'ORPHAN1', 'orphan1', true, '888', '777'),
              ('Orphan2', 'Second orphan', 'ORPHAN2', 'orphan2', true, '999', '777')
          `)

          const geographySeed = seeds.find(
            (s) => s.file === 'summary_levels.json',
          )
          expect(geographySeed?.afterSeed).toBeDefined()

          const consoleSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {})
          const consoleWarnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {})

          try {
            await geographySeed!.afterSeed!(client)

            // Should warn about orphaned records
            expect(consoleWarnSpy).toHaveBeenCalledWith(
              'Orphaned records:',
              expect.arrayContaining([
                expect.objectContaining({
                  name: 'Orphan1',
                  summary_level: '888',
                }),
                expect.objectContaining({
                  name: 'Orphan2',
                  summary_level: '999',
                }),
              ]),
            )
          } finally {
            consoleSpy.mockRestore()
            consoleWarnSpy.mockRestore()
          }
        })
      })

      // Integration tests for the complete seed workflow
      describe('complete seed workflow', () => {
        it('should seed geography levels with parent relationships', async () => {
          // Create test geography levels data
          const testGeographyData = {
            summary_levels: [
              {
                name: 'Nation',
                description: 'United States total',
                get_variable: 'NATION',
                query_name: 'us',
                on_spine: true,
                summary_level: '010',
                parent_summary_level: null,
              },
              {
                name: 'State',
                description: 'States and State equivalents',
                get_variable: 'STATE',
                query_name: 'state',
                on_spine: true,
                summary_level: '040',
                parent_summary_level: '010',
              },
              {
                name: 'County',
                description: 'Counties and county equivalents',
                get_variable: 'COUNTY',
                query_name: 'county',
                on_spine: true,
                summary_level: '050',
                parent_summary_level: '040',
              },
            ],
          }

          const filePath = path.join(
            __dirname,
            'fixtures',
            'summary_levels.json',
          )
          await fs.writeFile(filePath, JSON.stringify(testGeographyData))

          // Run the seed with the simplified configuration
          const seedConfig = {
            file: 'summary_levels.json',
            table: 'summary_levels',
            conflictColumn: 'summary_level',
            dataPath: 'summary_levels',
            beforeSeed: async (client: Client) => {
              // Create indexes
              await client.query(`
                CREATE INDEX IF NOT EXISTS idx_summary_levels_summary_level 
                ON summary_levels(summary_level);
              `)

              await client.query(`
                CREATE INDEX IF NOT EXISTS idx_summary_levels_parent_summary_level 
                ON summary_levels(parent_summary_level);
              `)
            },
            afterSeed: async (client: Client) => {
              // Update parent relationships
              await client.query(`
                UPDATE summary_levels 
                SET parent_summary_level_id = (
                  SELECT id 
                  FROM summary_levels parent 
                  WHERE parent.summary_level = summary_levels.parent_summary_level
                )
                WHERE parent_summary_level IS NOT NULL;
              `)
            },
          }

          await runner.seed(seedConfig)

          // Verify data was inserted
          const result = await client.query<GeographyLevelRow>(
            'SELECT * FROM summary_levels ORDER BY summary_level',
          )
          expect(result.rows).toHaveLength(3)

          // Verify specific records
          const nation = result.rows.find((row) => row.summary_level === '010')
          const state = result.rows.find((row) => row.summary_level === '040')
          const county = result.rows.find((row) => row.summary_level === '050')

          expect(nation?.name).toBe('Nation')
          expect(nation?.parent_summary_level_id).toBeNull()

          expect(state?.name).toBe('State')
          expect(state?.parent_summary_level_id).toBe(nation?.id)

          expect(county?.name).toBe('County')
          expect(county?.parent_summary_level_id).toBe(state?.id)
        })

        it('should handle idempotent seeding (skip existing records)', async () => {
          // Create test data
          const testGeographyData = {
            summary_levels: [
              {
                name: 'Nation',
                description: 'United States total',
                get_variable: 'NATION',
                query_name: 'us',
                on_spine: true,
                summary_level: '010',
                parent_summary_level: null,
              },
              {
                name: 'State',
                description: 'States and State equivalents',
                get_variable: 'STATE',
                query_name: 'state',
                on_spine: true,
                summary_level: '040',
                parent_summary_level: '010',
              },
            ],
          }

          const filePath = path.join(
            __dirname,
            'fixtures',
            'summary_levels_idempotent.json',
          )
          await fs.writeFile(filePath, JSON.stringify(testGeographyData))

          const seedConfig = {
            file: 'summary_levels_idempotent.json',
            table: 'summary_levels',
            conflictColumn: 'summary_level',
            dataPath: 'summary_levels',
            afterSeed: async (client: Client) => {
              // Update parent relationships
              await client.query(`
                UPDATE summary_levels 
                SET parent_summary_level_id = (
                  SELECT id 
                  FROM summary_levels parent 
                  WHERE parent.summary_level = summary_levels.parent_summary_level
                )
                WHERE parent_summary_level IS NOT NULL;
              `)
            },
          }

          // Run seed twice
          await runner.seed(seedConfig)
          await runner.seed(seedConfig)

          // Should still have only 2 records (not duplicated)
          const result = await client.query<GeographyLevelRow>(
            'SELECT * FROM summary_levels ORDER BY summary_level',
          )
          expect(result.rows).toHaveLength(2)

          // Verify the records are correct
          const nation = result.rows.find((row) => row.summary_level === '010')
          const state = result.rows.find((row) => row.summary_level === '040')

          expect(nation?.name).toBe('Nation')
          expect(state?.name).toBe('State')
          expect(state?.parent_summary_level_id).toBe(nation?.id)
        })
      })
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
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
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
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
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
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
        },
        {
          file: 'other_levels.json',
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
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
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
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
            summary_level: '010',
            parent_summary_level: null,
          },
          {
            name: 'State',
            description: 'States and State equivalents',
            get_variable: 'STATE',
            query_name: 'state',
            on_spine: true,
            summary_level: '040',
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
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
          beforeSeed: async (
            client: Client,
            rawData: unknown[],
          ): Promise<void> => {
            console.log(`Not required for this test: ${client}, ${rawData}`)
          },
          afterSeed: async (client: Client): Promise<void> => {
            await client.query(`
              UPDATE summary_levels 
              SET parent_summary_level_id = (
                SELECT id FROM summary_levels parent 
                WHERE parent.summary_level = summary_levels.parent_summary_level
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
        'SELECT * FROM summary_levels ORDER BY summary_level',
      )
      expect(result.rows).toHaveLength(2)

      const nation = result.rows.find((row) => row.summary_level === '010')
      const state = result.rows.find((row) => row.summary_level === '040')

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
            summary_level: '010',
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
            summary_level: '040',
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
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
        },
        {
          file: 'other_levels.json',
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
        },
      ]

      // Test seed filtering logic using the existing runner
      await runSeedsWithRunner(runner, testSeedConfigs, 'summary_levels.json')

      // Should only have the data from summary_levels.json
      const result = await client.query<GeographyLevelRow>(
        'SELECT * FROM summary_levels',
      )
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Nation')
    })

    it('should throw error for non-existent seed file', async () => {
      const testSeedConfigs = [
        {
          file: 'summary_levels.json',
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
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
            summary_level: '010',
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
            summary_level: '040',
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
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
        },
        {
          file: 'second_seed.json',
          table: 'summary_levels',
          dataPath: 'summary_levels',
          conflictColumn: 'summary_level',
        },
      ]

      // Run all seeds
      await runSeedsWithRunner(runner, testSeedConfigs)

      // Should have data from both seeds
      const result = await client.query<GeographyLevelRow>(
        'SELECT * FROM summary_levels ORDER BY summary_level',
      )
      expect(result.rows).toHaveLength(2)

      const nation = result.rows.find((row) => row.summary_level === '010')
      const state = result.rows.find((row) => row.summary_level === '040')

      expect(nation?.name).toBe('Nation')
      expect(state?.name).toBe('State')
    })
  })
})
