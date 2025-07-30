import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { MigrationBuilder } from 'node-pg-migrate';

import { normalizeSQL } from '../helpers/normalize-sql';
import { up, down } from '../../migrations/1752064297557_add-functions';

describe('Migration 1752064297557 - Add Functions', () => {
  let mockPgm: MigrationBuilder;
  let sqlSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined);
    
    mockPgm = {
      sql: sqlSpy,
      createTable: vi.fn(),
      dropTable: vi.fn(),
      addColumn: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('up', () => {
  	const expectedUpdateFunction = normalizeSQL(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const expectedCacheFunction = normalizeSQL(`
      CREATE OR REPLACE FUNCTION generate_cache_hash(
          dataset_code TEXT,
          year INTEGER,
          variables TEXT[],
          geography_spec JSONB
      )
      RETURNS TEXT AS $$
      BEGIN
          RETURN encode(
              digest(
                  dataset_code || year::TEXT || array_to_string(variables, ',') || geography_spec::TEXT,
                  'sha256'
              ),
              'hex'
          );
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    it('should create or replace function update_updated_at_column', async () => {
      await up(mockPgm);
      
      expect(normalizeSQL(sqlSpy.mock.calls[0][0])).toBe(expectedUpdateFunction);
    });

    it('should create or replace function generate_cache_hash', async () => {
      await up(mockPgm);
      
      expect(normalizeSQL(sqlSpy.mock.calls[1][0])).toBe(expectedCacheFunction);
    });
  });

  describe('down', () => {
  	it('should drop update_updated_at_column function if it exists', async () => {
  	  await down(mockPgm);
  	  
  	  expect(sqlSpy).toHaveBeenCalledWith(
  	  	'DROP FUNCTION IF EXISTS update_updated_at_column()'
  		);
  	});

    it('should drop generate_cache_hash function if it exists', async () => {
      await down(mockPgm);
      
      expect(sqlSpy).toHaveBeenCalledWith(
      	'DROP FUNCTION IF EXISTS generate_cache_hash(TEXT, INTEGER, TEXT[], JSONB)'
    	);
    });
  });
});