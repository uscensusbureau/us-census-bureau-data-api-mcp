import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  down,
  up,
} from '../../migrations/1763395506352_add-zip-code-tabulation-area-to-geographies'

describe('Migration 1763395506352 - Add Zip Code Tabulation Area Geographies', () => {
  let mockPgm: MigrationBuilder
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumns: addColumnsSpy,
      dropColumns: dropColumnsSpy,
    } as Partial<MigrationBuilder> as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    it('should add zip_code_tabulation_area column to geographies', async () => {
      await up(mockPgm)

      expect(addColumnsSpy).toHaveBeenCalledWith('geographies', {
        zip_code_tabulation_area: 'char(5)',
      })
    })
  })

  describe('down', () => {
    it('should drop zip_code_tabulation_area column from geographies', async () => {
      await down(mockPgm)

      expect(dropColumnsSpy).toHaveBeenCalledWith('geographies', [
        'zip_code_tabulation_area',
      ])
    })
  })
})
