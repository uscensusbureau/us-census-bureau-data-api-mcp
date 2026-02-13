import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  indexDataTableLabelSQL,
  indexDataTableDatasetsLabelSQL,
  searchDataTablesSQL,
  up,
  down,
} from '../../migrations/1770926658900_add-data-tables-search-functions'

describe('Migration 1770926658900 - Add Data Tables Search Functions', () => {
  let mockPgm: MigrationBuilder
  let sqlSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      sql: sqlSpy,
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

    it('creates the trigram index on data_tables.label', () => {
      expect(sqlSpy).toHaveBeenCalledWith(indexDataTableLabelSQL)
    })

    it('creates the trigram index on data_table_datasets.label', () => {
      expect(sqlSpy).toHaveBeenCalledWith(indexDataTableDatasetsLabelSQL)
    })

    it('creates the btree index on data_table_datasets.dataset_id', () => {
      expect(createIndexSpy).toHaveBeenCalledWith(
        'data_table_datasets',
        'dataset_id',
        { name: 'idx_dtd_dataset_id' },
      )
    })

    it('creates the search_data_tables function', () => {
      expect(sqlSpy).toHaveBeenCalledWith(searchDataTablesSQL)
    })

    it('runs exactly 3 sql calls and 1 createIndex call', () => {
      expect(sqlSpy).toHaveBeenCalledTimes(3)
      expect(createIndexSpy).toHaveBeenCalledTimes(1)
    })

    it('creates indexes before the search function', () => {
      const labelIndexCall = sqlSpy.mock.calls.findIndex(
        (call) => call[0] === indexDataTableLabelSQL,
      )
      const dtdIndexCall = sqlSpy.mock.calls.findIndex(
        (call) => call[0] === indexDataTableDatasetsLabelSQL,
      )
      const functionCall = sqlSpy.mock.calls.findIndex(
        (call) => call[0] === searchDataTablesSQL,
      )

      expect(labelIndexCall).toBeLessThan(functionCall)
      expect(dtdIndexCall).toBeLessThan(functionCall)
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('drops the search_data_tables function', () => {
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP FUNCTION IF EXISTS search_data_tables',
      )
    })

    it('drops the dataset_id index', () => {
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_dtd_dataset_id',
      )
    })

    it('drops the data_table_datasets label trigram index', () => {
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_dtd_label_trgm',
      )
    })

    it('drops the data_tables label trigram index', () => {
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_data_tables_label_trgm',
      )
    })

    it('runs exactly 4 sql calls', () => {
      expect(sqlSpy).toHaveBeenCalledTimes(4)
    })
  })
})
