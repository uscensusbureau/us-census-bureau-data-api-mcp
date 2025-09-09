import { Client } from 'pg'
import { fileURLToPath } from 'url'
import path from 'path'
import { promises as fs } from 'fs'

import { DivisionRegionMappingsType } from '../../schema/division_region_mappings.schema.js'
import {
  GeographyContext,
  MultiStateGeographySeedConfig,
} from '../../schema/seed-config.schema.js'
import { createGeographyYear } from '../../helpers/geography-years.helper.js'
import { transformApiGeographyData } from '../../schema/geography.schema.js'

export const parentCountySubdivisionSQL = `
  UPDATE geographies
  SET parent_geography_id = (
    SELECT id FROM geographies parent 
    WHERE parent.summary_level_code = '050'
      AND parent.state_code = geographies.state_code
      AND parent.county_code = geographies.county_code
  )
  WHERE summary_level_code = '060';
`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const CountySubdivisionConfig: MultiStateGeographySeedConfig = {
  urlGenerator: (context: GeographyContext, stateCode: string) =>
    `https://api.census.gov/data/${context.year}/geoinfo?get=NAME,SUMLEVEL,GEO_ID,STATE,COUNTY,COUSUB,INTPTLAT,INTPTLON&for=county%20subdivision:*&in=state:${stateCode}`,
  table: 'geographies',
  conflictColumn: 'ucgid_code',
  requiresStateIteration: true,
  beforeSeed: async (
    client: Client,
    rawData: unknown[],
    context: GeographyContext,
  ): Promise<void> => {
    console.log(`Processing county geography data for ${context.year}...`)
    const transformedData = transformApiGeographyData(
      rawData,
      'county_subdivision',
    )

    // Import Division < Region Relationship Since API is Missing Data
    const dataPath = path.join(__dirname, '../../../data')
    const filePath = path.join(dataPath, 'division_region_mappings.json')
    const content = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(content)

    // Create a Map for Lookup and Record Association During Data Transformation
    const stateToRegionDivisionMap = new Map<
      string,
      { region_code: string; division_code: string }
    >()

    data.divisions.forEach((division: DivisionRegionMappingsType) => {
      division.states.forEach((county_subdivision: { state_code: string }) => {
        stateToRegionDivisionMap.set(county_subdivision.state_code, {
          region_code: division.region_code,
          division_code: division.division_code,
        })
      })
    })

    transformedData.forEach((record) => {
      record.for_param = `county%20subdivision:${record.county_subdivision_code}`
      record.in_param = `state:${record.state_code}%20county:${record.county_code}`

      // Manually Assign the Missing Region Code
      if (record.state_code !== null) {
        const stateCodeStr = String(record.state_code)
        const regionDivisionData = stateToRegionDivisionMap.get(stateCodeStr)

        if (regionDivisionData !== undefined) {
          record.region_code = regionDivisionData.region_code
          record.division_code = regionDivisionData.division_code
        } else {
          console.warn(
            `No region/division data found for county subdivision: ${record.state_code}`,
          )
          console.warn(
            'This may be because the county subdivision is in a province or territory.',
          )
        }
      } else {
        throw new Error(
          `Missing state_code for county subdivision: ${record.county_subdivision_code}`,
        )
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

    await client.query(parentCountySubdivisionSQL)

    console.log(
      `Seeded ${insertedIds.length} county subdivision record(s) for ${context.year}`,
    )
  },
}
