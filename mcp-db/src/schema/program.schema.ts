import { z } from 'zod'

export const RawProgramSchema = z.object({
  PROGRAM_STRING: z.string(),
  PROGRAM_LABEL: z.string(),
})

export const RawProgramsArraySchema = z.array(RawProgramSchema)

export const ProgramRecordSchema = z.object({
  acronym: z.string(),
  label: z.string(),
})

export type ProgramRecord = z.infer<typeof ProgramRecordSchema>

export function transformProgramData(rawData: unknown): {
  programs: ProgramRecord[]
} {
  let validated
  try {
    validated = RawProgramsArraySchema.parse(rawData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (Array.isArray(rawData)) {
        rawData.forEach((item, index) => {
          const result = RawProgramSchema.safeParse(item)
          if (!result.success) {
            console.error(`\nRecord ${index} failed:`)
            console.error('Data:', JSON.stringify(item, null, 2))
          }
        })
      }
    }
    throw error
  }

  const uniquePrograms = new Map<string, ProgramRecord>()

  validated.forEach((row) => {
    if (!uniquePrograms.has(row.PROGRAM_STRING)) {
      uniquePrograms.set(row.PROGRAM_STRING, {
        acronym: row.PROGRAM_STRING,
        label: row.PROGRAM_LABEL,
      })
    }
  })

  return {
    programs: Array.from(uniquePrograms.values()),
  }
}
