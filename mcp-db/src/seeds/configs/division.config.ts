import { Client } from 'pg'
import { fileURLToPath } from 'url'
import path from 'path'
import { promises as fs } from 'fs'

import { DivisionRegionMappingsType } from '../../schema/division_region_mappings.schema.js'
import {
  GeographySeedConfig,
  GeographyContext,
} from '../../schema/seed-config.schema.js'
import { createGeographyYear } from '../../helpers/geography-years.helper.js'
import { transformApiGeographyData } from '../../schema/geography.schema.js'

export const parentDivisionSQL = `
  UPDATE geographies
  SET parent_geography_id = (
    SELECT id FROM geographies parent 
    WHERE parent.summary_level_code = '020'
      AND parent.region_code = geographies.region_code
  )
  WHERE summary_level_code = '030';
`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const DivisionConfig: GeographySeedConfig = {
  url: (context: GeographyContext) =>
    `https://api.census.gov/data/${context.year}/geoinfo?get=NAME,SUMLEVEL,GEO_ID,INTPTLAT,INTPTLON&for=division:*`,
  table: 'geographies',
  conflictColumn: 'ucgid_code',
  beforeSeed: async (
    client: Client,
    rawData: unknown[],
    context: GeographyContext,
  ): Promise<void> => {
    console.log(`Processing division geography data for ${context.year}...`)
    const transformedData = transformApiGeographyData(rawData, 'division')

    // Import Division < Region Relationship Since API is Missing Data
    const dataPath = path.join(__dirname, '../../../data')
    const filePath = path.join(dataPath, 'division_region_mappings.json')
    const content = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(content)

    // Create a Map for Lookup and Record Association During Data Transformation
    const divisionToRegionMap = new Map<string, string>()
    data.divisions.forEach((division: DivisionRegionMappingsType) => {
      divisionToRegionMap.set(division.division_code, division.region_code)
    })

    transformedData.forEach((record) => {
      record.for_param = `division:${record.division_code}`
      record.in_param = null

      // Manually Assign the Missing Region Code
      if (record.division_code !== null) {
        const divisionCodeStr = String(record.division_code)
        const regionCode = divisionToRegionMap.get(divisionCodeStr)
        if (regionCode !== undefined) {
          record.region_code = regionCode
        } else {
          throw new Error(
            `No region code found for division: ${record.division_code}`,
          )
        }
      } else {
        throw new Error(`Missing division_code for record`)
      }
    })

    rawData.length = 0
    rawData.push(...transformedData)
  },
  afterSeed: async (
    client: Client,
    context: GeographyContext,
    insertedIds: number[],
  ): Promise<void> => {
    for (const geography_id of insertedIds) {
      await createGeographyYear(client, geography_id, context.year_id)
    }

    await client.query(parentDivisionSQL)

    console.log(
      `Seeded ${insertedIds.length} division record(s) for ${context.year}`,
    )
  },
}
