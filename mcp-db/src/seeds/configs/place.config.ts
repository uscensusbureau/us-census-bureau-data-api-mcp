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

export const parentPlaceSQL = `
  UPDATE geographies
  SET parent_geography_id = (
    SELECT id FROM geographies parent 
    WHERE parent.summary_level_code = '040'
      AND parent.state_code = geographies.state_code
  )
  WHERE summary_level_code = '160';
`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const PlaceConfig: GeographySeedConfig = {
  url: (context: GeographyContext) =>
    `https://api.census.gov/data/${context.year}/geoinfo?get=NAME,SUMLEVEL,GEO_ID,STATE,PLACE,INTPTLAT,INTPTLON&for=place:*`,
  table: 'geographies',
  conflictColumn: 'ucgid_code',
  beforeSeed: async (
    client: Client,
    rawData: unknown[],
    context: GeographyContext,
  ): Promise<void> => {
    console.log(`Processing place geography data for ${context.year}...`)
    const transformedData = transformApiGeographyData(rawData, 'place')

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
      division.states.forEach((place: { state_code: string }) => {
        stateToRegionDivisionMap.set(place.state_code, {
          region_code: division.region_code,
          division_code: division.division_code,
        })
      })
    })

    transformedData.forEach((record) => {
      record.for_param = `place:${record.place_code}`
      record.in_param = `state:${record.state_code}`

      // Manually Assign the Missing Region Code
      if (record.state_code !== null) {
        const stateCodeStr = String(record.state_code)
        const regionDivisionData = stateToRegionDivisionMap.get(stateCodeStr)

        if (regionDivisionData !== undefined) {
          record.region_code = regionDivisionData.region_code
          record.division_code = regionDivisionData.division_code
        } else {
          console.warn(
            `No region/division data found for place: ${record.place_code}`,
          )
          console.warn(
            'This may be because the place is in a province or territory.',
          )
        }
      } else {
        throw new Error(`Missing state_code for place: ${record.place_code}`)
      }
    })

    context.parentGeographies = context.parentGeographies || {}
    context.parentGeographies.states = transformedData

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

    await client.query(parentPlaceSQL)

    console.log(
      `Seeded ${insertedIds.length} place record(s) for ${context.year}`,
    )
  },
}
