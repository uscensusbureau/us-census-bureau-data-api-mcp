import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'
import {
  updatesSearchDataTablesSQL,
  up,
  down,
} from '../../migrations/1771612752809_refactor-search-data-tables'
import { searchDataTablesSQL } from '../../migrations/1770926658900_add-data-tables-search-functions'

describe('Migration - Assign Component IDs to Datasets', () => {
  let mockPgm: MigrationBuilder
  let addColumnSpy: ReturnType<typeof vi.fn>
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let dropColumnSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>
  let renameColumnSpy: ReturnType<typeof vi.fn>
  let sqlSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addColumnSpy = vi.fn().mockResolvedValue(undefined)
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)
    renameColumnSpy = vi.fn().mockResolvedValue(undefined)
    sqlSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumn: addColumnSpy,
      addColumns: addColumnsSpy,
      dropColumn: dropColumnSpy,
      createIndex: createIndexSpy,
      renameColumn: renameColumnSpy,
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

    it('adds component_id column as nullable', () => {
      expect(addColumnSpy).toHaveBeenCalledWith('datasets', {
        component_id: {
          type: 'bigint',
          notNull: false,
          references: 'components(id)',
          onDelete: 'CASCADE',
        },
      })
    })

    it('creates an index on datasets.component_id', () => {
      expect(createIndexSpy).toHaveBeenCalledWith('datasets', ['component_id'])
    })

    it('runs the updated search function SQL', () => {
      expect(sqlSpy).toHaveBeenCalledWith(updatesSearchDataTablesSQL)
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('renames api_endpoint column', () => {
      expect(renameColumnSpy).toHaveBeenCalledWith(
        'datasets',
        'api_endpoint',
        'dataset_param',
      )
    })

    it('drops component_id column', () => {
      expect(dropColumnSpy).toHaveBeenCalledWith('datasets', 'component_id')
    })

    it('restores the original search function', () => {
      expect(sqlSpy).toHaveBeenCalledWith(searchDataTablesSQL)
    })

    it('restores search function after column changes', () => {
      const dropOrder = dropColumnSpy.mock.invocationCallOrder[0]
      const searchFnOrder = sqlSpy.mock.invocationCallOrder[1]

      expect(dropOrder).toBeLessThan(searchFnOrder)
    })
  })
})
