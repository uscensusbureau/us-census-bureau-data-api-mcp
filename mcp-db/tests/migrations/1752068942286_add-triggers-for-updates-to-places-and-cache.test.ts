import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { MigrationBuilder } from 'node-pg-migrate';

import { normalizeSQL } from '../helpers/normalize-sql';
import { up, down } from '../../migrations/1752068942286_add-triggers-for-updates-to-places-and-cache';

describe('Migration 1752068942286 - Add Triggers for Updates to Places and Cache', () => {
  let mockPgm: MigrationBuilder;
  let sqlSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined);
    
    mockPgm = { sql: sqlSpy } as MigrationBuilder;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('up', () => {
  	const createPlacesTrigger = normalizeSQL(`
    	CREATE TRIGGER update_places_updated_at 
        BEFORE UPDATE ON places 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
  	`);

    const createCacheFunction = normalizeSQL(`
	    CREATE OR REPLACE FUNCTION update_cache_accessed()
		    RETURNS TRIGGER AS $$
		    BEGIN
		        -- Only update if the last_accessed is more than 1 hour old to avoid too many updates
		        IF OLD.last_accessed < NOW() - INTERVAL '1 hour' THEN
		            NEW.last_accessed = NOW();
		        END IF;
		        RETURN NEW;
		    END;
		    $$ LANGUAGE plpgsql;
  	`);

  	const createCacheTrigger = normalizeSQL(`
  	  CREATE TRIGGER update_census_data_cache_accessed
  	      BEFORE UPDATE OF response_data ON census_data_cache
  	      FOR EACH ROW 
  	      EXECUTE FUNCTION update_cache_accessed();
  	`);

    it('should create trigger for update_places_updated_at', async () => {
      await up(mockPgm);
      
      expect(normalizeSQL(sqlSpy.mock.calls[0][0])).toBe(createPlacesTrigger);
    });

    it('should create function for update_cache_accessed', async () => {
      await up(mockPgm);
      
      expect(normalizeSQL(sqlSpy.mock.calls[1][0])).toBe(createCacheFunction);
    });

    it('should create function for update_census_data_cache_accessed', async () => {
      await up(mockPgm);
      
      expect(normalizeSQL(sqlSpy.mock.calls[2][0])).toBe(createCacheTrigger);
    });
  });

  describe('down', () => {
  	it('should drop triggers and functions', async () => {
  	  await down(mockPgm);

  		expect(sqlSpy).toHaveBeenCalledWith('DROP TRIGGER IF EXISTS update_census_data_cache_accessed ON census_data_cache');
  		expect(sqlSpy).toHaveBeenCalledWith('DROP TRIGGER IF EXISTS update_places_updated_at ON places');
  		expect(sqlSpy).toHaveBeenCalledWith('DROP FUNCTION IF EXISTS update_cache_accessed()');
  	});
  });
});