import { z } from 'zod'

export const DatasetRecordSchema = z.object({
  name: z.string(),
  description: z.string(),
  dataset_id: z.string(),
  dataset_param: z.string(), // Required, not optional
  year_id: z.number().int(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type DatasetRecord = z.infer<typeof DatasetRecordSchema>

export const TransformedDatasetSchema = DatasetRecordSchema.omit({
  year_id: true,
}).extend({
  c_vintage: z.union([z.number(), z.string()]).optional(),
})

export type TransformedDataset = z.infer<typeof TransformedDatasetSchema>

export const TransformedDatasetsArraySchema = z.array(TransformedDatasetSchema)

export interface ApiDataset {
  title: string
  identifier: string
  description: string
  c_dataset?: string[]
  c_vintage?: number | string
  [key: string]: unknown
}

export interface ApiResponse {
  dataset: ApiDataset[]
  [key: string]: unknown
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
        item.c_dataset.length > 0 // Ensure c_dataset is not empty
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
        c_vintage: item.c_vintage,
      }
    })
}
