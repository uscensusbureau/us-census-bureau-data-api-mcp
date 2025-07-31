import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { MigrationBuilder } from 'node-pg-migrate';

import { down, up } from '../../migrations/1752671507645_add-summary-level-to-geography-levels';

describe('Migration 1752671507645 - Add Summary Level to Geography Levels Table', () => {
  let mockPgm: MigrationBuilder;
  let sqlSpy: ReturnType<typeof vi.fn>;
  let addColumnsSpy: ReturnType<typeof vi.fn>;
  let dropColumnsSpy: ReturnType<typeof vi.fn>;
  let createIndexSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined);
    addColumnsSpy = vi.fn().mockResolvedValue(undefined);
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined);
    createIndexSpy = vi.fn().mockResolvedValue(undefined);


    mockPgm = {
      sql: sqlSpy,
      addColumns: addColumnsSpy,
      dropColumns: dropColumnsSpy,
      createIndex: createIndexSpy
    } as MigrationBuilder;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

	describe('up', () => {
		it('should add summary_level columns to geography_levels', async () => {
			await up(mockPgm);

			expect(addColumnsSpy).toHaveBeenCalledWith(
				'geography_levels', {
					summary_level: { type: 'string', unique: true, null: false },
					parent_summary_level: { type: 'string' }
				}
			);
		});

		it('should add indexes for summary_level columns in geography_levels', async () => {
			await up(mockPgm);

			expect(createIndexSpy).toHaveBeenCalledWith('geography_levels', 'summary_level');
			expect(createIndexSpy).toHaveBeenCalledWith('geography_levels', 'parent_summary_level');
		});
	});

	describe('down', () => {
		it('should drop the summary_level columns in geography_levels', async () => {
			await down(mockPgm);

			expect(dropColumnsSpy).toHaveBeenCalledWith('geography_levels', 'summary_level');
			expect(dropColumnsSpy).toHaveBeenCalledWith('geography_levels', 'parent_summary_level');
		});
	});
});