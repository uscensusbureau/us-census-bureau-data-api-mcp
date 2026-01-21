import { Client } from 'pg'

import { getOrCreateYear } from '../../helpers/get-or-create-year.helper.js'
import { createDatasetTopics } from '../../helpers/create-dataset-topics.helper.js'
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

    // Filter out any items without dataset_id
    const validData = processedData.filter(
      (item): item is Partial<DatasetRecord> & { dataset_id: string } =>
        item.dataset_id !== undefined && item.dataset_id !== '',
    )

    // Check for duplicates
    const duplicateCheck = new Map<string, number>()
    validData.forEach((item) => {
      const count = duplicateCheck.get(item.dataset_id) || 0
      duplicateCheck.set(item.dataset_id, count + 1)
    })

    const duplicates = Array.from(duplicateCheck.entries()).filter(
      ([_, count]) => count > 1,
    )
    if (duplicates.length > 0) {
      console.warn(
        `Found ${duplicates.length} duplicate dataset_id(s); keeping last occurence of each:`,
        duplicates.map(([id, count]) => `${id} (${count} occurrences)`),
      )
    }

    const deduped = Array.from(
      new Map(validData.map((item) => [item.dataset_id, item])).values(),
    )
    rawData.length = 0
    rawData.push(...deduped)
  },
  afterSeed: async (client: Client): Promise<void> => {
    await createDatasetTopics(client)
  },
}
