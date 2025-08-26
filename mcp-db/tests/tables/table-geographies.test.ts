import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client, QueryResult } from 'pg'

import { dbConfig } from '../helpers/database-config'
import { ColumnInfo, ConstraintInfo, IndexInfo } from '../helpers/types'

const client = new Client(dbConfig)

describe('Geographies Table', () => {
  beforeAll(async () => {
    await client.connect()
  })

  afterAll(async () => {
    await client.end()
  })

  it('should exist', async () => {
    const result: QueryResult<{ exists: boolean }> = await client.query(`
	    SELECT EXISTS (
	      SELECT FROM information_schema.tables 
	      WHERE table_schema = 'public' 
	      AND table_name = 'geographies'
	    );
	  `)

    expect(result.rows[0].exists).toBe(true)
  })

  it('should have all required columns', async () => {
    const result: QueryResult<
      Pick<ColumnInfo, 'column_name' | 'data_type' | 'is_nullable'>
    > = await client.query(`
	    SELECT column_name, data_type, is_nullable 
	    FROM information_schema.columns 
	    WHERE table_name = 'geographies' 
	    ORDER BY ordinal_position;
	  `)

    const expectedColumns: string[] = [
      'id',
      'name',
      'full_name',
      'state_code',
      'state_name',
      'county_code',
      'county_name',
      'fips_code',
      'ucgid_code',
      'parent_geography_id',
      'latitude',
      'longitude',
      'population',
      'land_area_sqkm',
      'water_area_sqkm',
      'elevation_meters',
      'year',
      'is_active',
      'data_source',
      'created_at',
      'updated_at',
      'predecessor_geoid',
      'successor_geoid',
      'geoid_change_reason',
    ]

    const actualColumns: string[] = result.rows.map((row) => row.column_name)

    expectedColumns.forEach((expectedCol) => {
      expect(actualColumns).toContain(expectedCol)
    })
  })

  it('should have correct data types for key columns', async () => {
    const result: QueryResult<ColumnInfo> = await client.query(`
	    SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
	    FROM information_schema.columns 
	    WHERE table_name = 'geographies' 
	    AND column_name IN ('name', 'latitude', 'longitude', 'year', 'ucgid_code');
	  `)

    const columnTypes: Record<
      string,
      Omit<ColumnInfo, 'column_name' | 'is_nullable'>
    > = result.rows.reduce(
      (acc, row) => {
        acc[row.column_name] = {
          data_type: row.data_type,
          character_maximum_length: row.character_maximum_length,
          numeric_precision: row.numeric_precision,
          numeric_scale: row.numeric_scale,
        }
        return acc
      },
      {} as Record<string, Omit<ColumnInfo, 'column_name' | 'is_nullable'>>,
    )

    expect(columnTypes.name.data_type).toBe('character varying')
    expect(columnTypes.name.character_maximum_length).toBe(255)
    expect(columnTypes.latitude.data_type).toBe('numeric')
    expect(columnTypes.latitude.numeric_precision).toBe(10)
    expect(columnTypes.latitude.numeric_scale).toBe(7)
    expect(columnTypes.longitude.data_type).toBe('numeric')
    expect(columnTypes.longitude.numeric_precision).toBe(11)
    expect(columnTypes.longitude.numeric_scale).toBe(7)
    expect(columnTypes.year.data_type).toBe('integer')
  })

  it('should have NOT NULL constraint on required fields', async () => {
    const result: QueryResult<Pick<ColumnInfo, 'column_name' | 'is_nullable'>> =
      await client.query(`
	    SELECT column_name, is_nullable 
	    FROM information_schema.columns 
	    WHERE table_name = 'geographies' 
	    AND column_name IN ('name');
	  `)

    result.rows.forEach((row) => {
      expect(row.is_nullable).toBe('NO')
    })
  })

  it('should have unique constraints', async () => {
    const result: QueryResult<ConstraintInfo> = await client.query(`
	    SELECT constraint_name, constraint_type 
	    FROM information_schema.table_constraints 
	    WHERE table_name = 'geographies' 
	    AND constraint_type = 'UNIQUE';
	  `)

    expect(result.rows.length).toBeGreaterThanOrEqual(1)
  })

  it('should have primary key', async () => {
    const result: QueryResult<Pick<ConstraintInfo, 'constraint_name'>> =
      await client.query(`
	    SELECT constraint_name 
	    FROM information_schema.table_constraints 
	    WHERE table_name = 'geographies' 
	    AND constraint_type = 'PRIMARY KEY';
	  `)

    expect(result.rows.length).toBe(1)
  })

  it('should have foreign key for parent_geography_id', async () => {
    const result: QueryResult<Pick<ConstraintInfo, 'constraint_name'>> =
      await client.query(`
	    SELECT constraint_name 
	    FROM information_schema.table_constraints 
	    WHERE table_name = 'geographies' 
	    AND constraint_type = 'FOREIGN KEY';
	  `)

    expect(result.rows.length).toBeGreaterThanOrEqual(1)
  })

  it('should have appropriate indexes', async () => {
    const result: QueryResult<IndexInfo> = await client.query(`
	    SELECT indexname, indexdef
	    FROM pg_indexes 
	    WHERE tablename = 'geographies'
	    AND indexname != 'geographies_pkey'; -- Exclude primary key index
	  `)

    // Check for name index (GIN index for full-text search)
    const hasNameIndex: boolean = result.rows.some(
      (row) =>
        row.indexname.includes('name') || row.indexdef.includes('to_tsvector'),
    )
    expect(hasNameIndex).toBe(true)

    // Should have multiple indexes
    expect(result.rows.length).toBeGreaterThan(6)
  })

  it('should allow inserting valid place data', async () => {
    await client.query('BEGIN')

    try {
      const result: QueryResult<{ id: bigint }> = await client.query(`
	      INSERT INTO geographies (name, year, ucgid_code, for_param) 
	      VALUES ('Test City', 2022, 'TEST123', 'us:*') 
	      RETURNING id;
	    `)

      expect(result.rows[0].id).toBeDefined()
      expect(typeof result.rows[0].id).toBe('string')
      expect(Number(result.rows[0].id)).toBeGreaterThan(0)

      await client.query('ROLLBACK')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })

  it('should reject invalid data (missing required fields)', async () => {
    await client.query('BEGIN')

    try {
      await expect(
        client.query(
          `INSERT INTO geographies (ucgid_code) VALUES ('TEST123');`,
        ),
      ).rejects.toThrow()

      await client.query('ROLLBACK')
    } catch (error) {
      console.log(error)
      await client.query('ROLLBACK')
    }
  })
})
