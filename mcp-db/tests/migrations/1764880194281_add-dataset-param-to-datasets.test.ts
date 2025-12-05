import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  up,
  down,
} from '../../migrations/1764880194281_add-dataset-param-to-datasets'

describe('Migration 1764880194281 - Add dataset_param to Datasets Table', () => {
  let mockPgm: MigrationBuilder
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let addConstraintSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>
  let dropConstraintSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    addConstraintSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropConstraintSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumns: addColumnsSpy,
      addConstraint: addConstraintSpy,
      dropColumns: dropColumnsSpy,
      dropConstraint: dropConstraintSpy,
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

    it('should add dataset_param column to datasets', async () => {
      expect(addColumnsSpy).toHaveBeenCalledWith('datasets', {
        dataset_param: {
          type: 'varchar(100)',
          notNull: true,
        },
        description: {
          type: 'text',
          notNull: true,
        },
      })
    })

    it('should add constraint to dataset_id column', async () => {
      expect(addConstraintSpy).toHaveBeenCalledWith(
        'datasets',
        'datasets_dataset_id_unique',
        'UNIQUE(dataset_id)',
      )
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })
    it('should drop dataset_param column from datasets', async () => {
      expect(dropColumnsSpy).toHaveBeenCalledWith('datasets', [
        'dataset_param',
        'description',
      ])
    })

    it('should drop constraint from dataset_id column', async () => {
      expect(dropConstraintSpy).toHaveBeenCalledWith(
        'datasets',
        'datasets_dataset_id_unique',
      )
    })
  })
})
