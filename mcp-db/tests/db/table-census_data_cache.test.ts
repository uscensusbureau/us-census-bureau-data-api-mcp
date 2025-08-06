import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client, QueryResult } from 'pg'

import { dbConfig } from '../helpers/database-config'

const client = new Client(dbConfig)

describe('Census Data Cache Table', () => {
  beforeAll(async () => {
    await client.connect()
  })

  afterAll(async () => {
    await client.end()
  })

  it('should have census_data_cache table', async () => {
    const result: QueryResult<{ exists: boolean }> = await client.query(`
	    SELECT EXISTS (
	      SELECT FROM information_schema.tables 
	      WHERE table_schema = 'public' 
	      AND table_name = 'census_data_cache'
	    );
	  `)

    expect(result.rows[0].exists).toBe(true)
  })
})
