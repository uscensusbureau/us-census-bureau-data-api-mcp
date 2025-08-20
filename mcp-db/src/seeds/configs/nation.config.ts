import { Client } from 'pg'

import {
  GeographySeedConfig,
  GeographyContext,
} from '../../schema/seed-config.schema.js'
import { transformApiGeographyData } from '../../schema/geography.schema.js'
import { createGeographyYear } from '../../helpers/geography-years.helper.js'

export const NationConfig: GeographySeedConfig = {
  url: (context: GeographyContext) =>
    `https://api.census.gov/data/${context.year}/geoinfo?get=NAME,SUMLEVEL,GEO_ID,INTPTLAT,INTPTLON&for=us:*`,
  table: 'geographies',
  conflictColumn: 'ucgid_code',
  beforeSeed: (
    client: Client,
    rawData: unknown[],
    context: GeographyContext,
  ): void => {
    console.log(`Processing nation geography data for ${context.year}...`)

    const transformedData = transformApiGeographyData(rawData, 'nation')
    transformedData.forEach((record) => {
      record.for_param = 'us:*'
      record.in_param = null
    })

    // Store nation data in context for potential use by child geographies
    context.parentGeographies = context.parentGeographies || {}
    context.parentGeographies.nation = transformedData

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
      `Seeded ${insertedIds.length} nation record(s) for ${context.year}`,
    )
  },
}
