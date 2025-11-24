import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  down,
  up,
} from '../../migrations/1756211211714_add-geography-codes-to-geographies'

describe('Migration 1756211211714 - Add Geography Codes to Geographies', () => {
  let mockPgm: MigrationBuilder
  let sqlSpy: ReturnType<typeof vi.fn>
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let alterColumnSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined)
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    alterColumnSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      sql: sqlSpy,
      addColumns: addColumnsSpy,
      alterColumn: alterColumnSpy,
      dropColumns: dropColumnsSpy,
      createIndex: createIndexSpy,
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

    it('should add the region and division code columns', async () => {
      expect(addColumnsSpy).toHaveBeenCalledWith('geographies', {
        region_code: { type: 'char(1)' },
        division_code: { type: 'char(1)' },
      })
    })

    it('should alter the county code column to match char(3) type', async () => {
      expect(alterColumnSpy).toHaveBeenCalledWith(
        'geographies',
        'county_code',
        { type: 'char(3)' },
      )
    })

    it('should index the region and division codes', async () => {
      expect(createIndexSpy).toHaveBeenCalledWith(
        'geographies',
        'division_code',
      )
      expect(createIndexSpy).toHaveBeenCalledWith('geographies', 'region_code')
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('should drop the region and division code columns', async () => {
      expect(dropColumnsSpy).toHaveBeenCalledWith('geographies', {
        region_code: { type: 'char(1)' },
        division_code: { type: 'char(1)' },
      })
    })

    it('should revert the county code column type', async () => {
      expect(alterColumnSpy).toHaveBeenCalledWith(
        'geographies',
        'county_code',
        { type: 'varchar(3)' },
      )
    })
  })
})
