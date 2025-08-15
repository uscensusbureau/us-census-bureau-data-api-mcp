import { Client } from 'pg'
import 'dotenv/config'
import { z } from 'zod'

import { DATABASE_URL } from '../../helpers/database.helper.js'
import { SeedConfig } from '../../schema/seed-config.schema.js'
import { SeedRunner } from './seed-runner.js'

import { NationConfig } from '../configs/nation.config.js'
import { SummaryLevelsConfig } from '../configs/summary-levels.config.js'
import { YearsConfig } from '../configs/years.config.js'

// Seed configurations
export const seeds: SeedConfig[] = [SummaryLevelsConfig, YearsConfig]

export async function runSeedsWithRunner(
  runner: SeedRunner,
  seedConfigs: SeedConfig[],
  targetSeedName?: string,
): Promise<void> {
  // Run specific seed or all seeds
  const seedsToRun: SeedConfig[] = targetSeedName
    ? seedConfigs.filter((s) => s.file === targetSeedName)
    : seedConfigs

  if (seedsToRun.length === 0) {
    throw new Error(`Seed file "${targetSeedName}" not found`)
  }

  // Process seeds sequentially
  await seedsToRun.reduce(async (previousSeed, seedConfig) => {
    await previousSeed
    return runner.seed(seedConfig)
  }, Promise.resolve())
}

export async function runSeeds(
  databaseUrl: string = DATABASE_URL,
  seedConfigs: SeedConfig[] = seeds,
  targetSeedName?: string,
): Promise<void> {
  const runner = new SeedRunner(databaseUrl)

  try {
    await runner.connect()
    console.log('Connected to database')

    await runSeedsWithRunner(runner, seedConfigs, targetSeedName)

    console.log('Seeding completed successfully!')
  } finally {
    await runner.disconnect()
  }
}

export async function main(runSeedsFunction = runSeeds): Promise<void> {
  console.log('Starting database seeding...')

  try {
    const seedName: string | undefined = process.argv[2]
    await runSeedsFunction(DATABASE_URL, seeds, seedName)
  } catch (error) {
    console.error('Seeding failed:', (error as Error).message)
    process.exit(1)
  }
}

// ES module equivalent of "if (require.main === module)"
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
