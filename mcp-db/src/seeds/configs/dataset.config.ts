import { Client } from 'pg'

import { getOrCreateYear } from '../../helpers/get-or-create-year.helper.js'
import {
  DatasetRecord,
  transformApiDatasetsData,
  TransformedDatasetsArraySchema,
} from '../../schema/dataset.schema.js'
import { SeedConfig } from '../../schema/seed-config.schema.js'

export const DatasetConfig: SeedConfig = {
  url: 'https://api.census.gov/data/',
  table: 'datasets',
  conflictColumn: 'dataset_id',
  dataPath: 'dataset',
  beforeSeed: async (client: Client, rawData: unknown[]): Promise<void> => {
    const transformedData = transformApiDatasetsData(rawData)
    const validatedData = TransformedDatasetsArraySchema.parse(transformedData)

    const processedData: Partial<DatasetRecord>[] = await Promise.all(
      validatedData.map(async (record) => {
        const { c_vintage, ...datasetFields } = record

        if (c_vintage) {
          const yearId = await getOrCreateYear(client, c_vintage)
          return { ...datasetFields, year_id: yearId }
        }

        return datasetFields
      }),
    )

    rawData.length = 0
    rawData.push(...processedData)
  },
}
