import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import { normalizeSQL } from '../helpers/normalize-sql'
import {
  up,
  down,
  fuzzySearchPlacesSql,
  geoCoordinateSearchSql,
  searchPlacesSql,
} from '../../migrations/1752069018289_add-search-functions-for-places'

describe('Migration 1752069018289 - Add Search Functions for Places', () => {
  let mockPgm: MigrationBuilder
  let sqlSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = { sql: sqlSpy } as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    it('should create search_places function', async () => {
      await up(mockPgm)

      expect(normalizeSQL(sqlSpy.mock.calls[0][0])).toBe(
        normalizeSQL(searchPlacesSql),
      )
    })

    it('should create fuzzy_search_places function', async () => {
      await up(mockPgm)

      expect(normalizeSQL(sqlSpy.mock.calls[1][0])).toBe(
        normalizeSQL(fuzzySearchPlacesSql),
      )
    })

    it('should create resolve_geography_by_coordinates function', async () => {
      await up(mockPgm)

      expect(normalizeSQL(sqlSpy.mock.calls[2][0])).toBe(
        normalizeSQL(geoCoordinateSearchSql),
      )
    })
  })

  describe('down', () => {
    it('should drop triggers and functions', async () => {
      await down(mockPgm)

      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP FUNCTION IF EXISTS resolve_geography_by_coordinates(DECIMAL, DECIMAL, DECIMAL)',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP FUNCTION IF EXISTS fuzzy_search_places(TEXT, REAL, INTEGER)',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP FUNCTION IF EXISTS search_places(TEXT, CHAR, TEXT[], INTEGER)',
      )
    })
  })
})
