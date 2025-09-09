import { z } from 'zod'


// Zode schema for the returned dataset
export const AggregatedResultSchema = z.object({
  c_dataset: z.string(),
  c_vintages: z.array(z.number()).optional(),
  title: z.string(),
  description: z.string(),
  c_isAggregate: z.boolean().optional(),
  c_isTimeseries: z.boolean().optional(),
  c_isMicrodata: z.boolean().optional(),
})


// Zod schema for the simplified dataset
export const SimplifiedAPIDatasetSchema = z.object({
  c_dataset: z.string(),
  c_vintage: z.number().optional(),
  title: z.string(),
  description: z.string(),
  c_isAggregate: z.boolean().optional(),
  c_isTimeseries: z.boolean().optional(),
  c_isMicrodata: z.boolean().optional(),
})

export const DatasetSchema = z.object({
  c_vintage: z.number().optional(),
  c_dataset: z.array(z.string()),
  c_geographyLink: z.string(),
  c_tags: z.string().nullable().optional(),
  c_variablesLink: z.string(),
  c_examplesLink: z.string().nullable().optional(),
  c_groupsLink: z.string().nullable().optional(),
  c_sorts_url: z.string().nullable().optional(),
  c_documentationLink: z.string().nullable().optional(),
  c_isMicrodata: z.boolean().optional(),
  c_isTimeseries: z.boolean().optional(),
  c_isAggregate: z.boolean().optional(),
  c_isCube: z.boolean().optional(),
  c_isAvailable: z.boolean(),
  '@type': z.string(),
  title: z.string(),
  accessLevel: z.string(),
  bureauCode: z.array(z.string()),
  description: z.string(),
  distribution: z.array(
    z.object({
      '@type': z.string(),
      accessURL: z.string(),
      description: z.string(),
      format: z.string(),
      mediaType: z.string(),
      title: z.string(),
    }),
  ),
  contactPoint: z.object({
    fn: z.string(),
    hasEmail: z.string(),
  }),
  identifier: z.string(),
  keyword: z.array(z.string()),
  license: z.string(),
  modified: z.string(),
  programCode: z.array(z.string()),
  references: z.array(z.string()),
  spatial: z.string().optional(),
  temporal: z.string().optional(),
  publisher: z.object({
    '@type': z.string(),
    name: z.string(),
    subOrganizationOf: z
      .object({
        '@type': z.string(),
        name: z.string(),
      })
      .optional(),
  }),
})

// Zod schema for the raw data from API
export const AllDatasetMetadataJsonSchema = z.object({
  '@context': z.string(),
  '@id': z.string(),
  '@type': z.string(),
  conformsTo: z.string(),
  describedBy: z.string(),
  dataset: z.array(DatasetSchema),
})

// Infer TypeScript types from Zod schemas
export type SimplifiedAPIDatasetType = z.infer<typeof SimplifiedAPIDatasetSchema>
export type AllDatasetMetadataJsonResponseType = z.infer<typeof AllDatasetMetadataJsonSchema>
export type AggregatedResultType = z.infer<typeof AggregatedResultSchema>
export type DatasetType = z.infer<typeof DatasetSchema>
