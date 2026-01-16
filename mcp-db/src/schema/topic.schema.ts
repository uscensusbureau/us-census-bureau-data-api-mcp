import { z } from 'zod'

export const flexibleSnakeCaseString = z
  .string()
  .regex(
    /^[A-Za-z0-9]+(_[A-Za-z0-9]+)*$/,
    'Must be alphanumeric segments separated by underscores (e.g., snake_case, UPPER_SNAKE_CASE, or Mixed_Case; letters, numbers, and underscores only)',
  )

export const RawTopicSchema = z.object({
  TOPIC_STRING: flexibleSnakeCaseString,
  TOPIC_LABEL: z.string(),
  PARENT_TOPIC_STRING: flexibleSnakeCaseString.optional(),
  DESCRIPTION: z.string(),
})

export const RawTopicsArraySchema = z.array(RawTopicSchema)

export const TopicRecordSchema = z.object({
  name: z.string(),
  topic_string: flexibleSnakeCaseString,
  parent_topic_string: flexibleSnakeCaseString.optional(),
  description: z.string(),
})

export type TopicRecord = z.infer<typeof TopicRecordSchema>

export const TopicMappings: Record<string, keyof TopicRecord> = {
  TOPIC_STRING: 'topic_string',
  TOPIC_LABEL: 'name',
  PARENT_TOPIC_STRING: 'parent_topic_string',
  DESCRIPTION: 'description',
}

export function transformTopicData(rawData: unknown): TopicRecord[] {
  let validated
  try {
    validated = RawTopicsArraySchema.parse(rawData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Log which specific records failed
      if (Array.isArray(rawData)) {
        rawData.forEach((item, index) => {
          const result = RawTopicSchema.safeParse(item)
          if (!result.success) {
            console.error(`\nRecord ${index} failed:`)
            console.error('Data:', JSON.stringify(item, null, 2))
          }
        })
      }
    }
    throw error
  }

  return validated.map((topic) => {
    const record: Partial<TopicRecord> = {}

    Object.entries(TopicMappings).forEach(([sourceKey, targetKey]) => {
      const value = topic[sourceKey as keyof typeof topic]
      if (value !== undefined) {
        record[targetKey] = value
      }
    })

    return record as TopicRecord
  })
}
