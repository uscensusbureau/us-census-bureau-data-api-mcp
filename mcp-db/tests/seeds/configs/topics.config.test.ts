import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Client } from 'pg'

// Mock the transform function before importing the config
vi.mock('../../../src/schema/topic.schema', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    transformTopicData: vi.fn(),
  }
})

import { TopicsConfig } from '../../../src/seeds/configs/topics.config'
import { transformTopicData } from '../../../src/schema/topic.schema'
import { normalizeSQL } from '../../test-helpers/normalize-sql'

const rawTopicData = [
  {
    topic_string: 'AGE',
    name: 'Age and Sex',
    description: 'Demographic data about age and sex',
    parent_topic_string: null,
  },
  {
    topic_string: 'SEX_BY_AGE',
    name: 'Sex by Age',
    description: 'Detailed breakdown of population by sex and age',
    parent_topic_string: 'AGE',
  },
]

const transformedData = [
  {
    topic_string: 'AGE',
    name: 'Age and Sex',
    description: 'Demographic data about age and sex',
    parent_topic_string: undefined,
  },
  {
    topic_string: 'SEX_BY_AGE',
    name: 'Sex by Age',
    description: 'Detailed breakdown of population by sex and age',
    parent_topic_string: 'AGE',
  },
]

describe('Topics Config', () => {
  let mockClient: Partial<Client>

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    }
  })

  afterEach(() => {
    vi.mocked(transformTopicData).mockClear()
  })

  it('should have valid configuration structure', () => {
    expect(TopicsConfig).toBeDefined()
    expect(TopicsConfig.file).toBe('topics.json')
    expect(TopicsConfig.table).toBe('topics')
    expect(TopicsConfig.dataPath).toBe('topics')
    expect(TopicsConfig.conflictColumn).toBe('topic_string')
    expect(TopicsConfig.beforeSeed).toBeDefined()
    expect(TopicsConfig.afterSeed).toBeDefined()
  })

  describe('beforeSeed', () => {
    it('calls transformTopicData with correct raw data', () => {
      const dataCopy = [...rawTopicData]

      vi.mocked(transformTopicData).mockReturnValue(transformedData)

      TopicsConfig.beforeSeed!(mockClient as Client, dataCopy)

      expect(transformTopicData).toHaveBeenCalledTimes(1)
      expect(transformTopicData).toHaveBeenCalledWith(dataCopy)
    })

    it('transforms and replaces data in-place', () => {
      const dataCopy = [...rawTopicData]

      vi.mocked(transformTopicData).mockReturnValue(transformedData)

      TopicsConfig.beforeSeed!(mockClient as Client, dataCopy)

      expect(dataCopy).toHaveLength(transformedData.length)
      expect(dataCopy[0]).toEqual(transformedData[0])
      expect(dataCopy[1]).toEqual(transformedData[1])
    })

    it('clears original data before pushing transformed data', () => {
      const dataCopy = [...rawTopicData]
      const lengthSpy = vi.fn()

      vi.mocked(transformTopicData).mockImplementation((data) => {
        lengthSpy((data as unknown[]).length)
        return transformedData
      })

      TopicsConfig.beforeSeed!(mockClient as Client, dataCopy)

      // Verify data was passed with original length
      expect(lengthSpy).toHaveBeenCalledWith(rawTopicData.length)

      // Verify final data matches transformed data
      expect(dataCopy).toEqual(transformedData)
    })
  })

  describe('afterSeed', () => {
    it('should update parent_topic_id based on parent_topic_string', async () => {
      await TopicsConfig.afterSeed!(mockClient as Client)

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>
      expect(mockQuery).toHaveBeenCalledTimes(1)

      const actualSQL = mockQuery.mock.calls[0][0]
      const expectedSQL = `
        UPDATE topics 
        SET parent_topic_id = (
          SELECT id FROM topics parent 
          WHERE parent.topic_string = topics.parent_topic_string
        )
        WHERE parent_topic_string IS NOT NULL;
      `

      expect(normalizeSQL(actualSQL)).toBe(normalizeSQL(expectedSQL))
    })

    it('should handle query execution', async () => {
      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>
      mockQuery.mockResolvedValueOnce(undefined)

      await expect(
        TopicsConfig.afterSeed!(mockClient as Client),
      ).resolves.toBeUndefined()

      expect(mockQuery).toHaveBeenCalledTimes(1)
    })
  })
})
