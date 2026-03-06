// components.config.ts
import { Client } from 'pg'
import { SeedConfig } from '../../schema/seed-config.schema.js'
import { transformComponentData } from '../../schema/components.schema.js'

export const ComponentsConfig: SeedConfig = {
  file: 'components-programs.csv',
  table: 'components',
  conflictColumn: 'component_id',
  beforeSeed: async (client: Client, rawData: unknown[]): Promise<void> => {
    // Fetch all program IDs prior to insertion for performance and validation
    const programQuery = await client.query(`SELECT id, acronym FROM programs`)
    const programIdMap = new Map<string, number>(
      programQuery.rows.map((row) => [row.acronym, parseInt(row.id, 10)]),
    )

    const components = transformComponentData(rawData, programIdMap)

    rawData.length = 0
    rawData.push(...components)
  },
}
