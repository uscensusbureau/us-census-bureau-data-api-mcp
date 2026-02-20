import { z } from 'zod'

export const DatasetRecordSchema = z.object({
  name: z.string(),
  description: z.string(),
  dataset_id: z.string(),
  type: z.enum(['aggregate', 'timeseries', 'microdata']),
  year_id: z.number().int().nullable().optional(),
  component_id: z.number().int().nullable().optional(),
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
  type: true,
}).extend({
  type: z.enum(['aggregate', 'timeseries', 'microdata']).optional(),
  c_vintage: z.union([z.number(), z.string()]).optional(),
  temporal: z.string().optional(),
  dataset_param: z.string(),
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
    const parts = temporal.split('/')
    if (parts.length !== 2 || !parts[0]?.trim() || !parts[1]?.trim()) {
      console.warn(
        `Failed to parse temporal string (invalid format): ${temporal}`,
      )
      return { temporal_start: null, temporal_end: null }
    }

    const [start, end] = parts

    const startParts = start.split('-')
    const startYear = Number.parseInt(startParts[0], 10)
    if (Number.isNaN(startYear)) {
      console.warn(`Invalid start year in temporal string: ${temporal}`)
      return { temporal_start: null, temporal_end: null }
    }
    let startMonth = 1
    if (startParts[1]) {
      const parsedStartMonth = Number.parseInt(startParts[1], 10)
      if (Number.isNaN(parsedStartMonth)) {
        console.warn(`Invalid start month in temporal string: ${temporal}`)
        return { temporal_start: null, temporal_end: null }
      }
      startMonth = parsedStartMonth
    }
    const temporal_start = new Date(startYear, startMonth - 1, 1)
    // Parse end date - handle YYYY or YYYY-MM formats
    const endParts = end.split('-')
    const endYear = Number.parseInt(endParts[0], 10)
    if (Number.isNaN(endYear)) {
      console.warn(`Invalid end year in temporal string: ${temporal}`)
      return { temporal_start: null, temporal_end: null }
    }
    let endMonth = 12
    if (endParts[1]) {
      const parsedEndMonth = Number.parseInt(endParts[1], 10)
      if (Number.isNaN(parsedEndMonth)) {
        console.warn(`Invalid end month in temporal string: ${temporal}`)
        return { temporal_start: null, temporal_end: null }
      }
      endMonth = parsedEndMonth
    }
    // Set to last day of the month by subtracting one day from the next month via 0
    const temporal_end = new Date(endYear, endMonth, 0)

    return { temporal_start, temporal_end }
  } catch (error) {
    console.warn(`Failed to parse temporal string: ${temporal}`, error)
    return { temporal_start: null, temporal_end: null }
  }
}

export function determineDatasetType(
  item: ApiDataset,
): 'aggregate' | 'timeseries' | 'microdata' | undefined {
  if (item.c_isAggregate) return 'aggregate'
  if (item.c_isTimeseries) return 'timeseries'
  if (item.c_isMicrodata) return 'microdata'

  return undefined
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
