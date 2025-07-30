import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { MigrationBuilder } from 'node-pg-migrate';

import { up, down } from '../../migrations/1752067938877_create-cache-table';

describe('Migration 1752067938877 - Create Cache Table', () => {
  let mockPgm: MigrationBuilder;
  let sqlSpy: ReturnType<typeof vi.fn>;
  let addConstraintSpy: ReturnType<typeof vi.fn>;
  let createTableSpy: ReturnType<typeof vi.fn>;
  let dropTableSpy: ReturnType<typeof vi.fn>;
  let funcSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined);
    createTableSpy = vi.fn().mockResolvedValue(undefined);
    dropTableSpy = vi.fn().mockResolvedValue(undefined);
    addConstraintSpy = vi.fn().mockResolvedValue(undefined);
    funcSpy = vi.fn((sql: string) => `POSTGRES_FUNCTION(${sql})`); // Mock function wrapper
    
    mockPgm = {
      sql: sqlSpy,
      createTable: createTableSpy,
      dropTable: dropTableSpy,
      func: funcSpy,
      addConstraint: addConstraintSpy
    } as MigrationBuilder;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('up', () => {
    const cacheTableArgs = {
	    id: { type: 'bigserial', primaryKey: true },
	    request_hash: { type: 'varchar(64)', notNull: true, unique: true },
	    dataset_code: { type: 'varchar(50)', notNull: true },
	    year: { type: 'integer', notNull: true },
	    variables: { type: 'text[]' },
	    geography_spec: { type: 'jsonb', notNull: true },
	    response_data: { type: 'jsonb', notNull: true },
	    row_count: { type: 'integer' },
	    expires_at: { type: 'timestamp with time zone' },
	    created_at: { type: 'timestamp with time zone', default: 'POSTGRES_FUNCTION(NOW())' },
	    last_accessed: { type: 'timestamp with time zone', default: 'POSTGRES_FUNCTION(NOW())' }
	  };

    it('should create the census_data_cache table', async () => {
      await up(mockPgm);
      
      expect(createTableSpy).toHaveBeenCalledWith('census_data_cache', cacheTableArgs);
    });
  });

  describe('down', () => {
    it('should drop the census_data_cache table', async () => {
      await down(mockPgm);

      expect(dropTableSpy).toHaveBeenCalledWith('census_data_cache');
    });
  });
});