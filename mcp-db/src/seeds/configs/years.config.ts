import { Client } from 'pg'
import { z } from 'zod'

import { SeedConfig } from '../../schema/seed-config.schema.js'
import { YearsArraySchema } from '../../schema/year.schema.js'

export const YearsConfig: SeedConfig = {
  file: 'years.json',
  table: 'years',
  dataPath: 'years',
  conflictColumn: 'year',
  beforeSeed: (client: Client, rawData: unknown[]): void => {
    try {
      // Validate entire array with Zod
      const validatedData = YearsArraySchema.parse(rawData)
      console.log(`Validation passed for ${validatedData.length} records`)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation failed:')
        error.issues.forEach((issue: z.ZodIssue, i) => {
          console.error(
            `${i + 1}. Path: ${issue.path.join('.')} - ${issue.message}`,
          )
          console.error(`Code: ${issue.code}`)
          console.error(`Details: ${JSON.stringify(issue, null, 2)}`)
        })
      }
      throw new Error(`Years data validation failed: ${error}`)
    }
  },
}
