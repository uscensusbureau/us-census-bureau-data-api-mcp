import { z } from 'zod'
import { titleCase } from 'title-case'

export const RawConceptSchema = z.object({
  CONCEPT_LABEL: z.string().transform((val) => titleCase(val.toLowerCase())),
  CONCEPT_STRING: z.string(),
  DATASET_STRING: z.string(),
})

export const RawConceptsArraySchema = z.array(RawConceptSchema)

export const DataTableRecordSchema = z.object({
  data_table_id: z.string(),
  label: z.string(),
})

export type DataTableRecord = z.infer<typeof DataTableRecordSchema>

export const DataTableDatasetCapturedSchema = z.object({
  data_table_id: z.string(),
  dataset_id: z.string(),
  label: z.string(),
})

export type DataTableDatasetRecord = z.infer<
  typeof DataTableDatasetCapturedSchema
>

export const DataTableDatasetDbSchema = z.object({
  data_table_id: z.number(),
  dataset_id: z.number(),
  label: z.string(),
})

export type DataTableDatasetDbRecord = z.infer<typeof DataTableDatasetDbSchema>

export function transformDataTableData(rawData: unknown): {
  dataTables: DataTableRecord[]
  relationships: DataTableDatasetRecord[]
} {
  let validated
  try {
    validated = RawConceptsArraySchema.parse(rawData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (Array.isArray(rawData)) {
        rawData.forEach((item, index) => {
          const result = RawConceptSchema.safeParse(item)
          if (!result.success) {
            console.error(`\nRecord ${index} failed:`)
            console.error('Data:', JSON.stringify(item, null, 2))
          }
        })
      }
    }
    throw error
  }

  // Extract unique data tables
  const uniqueTables = new Map<string, DataTableRecord>()
  const relationships: DataTableDatasetRecord[] = []

  validated.forEach((concept) => {
    const dataTable: DataTableRecord = {
      data_table_id: concept.CONCEPT_STRING,
      label: concept.CONCEPT_LABEL,
    }

    if (!uniqueTables.has(dataTable.data_table_id)) {
      uniqueTables.set(dataTable.data_table_id, dataTable)
    }

    relationships.push({
      data_table_id: concept.CONCEPT_STRING,
      dataset_id: concept.DATASET_STRING,
      label: concept.CONCEPT_LABEL,
    })
  })

  return {
    dataTables: Array.from(uniqueTables.values()),
    relationships,
  }
}
