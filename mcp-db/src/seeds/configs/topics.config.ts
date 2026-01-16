import { Client } from 'pg'

import { SeedConfig } from '../../schema/seed-config.schema.js'
import { transformTopicData } from '../../schema/topic.schema.js'

export const TopicsConfig: SeedConfig = {
  file: 'topics.json',
  table: 'topics',
  dataPath: 'topics',
  conflictColumn: 'topic_string',
  beforeSeed: (client: Client, rawData: unknown[]): void => {
    // Validate and Map Raw Topic Data to Topic fields
    const transformedData = transformTopicData(rawData)

    rawData.length = 0
    rawData.push(...transformedData)
  },
  afterSeed: async (client: Client): Promise<void> => {
    // Assign Topic Parent IDs Based on parent_topic_string
    await client.query(`
      UPDATE topics 
      SET parent_topic_id = (
        SELECT id FROM topics parent 
        WHERE parent.topic_string = topics.parent_topic_string
      )
      WHERE parent_topic_string IS NOT NULL;
    `)
  },
}
