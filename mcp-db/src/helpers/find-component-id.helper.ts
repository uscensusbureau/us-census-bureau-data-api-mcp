import { Client } from 'pg'

export async function findComponentIdHelper(
  client: Client,
  apiEndpoint: string,
): Promise<number | null> {
  const result = await client.query(
    `SELECT id FROM components WHERE api_endpoint = $1 LIMIT 1`,
    [apiEndpoint],
  )

  if (result.rowCount === 0) {
    console.warn(`No component found for api_endpoint: ${apiEndpoint}`)
    return null
  }

  return result.rows[0].id
}
