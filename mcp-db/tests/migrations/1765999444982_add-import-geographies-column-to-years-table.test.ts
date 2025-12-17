import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  importYearsSQL,
  up,
  down,
} from '../../migrations/1765999444982_add-import-geographies-column-to-years-table'

describe('Migration 1765999444982 - Add import_geographies column to Years Table', () => {
  let mockPgm: MigrationBuilder
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>
  let sqlSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)
    sqlSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumns: addColumnsSpy,
      dropColumns: dropColumnsSpy,
      sql: sqlSpy,
    } as Partial<MigrationBuilder> as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    beforeEach(async () => {
      await up(mockPgm)
    })

    it('should add import_geographies column to years', async () => {
      expect(addColumnsSpy).toHaveBeenCalledWith('years', {
        import_geographies: {
          type: 'boolean',
          default: false,
          notNull: true
        },
      })
    })

    it('should run import years SQL', async () => {
      expect(sqlSpy).toHaveBeenCalledWith(importYearsSQL)
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })
    it('should drop import_geographies column from years', async () => {
      expect(dropColumnsSpy).toHaveBeenCalledWith('years', [
        'import_geographies',
      ])
    })
  })
})
