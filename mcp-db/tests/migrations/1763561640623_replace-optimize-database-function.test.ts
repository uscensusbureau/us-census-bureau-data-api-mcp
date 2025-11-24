import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import { normalizeSQL } from '../helpers/normalize-sql'
import {
  up,
  down,
  optimizeDatabaseSql,
} from '../../migrations/1763561640623_replace-optimize-database-function'

describe('Migration 1763561640623 - Replace Optimize Database Function', () => {
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
    it('should create optimize_database function', async () => {
      await up(mockPgm)

      expect(normalizeSQL(sqlSpy.mock.calls[0][0])).toBe(
        normalizeSQL(optimizeDatabaseSql),
      )
    })
  })

  describe('down', () => {
    it('should drop functions', async () => {
      await down(mockPgm)

      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP FUNCTION IF EXISTS optimize_database()',
      )
    })
  })
})
