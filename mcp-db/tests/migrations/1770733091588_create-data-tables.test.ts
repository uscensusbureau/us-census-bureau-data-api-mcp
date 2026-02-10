import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  dataTableArgs,
  dataTableDatasetArgs,
  up,
  down,
} from '../../migrations/1770733091588_create-data-tables'

describe('Migration 1770733091588 - Create Data Tables', () => {
  let mockPgm: MigrationBuilder
  let createTableSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>
  let addConstraintSpy: ReturnType<typeof vi.fn>
  let dropTableSpy: ReturnType<typeof vi.fn>
  let funcSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createTableSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)
    addConstraintSpy = vi.fn().mockResolvedValue(undefined)
    dropTableSpy = vi.fn().mockResolvedValue(undefined)
    funcSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      createTable: createTableSpy,
      createIndex: createIndexSpy,
      addConstraint: addConstraintSpy,
      dropTable: dropTableSpy,
      func: funcSpy,
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

    it('creates a data_tables table', () => {
      expect(createTableSpy).toHaveBeenCalledWith(
        'data_tables',
        dataTableArgs(mockPgm),
      )
    })

    it('creates a data_table_datasets join table', () => {
      expect(createTableSpy).toHaveBeenCalledWith(
        'data_table_datasets',
        dataTableDatasetArgs(mockPgm),
      )
    })

    it('creates the necessary indexes', () => {
      expect(createIndexSpy).toHaveBeenCalledWith(
        'data_table_datasets',
        'data_table_id',
      )
    })

    it('adds a unique constraint on dataset_id and data_table_id', () => {
      expect(addConstraintSpy).toHaveBeenCalledWith(
        'data_table_datasets',
        'data_table_datasets_unique',
        {
          unique: ['dataset_id', 'data_table_id'],
        },
      )
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('drops the data_table_datasets join table', () => {
      expect(dropTableSpy).toHaveBeenCalledWith('data_table_datasets')
    })

    it('drops the data_tables table', () => {
      expect(dropTableSpy).toHaveBeenCalledWith('data_tables')
    })
  })
})
