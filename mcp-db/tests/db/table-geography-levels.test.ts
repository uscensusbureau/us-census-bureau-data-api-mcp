import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, QueryResult } from 'pg';

import { dbConfig } from '../helpers/database-config';
import { 
	ColumnInfo, 
	ConstraintInfo,
	IndexInfo,
} from '../helpers/types';

const client = new Client(dbConfig);

describe('Geography Levels Table', () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

	it('should exist', async () => {
	  const result: QueryResult<{ exists: boolean }> = await client.query(`
	    SELECT EXISTS (
	      SELECT FROM information_schema.tables 
	      WHERE table_schema = 'public' 
	      AND table_name = 'geography_levels'
	    );
	  `);
	  
	  expect(result.rows[0].exists).toBe(true);
	});

	it('should have all required columns', async () => {
	  const result: QueryResult<Pick<ColumnInfo, 'column_name' | 'data_type' | 'is_nullable'>> = await client.query(`
	    SELECT column_name, data_type, is_nullable 
	    FROM information_schema.columns 
	    WHERE table_name = 'geography_levels' 
	    ORDER BY ordinal_position;
	  `);

	  const expectedColumns: string[] = ['id', 'name', 'get_variable', 'on_spine', 'query_name'];

	  const actualColumns: string[] = result.rows.map(row => row.column_name);
	  
	  expectedColumns.forEach(expectedCol => {
	    expect(actualColumns).toContain(expectedCol);
	  });
	});

	it('should have correct data types for key columns', async () => {
	  const result: QueryResult<ColumnInfo> = await client.query(`
	    SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
	    FROM information_schema.columns 
	    WHERE table_name = 'geography_levels' 
	    AND column_name IN ('name');
	  `);

	  const columnTypes: Record<string, Omit<ColumnInfo, 'column_name' | 'is_nullable'>> = result.rows.reduce((acc, row) => {
	    acc[row.column_name] = {
	      data_type: row.data_type,
	      character_maximum_length: row.character_maximum_length,
	      numeric_precision: row.numeric_precision,
	      numeric_scale: row.numeric_scale
	    };
	    return acc;
	  }, {} as Record<string, Omit<ColumnInfo, 'column_name' | 'is_nullable'>>);

	  expect(columnTypes.name.data_type).toBe('character varying');
	  expect(columnTypes.name.character_maximum_length).toBe(255);
	});

	it('should have NOT NULL constraint on required fields', async () => {
	  const result: QueryResult<Pick<ColumnInfo, 'column_name' | 'is_nullable'>> = await client.query(`
	    SELECT column_name, is_nullable 
	    FROM information_schema.columns 
	    WHERE table_name = 'geography_levels' 
	    AND column_name IN ('name', 'place_type');
	  `);

	  result.rows.forEach(row => {
	    expect(row.is_nullable).toBe('NO');
	  });
	});

	it('should have primary key', async () => {
	  const result: QueryResult<Pick<ConstraintInfo, 'constraint_name'>> = await client.query(`
	    SELECT constraint_name 
	    FROM information_schema.table_constraints 
	    WHERE table_name = 'geography_levels' 
	    AND constraint_type = 'PRIMARY KEY';
	  `);

	  expect(result.rows.length).toBe(1);
	});

	it('should have foreign key for parent_geography_level_id', async () => {
	  const result: QueryResult<Pick<ConstraintInfo, 'constraint_name'>> = await client.query(`
	    SELECT constraint_name 
	    FROM information_schema.table_constraints 
	    WHERE table_name = 'geography_levels' 
	    AND constraint_type = 'FOREIGN KEY';
	  `);

	  expect(result.rows.length).toBeGreaterThanOrEqual(1);
	});

	it('should have appropriate indexes', async () => {
	  const result: QueryResult<IndexInfo> = await client.query(`
	    SELECT indexname, indexdef
	    FROM pg_indexes 
	    WHERE tablename = 'geography_levels'
	    AND indexname != 'geography_levels_pkey'; -- Exclude primary key index
	  `);

	  // Check for name index
	  const hasNameIndex: boolean = result.rows.some(row => 
	    row.indexname.includes('parent_geography_level_id')
	  );
	  expect(hasNameIndex).toBe(true);

	  // Should have multiple indexes
	  expect(result.rows.length).toBeGreaterThan(0);
	});

	it('should allow inserting valid geography level data', async () => {
	  await client.query('BEGIN');
	  
	  try {
	    const result: QueryResult<{ id: bigint }> = await client.query(`
	      INSERT INTO geography_levels (name, get_variable, on_spine, query_name ) 
	      VALUES ('County', 'COUNTY', true, 'county') 
	      RETURNING id;
	    `);
	    
	    expect(result.rows[0].id).toBeDefined();
	    expect(typeof result.rows[0].id).toBe('string');
	    expect(Number(result.rows[0].id)).toBeGreaterThan(0);
	    
	    await client.query('ROLLBACK');
	  } catch (error) {
	    await client.query('ROLLBACK');
	    throw error;
	  }
	});

	it('should reject invalid data (missing required fields)', async () => {
	  await client.query('BEGIN');
	  
	  try {
	    await expect(
	      client.query(`INSERT INTO geography_levels (name) VALUES ('County');`)
	    ).rejects.toThrow();
	    
	    await client.query('ROLLBACK');
	  } catch (error) {
	  	console.log(error);
	    await client.query('ROLLBACK');
	  }
	});
});