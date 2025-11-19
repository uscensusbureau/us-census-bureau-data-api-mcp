import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  down,
  up,
} from '../../migrations/1757519856896_add-county-subdivision-code-to-geographies'

describe('Migration 1757432274608 - Add County Subdivision Code to Geographies', () => {
  let mockPgm: MigrationBuilder
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let alterColumnSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    alterColumnSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumns: addColumnsSpy,
      alterColumn: alterColumnSpy,
      dropColumns: dropColumnsSpy,
    } as Partial<MigrationBuilder> as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    it('should add county_subdivision_code column to geographies', async () => {
      await up(mockPgm)

      expect(addColumnsSpy).toHaveBeenCalledWith('geographies', {
        county_subdivision_code: 'char(5)',
      })
    })

    it('should alter character limits on geographies', async () => {
      await up(mockPgm)

      expect(alterColumnSpy).toHaveBeenCalledWith('geographies', 'for_param', {
        type: 'varchar(100)',
      })
      expect(alterColumnSpy).toHaveBeenCalledWith('geographies', 'in_param', {
        type: 'varchar(100)',
      })
      expect(alterColumnSpy).toHaveBeenCalledWith('geographies', 'ucgid_code', {
        type: 'varchar(25)',
      })
    })
  })

  describe('down', () => {
    it('should drop county_subdivision_code column from geographies', async () => {
      await down(mockPgm)

      expect(dropColumnsSpy).toHaveBeenCalledWith('geographies', [
        'county_subdivision_code',
      ])
    })

    it('should revert character limits on geographies', async () => {
      await down(mockPgm)

      expect(alterColumnSpy).toHaveBeenCalledWith('geographies', 'for_param', {
        type: 'varchar(25)',
      })
      expect(alterColumnSpy).toHaveBeenCalledWith('geographies', 'in_param', {
        type: 'varchar(25)',
      })
      expect(alterColumnSpy).toHaveBeenCalledWith('geographies', 'ucgid_code', {
        type: 'varchar(20)',
      })
    })
  })
})
