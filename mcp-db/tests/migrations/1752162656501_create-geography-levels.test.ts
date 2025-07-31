import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { MigrationBuilder } from 'node-pg-migrate';

import {
	down,
	geographyLevelsArgs,
	up
} from '../../migrations/1752162656501_create-geography-levels';

describe('Migration 1752162656501 - Create Geography Levels Table', () => {
  let mockPgm: MigrationBuilder;
  let sqlSpy: ReturnType<typeof vi.fn>;
  let addConstraintSpy: ReturnType<typeof vi.fn>;
  let createTableSpy: ReturnType<typeof vi.fn>;
  let addColumnsSpy: ReturnType<typeof vi.fn>;
  let dropColumnsSpy: ReturnType<typeof vi.fn>;
  let dropTableSpy: ReturnType<typeof vi.fn>;
  let createIndexSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined);
    createTableSpy = vi.fn().mockResolvedValue(undefined);
    addColumnsSpy = vi.fn().mockResolvedValue(undefined);
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined);
    dropTableSpy = vi.fn().mockResolvedValue(undefined);
    addConstraintSpy = vi.fn().mockResolvedValue(undefined);
    createIndexSpy = vi.fn().mockResolvedValue(undefined);


    mockPgm = {
      sql: sqlSpy,
      createTable: createTableSpy,
      dropTable: dropTableSpy,
      addColumns: addColumnsSpy,
      dropColumns: dropColumnsSpy,
      addConstraint: addConstraintSpy,
      createIndex: createIndexSpy
    } as MigrationBuilder;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('up', () => {
    it('should create the geography_levels table', async () => {
      await up(mockPgm);
      
      expect(createTableSpy).toHaveBeenCalledWith('geography_levels', geographyLevelsArgs);
    });

		it('should add geography_level parent to places table', async () => { 
			await up(mockPgm);

			expect(addColumnsSpy).toHaveBeenCalledWith('places', {
				geography_level_id: { type: 'bigint', references: 'geography_levels(id)' }
	  	});
		});

		it('should drop place_type column from places table', async () => { 
			await up(mockPgm);

			expect(dropColumnsSpy).toHaveBeenCalledWith('places', ['place_type']);
		});

		it('should create index for parent geography level in geography_levels table', async () => { 
			await up(mockPgm);

			expect(createIndexSpy).
				toHaveBeenCalledWith('geography_levels', 'parent_geography_level_id');
		});

		it('should create index for parent geography_level in the places table', async () => { 
			await up(mockPgm);

			expect(createIndexSpy).toHaveBeenCalledWith('places', 'geography_level_id');
		});

		it('should add constraint to ensure a place is unique', async () => { 
			await up(mockPgm);

			expect(addConstraintSpy).
				toHaveBeenCalledWith(
					'places', 
					'places_geography_level_year_geography_code_unique', 
					{ unique: ['geography_level_id', 'year', 'geography_code'] }
				);
		});
	});

  describe('down', () => {
    it('should drop the geography_levels table', async () => {
      await down(mockPgm);

      expect(dropTableSpy).toHaveBeenCalledWith('geography_levels');
    });

    it('should drop the geography_level_id column in the places table', async () => {
      await down(mockPgm);

      expect(dropColumnsSpy).toHaveBeenCalledWith('places', ['geography_level_id']);
    });

    it('should add place_type column to places', async () => {
      await down(mockPgm);

      expect(addColumnsSpy).
      	toHaveBeenCalledWith('places', { place_type: { type: 'varchar(100)', notNull: true }});
    });

    it('should add unique constraint using place_type', async () => {
    	await down(mockPgm);
    	expect(addConstraintSpy).toHaveBeenCalledWith(
  			'places', 
  			'places_geography_code_type_year_unique', 
  			'UNIQUE(geography_code, place_type, year)'
			);
  	});
  });
});