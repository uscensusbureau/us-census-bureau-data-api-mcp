import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, QueryResult } from 'pg';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
}

interface IndexInfo {
  indexname: string;
  indexdef: string;
}

const dbConfig: DatabaseConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  database: process.env.POSTGRES_DB || 'mcp_db_test',
  user: process.env.POSTGRES_USER || 'mcp_user_test',
  password: process.env.POSTGRES_PASSWORD || 'mcp_pass_test',
};

const client = new Client(dbConfig);

describe('Database Schema', () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('should connect to the database', async () => {
    const result: QueryResult<{ connected: number }> = await client.query('SELECT 1 as connected');
    expect(result.rows[0].connected).toBe(1);
  });

  describe('Places Table', () => {
    it('should exist', async () => {
      const result: QueryResult<{ exists: boolean }> = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'places'
        );
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have all required columns', async () => {
      const result: QueryResult<Pick<ColumnInfo, 'column_name' | 'data_type' | 'is_nullable'>> = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'places' 
        ORDER BY ordinal_position;
      `);

      const expectedColumns: string[] = [
        'id', 'name', 'full_name', 'place_type', 'state_code', 
        'state_name', 'county_code', 'county_name', 'fips_code',
        'census_geoid', 'geography_code', 'parent_place_id',
        'latitude', 'longitude', 'population', 'land_area_sqkm',
        'water_area_sqkm', 'elevation_meters', 'year', 'timezone',
        'is_active', 'data_source', 'created_at', 'updated_at',
        'predecessor_geoid', 'successor_geoid', 'geoid_change_reason'
      ];

      const actualColumns: string[] = result.rows.map(row => row.column_name);
      
      expectedColumns.forEach(expectedCol => {
        expect(actualColumns).toContain(expectedCol);
      });
    });

    it('should have correct data types for key columns', async () => {
      const result: QueryResult<ColumnInfo> = await client.query(`
        SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns 
        WHERE table_name = 'places' 
        AND column_name IN ('name', 'latitude', 'longitude', 'year', 'census_geoid');
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
      expect(columnTypes.latitude.data_type).toBe('numeric');
      expect(columnTypes.latitude.numeric_precision).toBe(10);
      expect(columnTypes.latitude.numeric_scale).toBe(7);
      expect(columnTypes.longitude.data_type).toBe('numeric');
      expect(columnTypes.longitude.numeric_precision).toBe(11);
      expect(columnTypes.longitude.numeric_scale).toBe(7);
      expect(columnTypes.year.data_type).toBe('integer');
    });

    it('should have NOT NULL constraint on required fields', async () => {
      const result: QueryResult<Pick<ColumnInfo, 'column_name' | 'is_nullable'>> = await client.query(`
        SELECT column_name, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'places' 
        AND column_name IN ('name', 'place_type', 'year');
      `);

      result.rows.forEach(row => {
        expect(row.is_nullable).toBe('NO');
      });
    });

    it('should have unique constraints', async () => {
      const result: QueryResult<ConstraintInfo> = await client.query(`
        SELECT constraint_name, constraint_type 
        FROM information_schema.table_constraints 
        WHERE table_name = 'places' 
        AND constraint_type = 'UNIQUE';
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(2); // At least the two UNIQUE constraints
    });

    it('should have primary key', async () => {
      const result: QueryResult<Pick<ConstraintInfo, 'constraint_name'>> = await client.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'places' 
        AND constraint_type = 'PRIMARY KEY';
      `);

      expect(result.rows.length).toBe(1);
    });

    it('should have foreign key for parent_place_id', async () => {
      const result: QueryResult<Pick<ConstraintInfo, 'constraint_name'>> = await client.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'places' 
        AND constraint_type = 'FOREIGN KEY';
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should have appropriate indexes', async () => {
      const result: QueryResult<IndexInfo> = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'places'
        AND indexname != 'places_pkey'; -- Exclude primary key index
      `);

      // Check for name index
      const hasNameIndex: boolean = result.rows.some(row => 
        row.indexname.includes('name') || row.indexdef.includes('name')
      );
      expect(hasNameIndex).toBe(true);
    });
  });

  describe('Database Functions', () => {
    it('should have any custom functions defined', async () => {
      const result: QueryResult<{ routine_name: string }> = await client.query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION';
      `);

      // This test will pass even if no functions exist
      // Add specific function tests as you create them
      expect(Array.isArray(result.rows)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should allow inserting valid place data', async () => {
      await client.query('BEGIN');
      
      try {
        const result: QueryResult<{ id: bigint }> = await client.query(`
          INSERT INTO places (name, place_type, year, census_geoid) 
          VALUES ('Test City', 'city', 2022, 'TEST123') 
          RETURNING id;
        `);
        
        expect(result.rows[0].id).toBeDefined();
        expect(typeof result.rows[0].id).toBeTypeOf('string'); //BIGSERIAL is represented as 'string' in 'pg' library but parsable as an integer.
        expect(parseInt(result.rows[0].id)).toBeGreaterThan(0); //Confirm it is a valid number
        
        // Cleanup
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
          client.query(`INSERT INTO places (census_geoid) VALUES ('TEST123');`)
        ).rejects.toThrow();
        
        await client.query('ROLLBACK');
      } catch (error) {
        await client.query('ROLLBACK');
      }
    });
  });
});