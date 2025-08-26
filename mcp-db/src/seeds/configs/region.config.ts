import { Client } from 'pg'

import {
  GeographySeedConfig,
  GeographyContext,
} from '../../schema/seed-config.schema.js'
import { transformApiGeographyData } from '../../schema/geography.schema.js'
import { createGeographyYear } from '../../helpers/geography-years.helper.js'

export const RegionConfig: GeographySeedConfig = {
  url: (context: GeographyContext) =>
    `https://api.census.gov/data/${context.year}/geoinfo?get=NAME,SUMLEVEL,GEO_ID,REGION,INTPTLAT,INTPTLON&for=region:*`,
  table: 'geographies',
  conflictColumn: 'ucgid_code',
  beforeSeed: (
    client: Client,
    rawData: unknown[],
    context: GeographyContext,
  ): void => {
    console.log(`Processing region geography data for ${context.year}...`)

    const transformedData = transformApiGeographyData(rawData, 'region')

    transformedData.forEach((record) => {
      record.for_param = `region:${record.region_code}`
      record.in_param = null
    })

    context.parentGeographies = context.parentGeographies || {}
    context.parentGeographies.regions = transformedData

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

    console.log(
      `Seeded ${insertedIds.length} region record(s) for ${context.year}`,
    )
  },
}
