import { Client } from 'pg'
import { z, ZodSchema } from 'zod'

export const SeedConfigSchema = z
  .object({
    file: z.string().optional(), // For local file seeding
    url: z.string().url().optional(), // For API Import
    table: z.string().min(1),
    conflictColumn: z.string().min(1),
    dataPath: z.string().optional(),

    // API options
    queryParams: z.record(z.string(), z.string()).optional(),
    timeout: z.number().positive().optional(),

    // Custom logic for pre and post processing data
    beforeSeed: z.any().optional(),
    afterSeed: z.any().optional(),
  })
  .strict()
  .refine((data) => data.file || data.url, {
    message: "Either 'file' or 'url' must be provided",
    path: ['file'],
  })
  .refine((data) => !(data.file && data.url), {
    message: "Cannot specify both 'file' and 'url'",
    path: ['url'],
  })

// TypeScript Type extending Zod schema needed due to Zod constraints validating functions
export type SeedConfig = Omit<
  z.infer<typeof SeedConfigSchema>,
  'beforeSeed' | 'afterSeed' | 'queryParams'
> & {
  beforeSeed?: (client: Client, rawData: unknown[]) => Promise<void>
  afterSeed?: (client: Client) => Promise<void>
  queryParams?: Record<string, string | number | boolean>
}
