import { Client } from 'pg'
import { z } from 'zod'

import { DATABASE_URL } from '../../helpers/database.helper.js'
import { SeedConfig } from '../../schema/seed-config.schema.js'
import { SeedRunner } from '../scripts/seed-runner.js'
import {
  SummaryLevelsArraySchema,
  SummaryLevelSchema,
} from '../../schema/summary-level.schema.js'

export const SummaryLevelsConfig: SeedConfig = {
  file: 'summary_levels.json',
  table: 'summary_levels',
  dataPath: 'summary_levels',
  conflictColumn: 'code',
  beforeSeed: (client: Client, rawData: unknown[]): void => {
    console.log('Validating geography levels data...')

    try {
      // Validate entire array with Zod
      const validatedData = SummaryLevelsArraySchema.parse(rawData)
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
      throw new Error(`Geography levels data validation failed: ${error}`)
    }
  },
  afterSeed: async (client: Client): Promise<void> => {
    // Set up parent relationships. summary_levels table created via migrations
    await client.query(`
      UPDATE summary_levels 
      SET parent_summary_level_id = (
        SELECT id FROM summary_levels parent 
        WHERE parent.code = summary_levels.parent_summary_level
      )
      WHERE parent_summary_level IS NOT NULL;
    `)

    // Verify relationships
    const result = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(parent_summary_level_id) as with_parent,
        COUNT(CASE WHEN parent_summary_level IS NOT NULL THEN 1 END) as should_have_parent
      FROM summary_levels;
    `)

    const { total, with_parent, should_have_parent } = result.rows[0]
    console.log(
      `Geography levels: ${total} total, ${with_parent}/${should_have_parent} with parents`,
    )

    if (with_parent !== should_have_parent) {
      const orphans = await client.query(`
        SELECT name, code, parent_summary_level 
        FROM summary_levels 
        WHERE parent_summary_level IS NOT NULL AND parent_summary_level_id IS NULL
      `)
      console.warn('Orphaned records:', orphans.rows)
    }
  },
}
