import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'
import {
  componentAssignmentSQL,
  datasetParamAssignmentSQL,
  updatesSearchDataTablesSQL,
  up,
  down,
} from '../../migrations/1771612752809_refactor-search-data-tables'
import { searchDataTablesSQL } from '../../migrations/1770926658900_add-data-tables-search-functions'

describe('Migration - Assign Component IDs to Datasets', () => {
  let mockPgm: MigrationBuilder
  let addColumnSpy: ReturnType<typeof vi.fn>
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let alterColumnSpy: ReturnType<typeof vi.fn>
  let dropColumnSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>
  let sqlSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addColumnSpy = vi.fn().mockResolvedValue(undefined)
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    alterColumnSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)
    sqlSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumn: addColumnSpy,
      addColumns: addColumnsSpy,
      alterColumn: alterColumnSpy,
      dropColumn: dropColumnSpy,
      createIndex: createIndexSpy,
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

    it('populates component_id before constraining it', () => {
      const sqlOrder = sqlSpy.mock.invocationCallOrder[0]
      const alterOrder = alterColumnSpy.mock.invocationCallOrder[0]

      expect(sqlOrder).toBeLessThan(alterOrder)
    })

    it('runs the component assignment SQL', () => {
      expect(sqlSpy).toHaveBeenCalledWith(componentAssignmentSQL)
    })

    it('constrains component_id to not null after population', () => {
      expect(alterColumnSpy).toHaveBeenCalledWith('datasets', 'component_id', {
        notNull: true,
      })
    })

    it('creates index after constraining column', () => {
      const alterOrder = alterColumnSpy.mock.invocationCallOrder[0]
      const indexOrder = createIndexSpy.mock.invocationCallOrder[0]

      expect(alterOrder).toBeLessThan(indexOrder)
    })

    it('creates an index on datasets.component_id', () => {
      expect(createIndexSpy).toHaveBeenCalledWith('datasets', ['component_id'])
    })

    it('drops dataset_param column', () => {
      expect(dropColumnSpy).toHaveBeenCalledWith('datasets', 'dataset_param')
    })

    it('drops dataset_param after index creation', () => {
      const indexOrder = createIndexSpy.mock.invocationCallOrder[0]
      const dropOrder = dropColumnSpy.mock.invocationCallOrder[0]

      expect(indexOrder).toBeLessThan(dropOrder)
    })

    it('runs the updated search function SQL', () => {
      expect(sqlSpy).toHaveBeenCalledWith(updatesSearchDataTablesSQL)
    })

    it('runs search function update after column changes', () => {
      const dropOrder = dropColumnSpy.mock.invocationCallOrder[0]
      const searchFnOrder = sqlSpy.mock.invocationCallOrder[1]

      expect(dropOrder).toBeLessThan(searchFnOrder)
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('restores dataset_param column', () => {
      expect(addColumnsSpy).toHaveBeenCalledWith('datasets', {
        dataset_param: {
          type: 'varchar(100)',
          notNull: true,
        },
      })
    })

    it('runs the dataset_param assignment SQL', () => {
      expect(sqlSpy).toHaveBeenCalledWith(datasetParamAssignmentSQL)
    })

    it('populates dataset_param before dropping component_id', () => {
      const sqlOrder = sqlSpy.mock.invocationCallOrder[0]
      const dropOrder = dropColumnSpy.mock.invocationCallOrder[0]

      expect(sqlOrder).toBeLessThan(dropOrder)
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
