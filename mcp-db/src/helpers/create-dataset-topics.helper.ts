import { promises as fs } from 'fs'
import path from 'path'
import { Client } from 'pg'
import { parseCSVLine } from './parse-csv-line.helper.js'

export async function createDatasetTopics(client: Client): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'dataset_topics.csv')

    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.trim().split('\n')
    const dataLines = lines.slice(1)

    console.log(
      `Seeding dataset-topic relationships from ${dataLines.length} datasets...`,
    )

    // Fetch all datasets and topics upfront
    const datasetsResult = await client.query(
      'SELECT id, dataset_id FROM datasets',
    )
    const datasetsMap = new Map(
      datasetsResult.rows.map((row) => [row.dataset_id, row.id]),
    )

    const topicsResult = await client.query(
      'SELECT id, topic_string FROM topics',
    )
    const topicsMap = new Map(
      topicsResult.rows.map((row) => [row.topic_string, row.id]),
    )

    // Build all relationships
    const relationships: Array<[number, number]> = []
    let datasetsSkipped = 0
    let topicsSkipped = 0

    for (const line of dataLines) {
      const parsed = parseCSVLine(line)

      if (!parsed || parsed.length !== 2) {
        console.warn(`Skipping malformed CSV line: ${line}`)
        continue
      }

      const datasetId = parsed[0]
      const topicString = parsed[1]
      const topics = topicString
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      if (topics.length === 0) {
        console.warn(`No topics found for dataset: ${datasetId}, skipping...`)
        continue
      }

      const datasetDbId = datasetsMap.get(datasetId)
      if (!datasetDbId) {
        console.warn(`Dataset not found: ${datasetId}, skipping...`)
        datasetsSkipped++
        continue
      }

      for (const topicName of topics) {
        const topicId = topicsMap.get(topicName)
        if (!topicId) {
          console.warn(
            `Topic "${topicName}" not found for dataset ${datasetId}, skipping...`,
          )
          topicsSkipped++
          continue
        }

        relationships.push([datasetDbId, topicId])
      }
    }

    // Bulk insert all relationships
    if (relationships.length > 0) {
      const values = relationships
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
        .join(', ')
      const query = `
        INSERT INTO dataset_topics (dataset_id, topic_id)
        VALUES ${values}
        ON CONFLICT (dataset_id, topic_id) DO NOTHING
      `

      await client.query(query, relationships.flat())
    }

    console.log(
      `Dataset-topic relationships seeded: ${relationships.length} inserted, ` +
        `${datasetsSkipped} datasets skipped, ${topicsSkipped} topics skipped`,
    )
  } catch (error) {
    console.error('Error seeding dataset-topic relationships:', error)
    throw error
  }
}
