import { Client } from 'pg'

export async function findComponentIdHelper(
  client: Client,
  datasetParam: string,
): Promise<number | null> {
  const result = await client.query(
    `SELECT id FROM components WHERE $1 LIKE api_endpoint || '%' LIMIT 1`,
    [datasetParam],
  )

  if (result.rowCount === 0) {
    console.warn(`No component found for dataset_param: ${datasetParam}`)
    return null
  }

  return result.rows[0].id
}
