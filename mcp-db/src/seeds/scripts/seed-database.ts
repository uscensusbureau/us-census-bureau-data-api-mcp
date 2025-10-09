import { z } from 'zod'
import 'dotenv/config'

import { DATABASE_URL } from '../../helpers/database.helper.js'
import {
  BaseSeedConfigSchema,
  EnhancedGeographySeedConfig,
  EnhancedGeographySeedConfigSchema,
  GeographySeedConfig,
  GeographySeedConfigSchema,
  GeographyContext,
  GeographyContextSchema,
  isMultiStateConfig,
  MultiStateGeographySeedConfig,
  SeedConfig,
  validateEnhancedGeographySeedConfigConstraints,
  validateSeedConfigConstraints,
} from '../../schema/seed-config.schema.js'
import { SeedRunner } from './seed-runner.js'

import {
  CountyConfig,
  CountySubdivisionConfig,
  DivisionConfig,
  NationConfig,
  PlaceConfig,
  RegionConfig,
  StateConfig,
  SummaryLevelsConfig,
  YearsConfig,
} from '../configs/index.js'

// Seed configurations
export const seeds: SeedConfig[] = [SummaryLevelsConfig, YearsConfig]

let baseGeographySeeds: EnhancedGeographySeedConfig[] = [
  NationConfig,
  RegionConfig,
  DivisionConfig,
  StateConfig,
  CountyConfig,
  CountySubdivisionConfig,
  PlaceConfig,
]

export function geographySeeds(): EnhancedGeographySeedConfig[] {
  if (process.env.SEED_MODE === 'lite' || process.env.SEED_MODE === 'slim') {
    // Remove Configs That Take Forever to Run if SEED_MODE Set to Lite/Slim (For Testing Builds)
    baseGeographySeeds = baseGeographySeeds
      .filter((config) => config !== CountySubdivisionConfig)
      .filter((config) => config !== PlaceConfig)
  }

  return baseGeographySeeds
}

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
      await runGeographySeeds(runner, geographySeeds())
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
  seedConfigs: EnhancedGeographySeedConfig[] = geographySeeds(),
): Promise<void> {
  seedConfigs.forEach((config) => {
    validateGeographySeedConfig(config)
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
      if (isMultiStateConfig(config)) {
        // Use cached state data to iterate over sub geographies
        const stateCodes = await runner.getStateCodesForYear(
          validContext,
          validContext.year,
        )

        for (const stateCode of stateCodes) {
          // Use a config that handles dynamically assigned states in the URL
          const stateSpecificConfig: GeographySeedConfig = {
            ...config,
            url: (ctx: GeographyContext) => config.urlGenerator(ctx, stateCode),
          }
          await runner.seed(stateSpecificConfig, validContext)
        }
      } else {
        await runner.seed(config, validContext)
      }
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

export function validateGeographySeedConfig(
  config: EnhancedGeographySeedConfig,
): void {
  try {
    EnhancedGeographySeedConfigSchema.parse(config)
    const fullConfig = config as EnhancedGeographySeedConfig

    if (isMultiStateConfig(fullConfig)) {
      validateEnhancedGeographySeedConfigConstraints(fullConfig)
    } else {
      validateSeedConfigConstraints(fullConfig)
    }
  } catch (error) {
    zodErrorHandling(error, 'GeographySeedConfig validation failed')
  }
}

function validateSeedConfig(config: SeedConfig): void {
  try {
    BaseSeedConfigSchema.parse(config)
    const fullConfig = config as SeedConfig

    validateSeedConfigConstraints(fullConfig)
  } catch (error) {
    zodErrorHandling(error, 'SeedConfig validation failed')
  }
}

export function validateGeographyContext(context: unknown): GeographyContext {
  try {
    return GeographyContextSchema.parse(context)
  } catch (error) {
    zodErrorHandling(error, 'GeographyContext validation failed')
  }
}

export function zodErrorHandling(error: unknown, error_message: string): never {
  if (error instanceof z.ZodError) {
    console.error(`${error_message}:`)
    error.issues.forEach((issue, i) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
      console.error(`${i + 1}. ${path}: ${issue.message}`)
    })
    throw new Error(
      `${error_message}: ${JSON.stringify(error.issues, null, 2)}`,
    )
  }

  const errorMessage = error instanceof Error ? error.message : String(error)
  throw new Error(`${error_message}: ${errorMessage}`)
}
