import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  down,
  up,
} from '../../migrations/1754681809226_add-params-to-geographies'

describe('Migration 1754681809226 - Add Params to Geographies', () => {
  let mockPgm: MigrationBuilder
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>
  let renameColumnSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)
    renameColumnSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumns: addColumnsSpy,
      dropColumns: dropColumnsSpy,
      renameColumn: renameColumnSpy,
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

    it('should add columns to geographies', async () => {
      expect(addColumnsSpy).toHaveBeenCalledWith('geographies', {
        for_param: { type: 'varchar(25)', notNull: true },
        in_param: 'varchar(25)',
        summary_level_code: 'varchar(3)',
      })
    })

    it('should rename summary_level column to code in summary_levels', async () => {
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'summary_levels',
        'summary_level',
        'code',
      )
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('should drop columns from geographies', async () => {
      expect(dropColumnsSpy).toHaveBeenCalledWith('geographies', {
        for_param: { type: 'varchar(25)', notNull: true },
        in_param: 'varchar(25)',
        summary_level_code: 'varchar(3)',
      })
    })

    it('should rename code column to summary_level in summary_levels', async () => {
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'summary_levels',
        'code',
        'summary_level',
      )
    })
  })
})
