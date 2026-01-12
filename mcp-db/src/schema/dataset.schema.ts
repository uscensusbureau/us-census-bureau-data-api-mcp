import { z } from 'zod'

export const DatasetRecordSchema = z.object({
  name: z.string(),
  description: z.string(),
  dataset_id: z.string(),
  dataset_param: z.string(),
  type: z.enum(['aggregate', 'timeseries', 'microdata']),
  year_id: z.number().int(),
  temporal_start: z.date().nullable().optional(),
  temporal_end: z.date().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type DatasetRecord = z.infer<typeof DatasetRecordSchema>

export const TransformedDatasetSchema = DatasetRecordSchema.omit({
  temporal_start: true,
  temporal_end: true,
  year_id: true,
}).extend({
  c_vintage: z.union([z.number(), z.string()]).optional(),
  temporal: z.string().optional(),
})

export type TransformedDataset = z.infer<typeof TransformedDatasetSchema>

export const TransformedDatasetsArraySchema = z.array(TransformedDatasetSchema)

export interface ApiDataset {
  title: string
  identifier: string
  description: string
  c_dataset?: string[]
  c_vintage?: number | string
  temporal?: string
  c_isAggregate?: boolean
  c_isTimeseries?: boolean
  c_isMicrodata?: boolean
  [key: string]: unknown
}

export interface ApiResponse {
  dataset: ApiDataset[]
  [key: string]: unknown
}

export function parseTemporalRange(temporal: string): {
  temporal_start: Date | null
  temporal_end: Date | null
} {
  try {
    const [start, end] = temporal.split('/')

    const startParts = start.split('-')
    const startYear = parseInt(startParts[0])
    const startMonth = startParts[1] ? parseInt(startParts[1]) : 1
    const temporal_start = new Date(startYear, startMonth - 1, 1)

    // Parse end date - handle YYYY or YYYY-MM formats
    const endParts = end.split('-')
    const endYear = parseInt(endParts[0])
    const endMonth = endParts[1] ? parseInt(endParts[1]) : 12
    // Set to last day of the month
    const temporal_end = new Date(endYear, endMonth, 0)

    return { temporal_start, temporal_end }
  } catch (error) {
    console.warn(`Failed to parse temporal string: ${temporal}`, error)
    return { temporal_start: null, temporal_end: null }
  }
}

export function determineDatasetType(
  item: ApiDataset,
): 'aggregate' | 'timeseries' | 'microdata' {
  if (item.c_isAggregate) return 'aggregate'
  if (item.c_isTimeseries) return 'timeseries'
  if (item.c_isMicrodata) return 'microdata'

  throw new Error(`Dataset ${item.identifier} has no type flag set`)
}

export const transformApiDatasetsData = (
  rawData: unknown[],
): TransformedDataset[] => {
  return rawData
    .filter((item): item is ApiDataset => {
      return (
        typeof item === 'object' &&
        item !== null &&
        'title' in item &&
        'identifier' in item &&
        'description' in item &&
        'c_dataset' in item &&
        Array.isArray(item.c_dataset) &&
        item.c_dataset.length > 0
      )
    })
    .map((item) => {
      const datasetId = item.identifier.split('/').pop() || item.identifier
      const datasetParam = item.c_dataset!.join('/')

      return {
        name: item.title,
        dataset_id: datasetId,
        dataset_param: datasetParam,
        description: item.description,
        type: determineDatasetType(item),
        c_vintage: item.c_vintage,
        temporal: item.temporal,
      }
    })
}
