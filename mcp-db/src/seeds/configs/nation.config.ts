import { Client } from 'pg'
import { SeedConfig } from '../../schema/seed-config.schema.js'
import { transformApiGeographyData } from '../../schema/geography.schema.js'

export const NationConfig: SeedConfig = {
  url: 'https://api.census.gov/data/2023/geoinfo?get=NAME,SUMLEVEL,GEO_ID,INTPTLAT,INTPTLON&for=us:*',
  table: 'geographies',
  conflictColumn: 'ucgid_code',
  beforeSeed: (client: Client, rawData: unknown[]): void => {
    console.log('Processing nation geography data...')

    // Use the reusable transformation function from geography.schema.ts
    const transformedData = transformApiGeographyData(rawData, 'nation')

    console.log(transformedData)

    // Add geography-specific query parameters for individual records
    transformedData.forEach((record) => {
      // For nation, there's only one record and it should always use us:*
      record.for_param = 'us:*'
      record.in_param = null
    })

    // Replace raw data with transformed data for insertion
    rawData.length = 0
    rawData.push(...transformedData)

    console.log(`✓ Processed ${transformedData.length} nation records`)
  },
  afterSeed: async (client: Client): Promise<void> => {
    const result = await client.query(`
      SELECT name, for_param, summary_level_code, ucgid_code 
      FROM geographies 
      WHERE summary_level_code = '010'
    `)
    console.log(`✓ Seeded ${result.rows.length} nation record(s)`)
    if (result.rows.length > 0) {
      const nation = result.rows[0]
      console.log(
        `  ${nation.name} (${nation.ucgid_code}) -> ${nation.for_param}`,
      )
    }
  },
}
