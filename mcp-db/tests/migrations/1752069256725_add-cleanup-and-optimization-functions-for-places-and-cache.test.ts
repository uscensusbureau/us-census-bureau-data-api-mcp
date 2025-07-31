import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { MigrationBuilder } from 'node-pg-migrate';

import { normalizeSQL } from '../helpers/normalize-sql';
import { 
	up, 
	down, 
	cleanupExpiredCacheSql, 
	getCacheStatsSql, 
	optimizeDatabaseSql
} from '../../migrations/1752069256725_add-cleanup-and-optimization-functions-for-places-and-cache';

describe('Migration 1752069256725 - Add Cleanup and Optimization Functions for Places and Cache', () => {
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

    it('should create cleanup_expired_cache function', async () => {
      await up(mockPgm);
      
      expect(normalizeSQL(sqlSpy.mock.calls[0][0])).toBe(normalizeSQL(cleanupExpiredCacheSql));
    });

    it('should create get_cache_stats function', async () => {
      await up(mockPgm);
      
      expect(normalizeSQL(sqlSpy.mock.calls[1][0])).toBe(normalizeSQL(getCacheStatsSql));
    });

    it('should create optimize_database function', async () => {
      await up(mockPgm);
      
      expect(normalizeSQL(sqlSpy.mock.calls[2][0])).toBe(normalizeSQL(optimizeDatabaseSql));
    });
  });

  describe('down', () => {
		it('should drop functions', async () => {
			await down(mockPgm);

			expect(sqlSpy).toHaveBeenCalledWith('DROP FUNCTION IF EXISTS optimize_database()');
			expect(sqlSpy).toHaveBeenCalledWith('DROP FUNCTION IF EXISTS get_cache_stats()');
			expect(sqlSpy).toHaveBeenCalledWith('DROP FUNCTION IF EXISTS cleanup_expired_cache()');
  	});
  });
});