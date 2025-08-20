import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest'
import { Client } from 'pg'

import { dbConfig } from '../helpers/database-config'
import { createGeographyYear } from '../../src/helpers/geography-years.helper'

describe('createGeographyYear', () => {
  let client: Client

  beforeAll(async () => {
    client = new Client(dbConfig)
    await client.connect()

    try {
      await client.query('DROP TABLE IF EXISTS geography_years CASCADE')

      await client.query(`
        CREATE TABLE geography_years (
          id SERIAL PRIMARY KEY,
          geography_id INTEGER NOT NULL,
          year_id INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(geography_id, year_id)
        );
      `)
    } catch (error) {
      console.log('Table setup failed:', error)
      throw error
    }
  })

  afterAll(async () => {
    try {
      await client.query('DROP TABLE IF EXISTS geography_years CASCADE')
    } catch (error) {
      console.log('Cleanup failed:', error)
    }
    await client.end()
  })

  beforeEach(async () => {
    await client.query(
      'TRUNCATE TABLE geography_years RESTART IDENTITY CASCADE',
    )
  })

  it('creates a geography_years record', async () => {
    const geographyID = 1
    const yearID = 2

    const result = await createGeographyYear(client, geographyID, yearID)

    const query = await client.query<{
      geographyID: number
      yearID: number
    }>(
      `
      SELECT geography_id, year_id
      FROM geography_years
      WHERE geography_id = $1 AND year_id = $2
    `,
      [geographyID, yearID],
    )

    expect(query.rows).toHaveLength(1)
    expect(query.rows[0].geography_id).toBe(geographyID)
    expect(query.rows[0].year_id).toBe(yearID)
    expect(result.created).toBe(true)
  })

  it('handles duplicate relationships gracefully', async () => {
    const geographyID = 1
    const yearID = 2

    const firstResult = await createGeographyYear(client, geographyID, yearID)
    expect(firstResult.created).toBe(true)

    const secondResult = await createGeographyYear(client, geographyID, yearID)
    expect(secondResult.created).toBe(false)

    const query = await client.query(
      `
      SELECT COUNT(*) as count 
      FROM geography_years 
      WHERE geography_id = $1 AND year_id = $2
    `,
      [geographyID, yearID],
    )

    expect(parseInt(query.rows[0].count)).toBe(1)
  })

  it('handles invalid input gracefully', async () => {
    await expect(
      createGeographyYear(client, null as unknown, 1),
    ).rejects.toThrow()
  })
})
