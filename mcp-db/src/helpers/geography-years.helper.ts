import { Client } from 'pg'

export const createGeographyYear = async (
  client: Client,
  geography_id: number,
  year_id: number,
): Promise<{ created: boolean }> => {
  try {
    const result = await client.query(
      `
  		  INSERT INTO geography_years (geography_id, year_id)
  		  VALUES ($1, $2)
  		  ON CONFLICT (geography_id, year_id) 
  		  DO NOTHING
  		  RETURNING *
		  `,
      [geography_id, year_id],
    )

    return { created: !!result.rowCount }
  } catch (error) {
    console.error('Failed to create geography-year relationship:', error)
    throw error
  }
}
