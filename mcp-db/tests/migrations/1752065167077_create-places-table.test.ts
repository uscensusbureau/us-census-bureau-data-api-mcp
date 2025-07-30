import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { MigrationBuilder } from 'node-pg-migrate';

import { up, down } from '../../migrations/1752065167077_create-places-table';

describe('Migration 1752065167077 - Create Places Table', () => {
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
      addColumn: vi.fn(),
      func: funcSpy,
      addConstraint: addConstraintSpy
    } as MigrationBuilder;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('up', () => {
    const placesTableArgs = {
      id: { type: 'bigserial', primaryKey: true },
      name: { type: 'varchar(255)', notNull: true },
      full_name: { type: 'varchar(500)' },
      place_type: { type: 'varchar(100)', notNull: true },
      state_code: { type: 'char(2)' },
      state_name: { type: 'varchar(100)' },
      county_code: { type: 'varchar(3)' },
      county_name: { type: 'varchar(100)' },
      fips_code: { type: 'varchar(15)' },
      census_geoid: { type: 'varchar(20)' },
      geography_code: { type: 'varchar(20)' },
      parent_place_id: { type: 'bigint', references: 'places(id)' }, 
      latitude: { type: 'decimal(10, 7)' },
      longitude: { type: 'decimal(11, 7)' },
      population: { type: 'integer' },
      land_area_sqkm: { type: 'decimal(12, 4)' },
      water_area_sqkm: { type: 'decimal(12, 4)' },
      elevation_meters: { type: 'integer' },
      year: { type: 'integer', default: 2022 },
      is_active: { type: 'boolean', default: true },
      data_source: { type: 'varchar(100)' },
      created_at: { type: 'timestamp with time zone', default: 'POSTGRES_FUNCTION(NOW())' },
      updated_at: { type: 'timestamp with time zone', default: 'POSTGRES_FUNCTION(NOW())' },
      predecessor_geoid: { type: 'varchar(20)' },
      successor_geoid: { type: 'varchar(20)' },
      geoid_change_reason: { type: 'varchar(100)' }
    };

    it('should create the places table', async () => {
      await up(mockPgm);
      
      expect(createTableSpy).toHaveBeenCalledWith('places', placesTableArgs);
    });

    it('should add constraints to the places table', async () => {
      await up(mockPgm);
      
      expect(addConstraintSpy).toHaveBeenCalledWith('places', 'places_census_geoid_year_unique', 'UNIQUE(census_geoid, year)');
      expect(addConstraintSpy).toHaveBeenCalledWith('places', 'places_geography_code_type_year_unique', 'UNIQUE(geography_code, place_type, year)');
    });
  });

  describe('down', () => {
    it('should drop the places table', async () => {
      await down(mockPgm);

      expect(dropTableSpy).toHaveBeenCalledWith('places');
    });
  });
});