import { z } from 'zod'

export const RawComponentSchema = z.object({
  COMPONENT_STRING: z.string(),
  COMPONENT_LABEL: z.string(),
  COMPONENT_DESCRIPTION: z.string(),
  API_SHORT_NAME: z.string(),
  PROGRAM_STRING: z.string(),
})

export const RawComponentsArraySchema = z.array(RawComponentSchema)

export const ComponentRecordSchema = z.object({
  component_id: z.string(),
  label: z.string(),
  description: z.string(),
  api_endpoint: z.string(),
  program_id: z.number(),
})

export type ComponentRecord = z.infer<typeof ComponentRecordSchema>

export function transformComponentData(
  rawData: unknown,
  programIdMap: Map<string, number>,
): ComponentRecord[] {
  let validated
  try {
    validated = RawComponentsArraySchema.parse(rawData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (Array.isArray(rawData)) {
        rawData.forEach((item, index) => {
          const result = RawComponentSchema.safeParse(item)
          if (!result.success) {
            console.error(`\nRecord ${index} failed:`)
            console.error('Data:', JSON.stringify(item, null, 2))
          }
        })
      }
    }
    throw error
  }

  if (programIdMap.size === 0) {
    throw new Error(
      'transformComponentData called with empty programIdMap — ensure programs are seeded before components',
    )
  }

  const uniqueComponents = new Map<string, ComponentRecord>()
  const missingPrograms = new Set<string>()

  validated.forEach((row) => {
    const programId = programIdMap.get(row.PROGRAM_STRING)
    if (!programId) {
      missingPrograms.add(row.PROGRAM_STRING)
      return
    }

    if (!uniqueComponents.has(row.COMPONENT_STRING)) {
      uniqueComponents.set(row.COMPONENT_STRING, {
        component_id: row.COMPONENT_STRING,
        label: row.COMPONENT_LABEL,
        description: row.COMPONENT_DESCRIPTION,
        api_endpoint: row.API_SHORT_NAME,
        program_id: programId,
      })
    }
  })

  if (missingPrograms.size > 0) {
    throw new Error(
      `Components reference programs not found in programIdMap: ${[...missingPrograms].join(', ')}`,
    )
  }

  return Array.from(uniqueComponents.values())
}
