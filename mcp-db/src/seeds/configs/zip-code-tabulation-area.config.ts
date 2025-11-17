import { Client } from 'pg'

import {
  GeographySeedConfig,
  GeographyContext,
} from '../../schema/seed-config.schema.js'
import { createGeographyYear } from '../../helpers/geography-years.helper.js'
import { transformApiGeographyData } from '../../schema/geography.schema.js'

export const parentZipCodeTabulationAreaSQL = `
  UPDATE geographies parent
  SET parent_geography_id = (
    SELECT id FROM geographies parent
    WHERE parent.summary_level_code = '010'
    LIMIT 1
  )
  WHERE summary_level_code = '860';
`

export const ZipCodeTabulationAreaConfig: GeographySeedConfig = {
  url: (context: GeographyContext) =>
    `https://api.census.gov/data/${context.year}/geoinfo?get=NAME,SUMLEVEL,GEO_ID,INTPTLAT,INTPTLON,ZCTA&for=zip%20code%20tabulation%20area:*`,
  table: 'geographies',
  conflictColumn: 'ucgid_code',
  beforeSeed: async (
    client: Client,
    rawData: unknown[],
    context: GeographyContext,
  ): Promise<void> => {
    console.log(
      `Processing zip code tabulation area geography data for ${context.year}...`,
    )
    const transformedData = transformApiGeographyData(
      rawData,
      'zip_code_tabulation_area',
    )

    transformedData.forEach((record) => {
      record.for_param = `zip%20code%20tabulation%20area:${record.zip_code_tabulation_area}`
      record.in_param = null
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

    await client.query(parentZipCodeTabulationAreaSQL)

    console.log(
      `Seeded ${insertedIds.length} zip code tabulation area record(s) for ${context.year}`,
    )
  },
}
