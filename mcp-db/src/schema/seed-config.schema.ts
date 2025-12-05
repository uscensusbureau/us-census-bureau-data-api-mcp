import { Client } from 'pg'
import { z } from 'zod'

import { GeographyRecordSchema } from './geography.schema.js'

export const BaseSeedConfigSchema = z.object({
  file: z.string().optional(),
  table: z.string().min(1),
  url: z.string().optional(),
  conflictColumn: z.string().min(1),
  dataPath: z.string().optional(),

  // Custom logic for pre and post processing data
  beforeSeed: z.any().optional(),
  afterSeed: z.any().optional(),
})

// Extend the BaseSeedConfigSchema for Geographies
export const GeographySeedConfigSchema = BaseSeedConfigSchema.extend({
  url: z.any(), // Actual validation for function below

  // Custom logic for pre and post processing data
  beforeSeed: z.any(),
  afterSeed: z.any(),
}).strict()

const MultiStateGeographySeedConfigSchema = GeographySeedConfigSchema.extend({
  urlGenerator: z.any(), // Function validation handled in TypeScript
  requiresStateIteration: z.literal(true),
})

// Union schema for validation
export const EnhancedGeographySeedConfigSchema = z.union([
  GeographySeedConfigSchema,
  MultiStateGeographySeedConfigSchema,
])

// TypeScript Type extending Zod schema needed due to Zod constraints validating functions
export type SeedConfig = Omit<
  z.infer<typeof BaseSeedConfigSchema>,
  'beforeSeed' | 'afterSeed'
> & {
  beforeSeed?: (client: Client, rawData: unknown[]) => void | Promise<void>
  afterSeed?: (client: Client) => void | Promise<void>
}

export type GeographySeedConfig = Omit<
  z.infer<typeof GeographySeedConfigSchema>,
  'beforeSeed' | 'afterSeed'
> & {
  url: string | ((context: GeographyContext) => string) // Handles Dynamic URL assignment
  beforeSeed: (
    client: Client,
    rawData: unknown[],
    context: GeographyContext,
  ) => void | Promise<void>
  afterSeed: (
    client: Client,
    context: GeographyContext,
    insertedIds: number[],
  ) => void | Promise<void>
}

export const GeographyContextSchema = z.object({
  year: z.number().int().min(1776),
  year_id: z.number(),
  parentGeographies: z
    .record(z.string(), z.record(z.string(), z.array(GeographyRecordSchema)))
    .optional(),
})

export type GeographyContext = z.infer<typeof GeographyContextSchema>

export function validateEnhancedGeographySeedConfigConstraints(
  config: EnhancedGeographySeedConfig,
): void {
  if (isMultiStateConfig(config)) {
    if (!config.urlGenerator || typeof config.urlGenerator !== 'function') {
      throw new Error(
        "MultiStateGeographySeedConfig must have 'urlGenerator' function",
      )
    }
    if (config.requiresStateIteration !== true) {
      throw new Error(
        "MultiStateGeographySeedConfig must have 'requiresStateIteration' set to true",
      )
    }
    // MultiState configs don't need file/url validation since they use urlGenerator
  } else {
    validateSeedConfigConstraints(config) // Use existing validation for regular configs
  }
}

export function validateSeedConfigConstraints(
  config: SeedConfig | GeographySeedConfig,
): void {
  const hasFile = !!config.file
  const hasUrl = !!config.url

  if (!hasFile && !hasUrl) {
    throw new Error("Either 'file' or 'url' must be provided")
  }

  if (hasFile && hasUrl) {
    throw new Error("Cannot specify both 'file' and 'url'")
  }
}

//For handling Summary Levels Requiring State In Param
export interface MultiStateGeographySeedConfig
  extends Omit<GeographySeedConfig, 'url'> {
  urlGenerator: (context: GeographyContext, stateCode: string) => string
  requiresStateIteration: true
}

export type EnhancedGeographySeedConfig =
  | GeographySeedConfig
  | MultiStateGeographySeedConfig

export function isMultiStateConfig(
  config: EnhancedGeographySeedConfig,
): config is MultiStateGeographySeedConfig {
  return (
    'requiresStateIteration' in config && config.requiresStateIteration === true
  )
}
