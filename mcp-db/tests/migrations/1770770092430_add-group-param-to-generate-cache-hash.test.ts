import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import { normalizeSQL } from '../test-helpers/normalize-sql'
import {
  up,
  down,
  generateCacheHashNewVersion,
  generateCacheHashOldVersion,
} from '../../migrations/1770770092430_add-group-param-to-generate-cache-hash'

describe('Migration 1770770092430 - Add Group Param to Generate Cache Hash', () => {
  let mockPgm: MigrationBuilder
  let sqlSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = { sql: sqlSpy } as Partial<MigrationBuilder> as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    it('should drop the existing function and create the updated one', async () => {
      await up(mockPgm)

      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP FUNCTION IF EXISTS generate_cache_hash(TEXT, INTEGER, TEXT[], JSONB)',
      )

      expect(normalizeSQL(sqlSpy.mock.calls[1][0])).toBe(
        normalizeSQL(generateCacheHashNewVersion),
      )
    })
  })

  describe('down', () => {
    it('should drop the updated function and recreate the original one', async () => {
      await down(mockPgm)

      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP FUNCTION IF EXISTS generate_cache_hash(TEXT, TEXT, INTEGER, TEXT[], JSONB)',
      )

      expect(normalizeSQL(sqlSpy.mock.calls[1][0])).toBe(
        normalizeSQL(generateCacheHashOldVersion),
      )
    })
  })
})
