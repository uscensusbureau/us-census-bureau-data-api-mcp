import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest'
import { Client } from 'pg'

import { cleanupWithRetry } from '../test-helpers/database-cleanup'
import { dbConfig } from '../test-helpers/database-config'
import { getOrCreateYear } from '../../src/helpers/get-or-create-year.helper'

describe('getOrCreateYear', () => {
  let client: Client

  const testId = `${process.pid}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  const testSchema = `test_schema_${testId}`

  beforeAll(async () => {
    client = new Client(dbConfig)
    await client.connect()

    try {
      //Using a separate schema here due to conflicts with other tests
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${testSchema}`)
      await client.query(`SET search_path TO ${testSchema}`)

      await client.query(`
                CREATE TABLE years (
                    id SERIAL PRIMARY KEY,
                    year INTEGER NOT NULL UNIQUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            `)
    } catch (error) {
      console.log('Table setup failed:', error)
      throw error
    }
  })

  afterAll(async () => {
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`)
    } catch (error) {
      console.log('Cleanup failed:', error)
    }
    await client.end()
  })

  beforeEach(async () => {
    await cleanupWithRetry(client, [`${testSchema}.years`])
  })

  it('creates a year record when none exists', async () => {
    const yearValue = 2020

    const createYear = await getOrCreateYear(client, yearValue)

    expect(createYear).toBeDefined()

    const query = await client.query<{
      id: number
      year: number
    }>(`SELECT id, year FROM years WHERE id = $1`, [createYear])

    expect(query.rows.length).toBe(1)
    expect(query.rows[0].year).toBe(yearValue)
    expect(createYear).toBe(query.rows[0].id)
  })

  it('returns the existing year id when the year already exists', async () => {
    const yearValue = 2010

    const insertResult = await client.query<{ id: number }>(
      `INSERT INTO years (year) VALUES ($1) RETURNING id`,
      [yearValue],
    )
    const existingYearId = insertResult.rows[0].id

    const returnedYearId = await getOrCreateYear(client, yearValue)

    expect(returnedYearId).toBe(existingYearId)

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM years WHERE year = $1`,
      [yearValue],
    )
    expect(parseInt(countResult.rows[0].count)).toBe(1)
  })
})
