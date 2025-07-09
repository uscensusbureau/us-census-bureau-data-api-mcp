import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, QueryResult } from 'pg';

import { dbConfig } from '../helpers/database-config';

import { MigrationInfo } from '../helpers/types';

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

  describe('Migration System', () => {
    it('should have pgmigrations table', async () => {
      const result: QueryResult<{ exists: boolean }> = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'pgmigrations'
        );
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have run migrations', async () => {
      const result: QueryResult<MigrationInfo> = await client.query(`
        SELECT name, run_on 
        FROM pgmigrations 
        ORDER BY run_on;
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      
      // Check for specific migrations
      const migrationNames = result.rows.map(row => row.name);
      expect(migrationNames.some(name => name.includes('extensions'))).toBe(true);
      expect(migrationNames.some(name => name.includes('functions'))).toBe(true);
      expect(migrationNames.some(name => name.includes('create-places-table'))).toBe(true);
    });
  });

  describe('PostgreSQL Extensions', () => {
    it('should have uuid-ossp extension', async () => {
      const result: QueryResult<{ exists: boolean }> = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_extension 
          WHERE extname = 'uuid-ossp'
        );
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have pg_trgm extension', async () => {
      const result: QueryResult<{ exists: boolean }> = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_extension 
          WHERE extname = 'pg_trgm'
        );
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('Database Functions', () => {
    it('should have update_updated_at_column function', async () => {
      const result: QueryResult<{ exists: boolean }> = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name = 'update_updated_at_column'
          AND routine_type = 'FUNCTION'
        );
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have search_places function', async () => {
      const result: QueryResult<{ exists: boolean }> = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name = 'search_places'
          AND routine_type = 'FUNCTION'
        );
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have fuzzy_search_places function', async () => {
      const result: QueryResult<{ exists: boolean }> = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name = 'fuzzy_search_places'
          AND routine_type = 'FUNCTION'
        );
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });
  });
});