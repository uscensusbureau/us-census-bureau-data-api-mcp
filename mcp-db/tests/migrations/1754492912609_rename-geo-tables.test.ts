import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import { normalizeSQL } from '../helpers/normalize-sql'
import {
  down,
  geographiesTrigger,
  placesTrigger,
  up,
} from '../../migrations/1754492912609_rename-geo-tables'

describe('Migration 1754492912609 - Rename Geo Tables', () => {
  let mockPgm: MigrationBuilder
  let sqlSpy: ReturnType<typeof vi.fn>
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>
  let renameColumnSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>
  let dropIndexSpy: ReturnType<typeof vi.fn>
  let addConstraintSpy: ReturnType<typeof vi.fn>
  let dropConstraintSpy: ReturnType<typeof vi.fn>
  let renameTableSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined)
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)
    renameColumnSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)
    dropIndexSpy = vi.fn().mockResolvedValue(undefined)
    addConstraintSpy = vi.fn().mockResolvedValue(undefined)
    dropConstraintSpy = vi.fn().mockResolvedValue(undefined)
    renameTableSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      sql: sqlSpy,
      addColumns: addColumnsSpy,
      dropColumns: dropColumnsSpy,
      renameColumn: renameColumnSpy,
      createIndex: createIndexSpy,
      dropIndex: dropIndexSpy,
      addConstraint: addConstraintSpy,
      dropConstraint: dropConstraintSpy,
      renameTable: renameTableSpy,
    } as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    beforeEach(async () => {
      await up(mockPgm)
    })

    it('should drop places trigger', async () => {
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP TRIGGER IF EXISTS update_places_updated_at ON places',
      )
    })

    it('should drop places indexes', async () => {
      expect(dropIndexSpy).toHaveBeenCalledWith(
        'geography_levels',
        'parent_geography_level_id',
      )
      expect(dropIndexSpy).toHaveBeenCalledWith('places', 'geography_level_id')
      expect(dropIndexSpy).toHaveBeenCalledWith('places', 'state_code')
      expect(dropIndexSpy).toHaveBeenCalledWith('places', [
        'state_code',
        'county_code',
      ])
      expect(dropIndexSpy).toHaveBeenCalledWith('places', 'fips_code')
      expect(dropIndexSpy).toHaveBeenCalledWith('places', 'census_geoid')
      expect(dropIndexSpy).toHaveBeenCalledWith('places', 'parent_place_id')
      expect(dropIndexSpy).toHaveBeenCalledWith('places', [
        'latitude',
        'longitude',
      ])
      expect(dropIndexSpy).toHaveBeenCalledWith('places', 'year')
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_places_name',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_places_full_name',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_places_population',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_places_active',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_places_predecessor_geoid',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_places_successor_geoid',
      )
    })

    it('should drop old constraints', async () => {
      expect(dropConstraintSpy).toHaveBeenCalledWith(
        'places',
        'places_geography_level_year_geography_code_unique',
        {
          unique: ['geography_level_id', 'year', 'geography_code'],
        },
      )
      expect(dropConstraintSpy).toHaveBeenCalledWith(
        'places',
        'places_census_geoid_year_unique',
        'UNIQUE(census_geoid, year)',
      )
    })

    it('should rename columns and tables', async () => {
      // Rename geography_code to ucgid_code
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'places',
        'geography_code',
        'ucgid_code',
      )
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'places',
        'parent_place_id',
        'parent_geography_id',
      )

      // Rename Tables
      expect(renameTableSpy).toHaveBeenCalledWith('places', 'geographies')
      expect(renameTableSpy).toHaveBeenCalledWith(
        'geography_levels',
        'summary_levels',
      )

      // Rename Relational Columns
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'geographies',
        'geography_level_id',
        'summary_level_id',
      )
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'summary_levels',
        'parent_geography_level_id',
        'parent_summary_level_id',
      )
    })

    it('should recreate indexes for new table and column names', async () => {
      // Create New Indexes for Renamed Columns
      expect(createIndexSpy).toHaveBeenCalledWith(
        'summary_levels',
        'parent_summary_level_id',
      )
      expect(createIndexSpy).toHaveBeenCalledWith(
        'geographies',
        'summary_level_id',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        "CREATE INDEX idx_geographies_name ON geographies USING gin(to_tsvector('english', name))",
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        "CREATE INDEX idx_geographies_full_name ON geographies USING gin(to_tsvector('english', full_name))",
      )
      expect(createIndexSpy).toHaveBeenCalledWith('geographies', 'state_code')
      expect(createIndexSpy).toHaveBeenCalledWith('geographies', [
        'state_code',
        'county_code',
      ])
      expect(createIndexSpy).toHaveBeenCalledWith('geographies', 'fips_code')
      expect(createIndexSpy).toHaveBeenCalledWith('geographies', 'ucgid_code')
      expect(createIndexSpy).toHaveBeenCalledWith(
        'geographies',
        'parent_geography_id',
      )
      expect(createIndexSpy).toHaveBeenCalledWith('geographies', [
        'latitude',
        'longitude',
      ])
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_geographies_population ON geographies (population DESC) WHERE population IS NOT NULL',
      )
      expect(createIndexSpy).toHaveBeenCalledWith('geographies', 'year')
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_geographies_active ON geographies (is_active) WHERE is_active = true',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_geographies_predecessor_geoid ON geographies (predecessor_geoid) WHERE predecessor_geoid IS NOT NULL',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_geographies_successor_geoid ON geographies (successor_geoid) WHERE successor_geoid IS NOT NULL',
      )
    })

    it('should add new constraints for the new column names', async () => {
      expect(addConstraintSpy).toHaveBeenCalledWith(
        'geographies',
        'geographies_fips_code_year_unique',
        'UNIQUE(fips_code, year)',
      )
    })

    it('should add geographies trigger', async () => {
      expect(normalizeSQL(sqlSpy.mock.calls[13][0])).toBe(
        normalizeSQL(geographiesTrigger),
      )
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('should drop the summary_level columns in geography_levels', async () => {
      expect(dropIndexSpy).toHaveBeenCalledWith(
        'summary_levels',
        'parent_summary_level_id',
      )
      expect(dropIndexSpy).toHaveBeenCalledWith(
        'geographies',
        'summary_level_id',
      )
      expect(dropIndexSpy).toHaveBeenCalledWith('geographies', 'state_code')
      expect(dropIndexSpy).toHaveBeenCalledWith('geographies', [
        'state_code',
        'county_code',
      ])
      expect(dropIndexSpy).toHaveBeenCalledWith('geographies', 'fips_code')
      expect(dropIndexSpy).toHaveBeenCalledWith('geographies', 'ucgid_code')
      expect(dropIndexSpy).toHaveBeenCalledWith(
        'geographies',
        'parent_geography_id',
      )
      expect(dropIndexSpy).toHaveBeenCalledWith('geographies', [
        'latitude',
        'longitude',
      ])
      expect(dropIndexSpy).toHaveBeenCalledWith('geographies', 'year')
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_geographies_name',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_geographies_full_name',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_geographies_population',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_geographies_active',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_geographies_predecessor_geoid',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_geographies_successor_geoid',
      )
    })

    it('should drop new constraint', async () => {
      expect(dropConstraintSpy).toHaveBeenCalledWith(
        'geographies',
        'geographies_fips_code_year_unique',
        'UNIQUE(fips_code, year)',
      )
    })

    it('should rename columns and tables', async () => {
      // Rename Relational Columns to Original Names
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'geographies',
        'summary_level_id',
        'geography_level_id',
      )
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'summary_levels',
        'parent_summary_level_id',
        'parent_geography_level_id',
      )

      // Rename Tables to Original Names
      expect(renameTableSpy).toHaveBeenCalledWith('geographies', 'places')
      expect(renameTableSpy).toHaveBeenCalledWith(
        'summary_levels',
        'geography_levels',
      )

      // Rename Geo Code Column
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'places',
        'ucgid_code',
        'geography_code',
      )
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'places',
        'parent_geography_id',
        'parent_place_id',
      )
    })

    it('should add old indexes for table and column names', async () => {
      // Create New Indexes for Renamed Columns
      expect(createIndexSpy).toHaveBeenCalledWith(
        'geography_levels',
        'parent_geography_level_id',
      )
      expect(createIndexSpy).toHaveBeenCalledWith(
        'places',
        'geography_level_id',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        "CREATE INDEX idx_places_name ON places USING gin(to_tsvector('english', name))",
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        "CREATE INDEX idx_places_full_name ON places USING gin(to_tsvector('english', full_name))",
      )
      expect(createIndexSpy).toHaveBeenCalledWith('places', 'state_code')
      expect(createIndexSpy).toHaveBeenCalledWith('places', [
        'state_code',
        'county_code',
      ])
      expect(createIndexSpy).toHaveBeenCalledWith('places', 'fips_code')
      expect(createIndexSpy).toHaveBeenCalledWith('places', 'census_geoid')
      expect(createIndexSpy).toHaveBeenCalledWith('places', 'parent_place_id')
      expect(createIndexSpy).toHaveBeenCalledWith('places', [
        'latitude',
        'longitude',
      ])
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_places_population ON places (population DESC) WHERE population IS NOT NULL',
      )
      expect(createIndexSpy).toHaveBeenCalledWith('places', 'year')
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_places_active ON places (is_active) WHERE is_active = true',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_places_predecessor_geoid ON places (predecessor_geoid) WHERE predecessor_geoid IS NOT NULL',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_places_successor_geoid ON places (successor_geoid) WHERE successor_geoid IS NOT NULL',
      )
    })

    it('should add old constraints', async () => {
      expect(addConstraintSpy).toHaveBeenCalledWith(
        'places',
        'places_geography_level_year_geography_code_unique',
        {
          unique: ['geography_level_id', 'year', 'geography_code'],
        },
      )
      expect(addConstraintSpy).toHaveBeenCalledWith(
        'places',
        'places_census_geoid_year_unique',
        'UNIQUE(census_geoid, year)',
      )
    })

    it('should add old places trigger', async () => {
      expect(normalizeSQL(sqlSpy.mock.calls[13][0])).toBe(
        normalizeSQL(placesTrigger),
      )
    })
  })
})
