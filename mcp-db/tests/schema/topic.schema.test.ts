import { describe, expect, it } from 'vitest'
import {
  RawTopicsArraySchema,
  RawTopicSchema,
  TopicMappings,
  TopicRecordSchema,
  flexibleSnakeCaseString,
  transformTopicData,
} from '../../src/schema/topic.schema'

const invalidRawTopicData = {
  TOPIC_LABEL: 'Sub Population',
  TOPIC_STRING: 'SUB POPULATION',
  PARENT_TOPIC_STRING: 'POPULATION',
  DESCRIPTION: 'Population data about the United States.',
}

const validRawTopicData = {
  TOPIC_LABEL: 'Sub Population',
  TOPIC_STRING: 'Sub_Population',
  PARENT_TOPIC_STRING: 'Population',
  DESCRIPTION: 'Population data about the United States.',
}

describe('TopicSchema', () => {
  describe('RawTopicsArraySchema,', () => {
    it('should validate array of raw topics', () => {
      const result = RawTopicsArraySchema.safeParse([validRawTopicData])
      expect(result.success).toBe(true)
    })

    it('should invalidate array of incorrect raw topics', () => {
      const result = RawTopicsArraySchema.safeParse([invalidRawTopicData])
      expect(result.success).toBe(false)
    })
  })

  describe('RawTopicSchema', () => {
    it('should validate topics.json fields', () => {
      const result = RawTopicSchema.safeParse(validRawTopicData)
      expect(result.success).toBe(true)
    })

    it('should invalidate incorrect topics.json fields', () => {
      const result = RawTopicSchema.safeParse(invalidRawTopicData)
      expect(result.success).toBe(false)
    })
  })

  describe('TopicMappings', () => {
    it('should include the expecting mappings', () => {
      expect(TopicMappings).toBeTypeOf('object')
      expect(TopicMappings).toMatchObject({
        TOPIC_LABEL: 'name',
        TOPIC_STRING: 'topic_string',
        PARENT_TOPIC_STRING: 'parent_topic_string',
        DESCRIPTION: 'description',
      })
    })
  })

  describe('TopicRecordSchema', () => {
    it('validates a complete record', () => {
      const topicRecord = {
        name: 'Population',
        topic_string: 'POPULATION',
        description: 'Population data about the United States.',
      }

      const result = TopicRecordSchema.safeParse(topicRecord)

      expect(result.success).toBe(true)
    })

    it('invalidates an incomplete record', () => {
      const topicRecord = {
        name: 'Population',
        description: 'Population data about the United States.',
      }

      const result = TopicRecordSchema.safeParse(topicRecord)
      expect(result.success).toBe(false)
    })
  })

  describe('transformTopicData', () => {
    it('returns a record', () => {
      expect(transformTopicData([validRawTopicData])).toEqual([
        {
          name: 'Sub Population',
          topic_string: 'Sub_Population',
          parent_topic_string: 'Population',
          description: 'Population data about the United States.',
        },
      ])
    })
  })

  describe('flexibleSnakeCaseString', () => {
    it('should validate upper snake case fields', () => {
      expect(flexibleSnakeCaseString.safeParse('A_Correct_Topic').success).toBe(
        true,
      )
      expect(flexibleSnakeCaseString.safeParse('Topic').success).toBe(true)
      expect(
        flexibleSnakeCaseString.safeParse('Correct_and_More_Correct_Topic')
          .success,
      ).toBe(true)
      expect(flexibleSnakeCaseString.safeParse('A Failing Topic').success).toBe(
        false,
      )
      expect(
        flexibleSnakeCaseString.safeParse('A%20Failing%20Topic').success,
      ).toBe(false)
    })
  })
})
