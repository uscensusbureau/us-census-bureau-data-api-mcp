import { Client } from 'pg'

export const getOrCreateYear = async (
  client: Client,
  vintage: number | string,
): Promise<number> => {
  const year = typeof vintage === 'string' ? parseInt(vintage, 10) : vintage

  if (isNaN(year)) {
    throw new Error(`Invalid year value: ${vintage}`)
  }

  const result = await client.query(
    `
      INSERT INTO years (year) VALUES ($1) 
      ON CONFLICT (year) 
      DO UPDATE SET year = EXCLUDED.year
      RETURNING id
    `,
    [year],
  )

  return result.rows[0].id
}
