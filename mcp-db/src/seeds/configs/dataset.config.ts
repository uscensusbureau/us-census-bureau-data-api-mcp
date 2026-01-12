import { Client } from 'pg'

import { getOrCreateYear } from '../../helpers/get-or-create-year.helper.js'
import {
  DatasetRecord,
  parseTemporalRange,
  transformApiDatasetsData,
  TransformedDatasetsArraySchema,
} from '../../schema/dataset.schema.js'
import { SeedConfig } from '../../schema/seed-config.schema.js'

export const DatasetConfig: SeedConfig = {
  url: 'https://api.census.gov/data/',
  table: 'datasets',
  conflictColumn: 'dataset_id',
  dataPath: 'dataset',
  alwaysFetch: true,
  beforeSeed: async (client: Client, rawData: unknown[]): Promise<void> => {
    const transformedData = transformApiDatasetsData(rawData)
    const validatedData = TransformedDatasetsArraySchema.parse(transformedData)

    const processedData: Partial<DatasetRecord>[] = await Promise.all(
      validatedData.map(async (record) => {
        const { c_vintage, temporal, ...datasetFields } = record

        let temporal_start = null
        let temporal_end = null

        if (temporal) {
          const parsed = parseTemporalRange(temporal)
          temporal_start = parsed.temporal_start
          temporal_end = parsed.temporal_end
        }

        if (c_vintage) {
          const yearId = await getOrCreateYear(client, c_vintage)
          return {
            ...datasetFields,
            temporal_start,
            temporal_end,
            year_id: yearId,
          }
        } else {
          console.warn(`No year found for dataset: ${record.dataset_id}`)
        }

        return {
          ...datasetFields,
          temporal_start,
          temporal_end,
        }
      }),
    )

    const deduped = Array.from(
      new Map(processedData.map((item) => [item.dataset_id, item])).values(),
    )

    console.log(
      `Removed ${processedData.length - deduped.length} duplicate dataset_id entries`,
    )

    rawData.length = 0
    rawData.push(...deduped)
  },
}
