import { z } from 'zod'
import 'dotenv/config'

import { DATABASE_URL } from '../../helpers/database.helper.js'
import {
  BaseSeedConfigSchema,
  GeographySeedConfig,
  GeographySeedConfigSchema,
  GeographyContext,
  GeographyContextSchema,
  SeedConfig,
  validateSeedConfigConstraints,
} from '../../schema/seed-config.schema.js'
import { SeedRunner } from './seed-runner.js'

import { NationConfig } from '../configs/nation.config.js'
import { RegionConfig } from '../configs/region.config.js'
import { SummaryLevelsConfig } from '../configs/summary-levels.config.js'
import { YearsConfig } from '../configs/years.config.js'

// Seed configurations
export const seeds: SeedConfig[] = [SummaryLevelsConfig, YearsConfig]
export const geographySeeds: GeographySeedConfig[] = [
  NationConfig,
  RegionConfig,
]

export async function runSeeds(
  databaseUrl: string = DATABASE_URL,
  targetSeedName?: string,
): Promise<void> {
  const runner = new SeedRunner(databaseUrl)
  let connected = false

  try {
    await runner.connect()
    connected = true
    console.log('Connected to database')

    await runSeedsWithRunner(runner, targetSeedName)

    if (!targetSeedName) {
      await runGeographySeeds(runner, geographySeeds)
    }

    console.log('Seeding completed successfully!')
  } finally {
    if (connected) {
      await runner.disconnect()
    }
  }
}

export async function runSeedsWithRunner(
  runner: SeedRunner,
  targetSeedName?: string,
  customSeedConfigs?: SeedConfig[],
): Promise<void> {
  const seedConfigs: SeedConfig[] = customSeedConfigs || seeds

  // Run specific seed or all seeds
  const seedsToRun: SeedConfig[] = targetSeedName
    ? seedConfigs.filter((s) => s.file === targetSeedName)
    : seedConfigs

  if (seedsToRun.length === 0) {
    throw new Error(`Seed file "${targetSeedName}" not found`)
  }

  seedsToRun.forEach((config) => {
    validateSeedConfig(config)
  })

  // Process seeds sequentially
  await seedsToRun.reduce(async (previousSeed, seedConfig) => {
    await previousSeed
    return runner.seed(seedConfig)
  }, Promise.resolve())
}

export async function runGeographySeeds(
  runner: SeedRunner,
  seedConfigs: GeographySeedConfig[] = geographySeeds,
): Promise<void> {
  seedConfigs.forEach((config) => {
    validateGeographySeedConfig(config) // New function
  })

  const years = await runner.getAvailableYears()

  console.log(`Found ${years.length} years to process: ${years.join(', ')}`)

  for (const yearRow of years) {
    console.log(`\n--- Processing Geography Data for ${yearRow.year} ---`)

    const context: GeographyContext = {
      year: yearRow.year,
      year_id: yearRow.id,
      parentGeographies: {},
    }

    const validContext = validateGeographyContext(context)

    for (const config of seedConfigs) {
      await runner.seed(config, validContext)
    }
  }
}

export async function main(runSeedsFunction = runSeeds): Promise<void> {
  console.log('Starting database seeding...')

  try {
    const seedName: string | undefined = process.argv[2]
    await runSeedsFunction(DATABASE_URL, seedName)
  } catch (error) {
    console.error('Seeding failed:', (error as Error).message)
    process.exit(1)
  }
}

// ES module equivalent of "if (require.main === module)"
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

function validateGeographySeedConfig(config: GeographySeedConfig): void {
  try {
    GeographySeedConfigSchema.parse(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('GeographySeedConfig validation failed:')
      error.issues.forEach((issue, i) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
        console.error(`${i + 1}. ${path}: ${issue.message}`)
      })
    }
    throw new Error(
      `GeographySeedConfig validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

function validateSeedConfig(config: SeedConfig): void {
  try {
    BaseSeedConfigSchema.parse(config)
    const fullConfig = config as SeedConfig

    // Custom validation for url/file requirement
    validateSeedConfigConstraints(fullConfig)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('SeedConfig validation failed:')
      error.issues.forEach((issue, i) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
        console.error(`${i + 1}. ${path}: ${issue.message}`)
      })
    }
    throw new Error(
      `SeedConfig validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

function validateGeographyContext(context: unknown): GeographyContext {
  try {
    return GeographyContextSchema.parse(context)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('GeographyContext validation failed:')
      error.issues.forEach((issue, i) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
        console.error(`${i + 1}. ${path}: ${issue.message}`)
      })
    }
    throw new Error(
      `GeographyContext validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}
