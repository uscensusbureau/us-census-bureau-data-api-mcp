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

/**
 * Parses a temporal range string from the Census API into start and end Date objects.
 *
 * @param temporal - A temporal range string in the format 'YYYY/YYYY' or 'YYYY-MM/YYYY-MM',
 *                   where the start and end dates are separated by a forward slash.
 *                   Examples: '2010/2020', '2015-01/2020-12'
 * @returns An object containing:
 *          - temporal_start: Date object representing the first day of the start period, or null if parsing fails
 *          - temporal_end: Date object representing the last day of the end period, or null if parsing fails
 *
 * @remarks
 * - For YYYY format, defaults to January 1 for start date and December 31 for end date
 * - For YYYY-MM format, uses the first day of the month for start date and last day of the month for end date
 * - If parsing fails for any reason, logs a warning to console and returns null for both dates
 *
 * @example
 * parseTemporalRange('2010/2020')
 * // Returns: { temporal_start: Date(2010, 0, 1), temporal_end: Date(2020, 11, 31) }
 *
 * @example
 * parseTemporalRange('2015-06/2020-12')
 * // Returns: { temporal_start: Date(2015, 5, 1), temporal_end: Date(2020, 11, 31) }
 */
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
