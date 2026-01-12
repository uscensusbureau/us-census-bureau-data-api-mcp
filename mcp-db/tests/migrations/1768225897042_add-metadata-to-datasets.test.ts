import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  up,
  down,
} from '../../migrations/1768225897042_add-metadata-to-datasets'

describe('Migration 1768225897042 - Add metadata to Datasets Table', () => {
  let mockPgm: MigrationBuilder
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let addConstraintSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>
  let dropConstraintSpy: ReturnType<typeof vi.fn>
  let sqlSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    addConstraintSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropConstraintSpy = vi.fn().mockResolvedValue(undefined)
    sqlSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumns: addColumnsSpy,
      addConstraint: addConstraintSpy,
      createIndex: createIndexSpy,
      dropColumns: dropColumnsSpy,
      dropConstraint: dropConstraintSpy,
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

    it('should delete datasets data', async () => {
      expect(sqlSpy).toHaveBeenCalledWith('DELETE FROM datasets')
    })

    it('should add type and temporal columns to datasets', async () => {
      expect(addColumnsSpy).toHaveBeenCalledWith('datasets', {
        type: {
          type: 'varchar(30)',
          notNull: true,
          check: "type IN ('aggregate', 'microdata', 'timeseries')",
        },
        temporal_start: {
          type: 'date',
        },
        temporal_end: {
          type: 'date',
        },
      })
    })

    it('should add constraint for valid temporal range', () => {
      expect(addConstraintSpy).toHaveBeenCalledWith(
        'datasets',
        'valid_temporal_range',
        {
          check:
            'temporal_start IS NULL OR temporal_end IS NULL OR temporal_start <= temporal_end',
        },
      )
    })

    it('should create index on type column', () => {
      expect(createIndexSpy).toHaveBeenCalledWith('datasets', 'type')
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })
    it('should drop type and temporal columns from datasets', async () => {
      expect(dropColumnsSpy).toHaveBeenCalledWith('datasets', [
        'type',
        'temporal_start',
        'temporal_end',
      ])
    })

    it('should drop temporal validation constraint', async () => {
      expect(dropConstraintSpy).toHaveBeenCalledWith(
        'datasets',
        'valid_temporal_range',
        { ifExists: true },
      )
    })
  })
})
