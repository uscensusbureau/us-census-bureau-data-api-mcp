import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'
import { up, down } from '../../migrations/1751916162107_add-extensions'

describe('Migration 1751916162107 - Add Extensions', () => {
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
    it('should create uuid-ossp extension', async () => {
      await up(mockPgm)

      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
      )
    })

    it('should create pg_trgm extension', async () => {
      await up(mockPgm)

      expect(sqlSpy).toHaveBeenCalledWith(
        'CREATE EXTENSION IF NOT EXISTS pg_trgm',
      )
    })
  })

  describe('down', () => {
    it('should not execute any SQL', async () => {
      await down()

      expect(sqlSpy).not.toHaveBeenCalled()
    })
  })
})
