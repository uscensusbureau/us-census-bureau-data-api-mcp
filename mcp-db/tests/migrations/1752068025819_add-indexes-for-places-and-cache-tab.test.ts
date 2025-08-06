import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  up,
  down,
} from '../../migrations/1752068025819_add-indexes-for-places-and-cache-tables'

describe('Migration 1752068025819 - Add Indexes for Places and Cache Tables', () => {
  let mockPgm: MigrationBuilder
  let sqlSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = { sql: sqlSpy, createIndex: createIndexSpy } as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    it('should create indexes for places table', async () => {
      await up(mockPgm)

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
      expect(createIndexSpy).toHaveBeenCalledWith('places', 'place_type')
      expect(createIndexSpy).toHaveBeenCalledWith('places', 'fips_code')
      expect(createIndexSpy).toHaveBeenCalledWith('places', 'census_geoid')
      expect(createIndexSpy).toHaveBeenCalledWith('places', [
        'geography_code',
        'place_type',
      ])
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
      expect(createIndexSpy).toHaveBeenCalledWith('places', [
        'place_type',
        'state_code',
        'county_code',
      ])
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_places_predecessor_geoid ON places (predecessor_geoid) WHERE predecessor_geoid IS NOT NULL',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_places_successor_geoid ON places (successor_geoid) WHERE successor_geoid IS NOT NULL',
      )
    })

    it('should create indexes for census_data_cache table', async () => {
      await up(mockPgm)

      expect(createIndexSpy).toHaveBeenCalledWith(
        'census_data_cache',
        'request_hash',
      )
      expect(createIndexSpy).toHaveBeenCalledWith('census_data_cache', [
        'dataset_code',
        'year',
      ])
      expect(createIndexSpy).toHaveBeenCalledWith(
        'census_data_cache',
        'expires_at',
      )
      expect(createIndexSpy).toHaveBeenCalledWith(
        'census_data_cache',
        'last_accessed',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE INDEX idx_census_data_cache_geography ON census_data_cache USING gin(geography_spec)',
      )
    })
  })

  describe('down', () => {
    it('should drop indexes', async () => {
      await down(mockPgm)

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
  })
})
