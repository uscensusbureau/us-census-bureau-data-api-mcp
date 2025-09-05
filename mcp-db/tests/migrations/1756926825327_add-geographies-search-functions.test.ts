import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import { normalizeSQL } from '../helpers/normalize-sql'
import {
  down,
  dropFunctionSql,
  hierarchySql,
  searchGeographiesBySummaryLevelSql,
  searchGeographiesBySummaryLevelReturnSql,
  searchGeographiesSql,
  searchGeographiesReturnSql,
  summaryLevelsNameIdxSql,
  summaryLevelsCodeIdxSql,
  up,
} from '../../migrations/1756926825327_add-geographies-search-functions'

describe('Migration 1756926825327 - Add Geographies Search Functions', () => {
  let mockPgm: MigrationBuilder
  let sqlSpy: ReturnType<typeof vi.fn>
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>
  let addIndexSpy: ReturnType<typeof vi.fn>
  let dropIndexSpy: ReturnType<typeof vi.fn>
  let createFunctionSpy: ReturnType<typeof vi.fn>
  let dropFunctionSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined)
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)
    addIndexSpy = vi.fn().mockResolvedValue(undefined)
    dropIndexSpy = vi.fn().mockResolvedValue(undefined)
    createFunctionSpy = vi.fn().mockResolvedValue(undefined)
    dropFunctionSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      sql: sqlSpy,
      addColumns: addColumnsSpy,
      dropColumns: dropColumnsSpy,
      addIndex: addIndexSpy,
      dropIndex: dropIndexSpy,
      createFunction: createFunctionSpy,
      dropFunction: dropFunctionSpy,
    } as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    beforeEach(async () => {
      await up(mockPgm)
    })

    it('removes the old search functions if they exist', () => {
      expect(normalizeSQL(sqlSpy.mock.calls[0][0])).toBe(
        normalizeSQL(dropFunctionSql),
      )
    })

    it('adds hierarchy_level column to summary_levels', () => {
      expect(addColumnsSpy).toHaveBeenCalledWith('summary_levels', {
        hierarchy_level: { type: 'integer', default: 99 },
      })
    })

    it('seeds hierarchy_level data in summary_levels', () => {
      expect(normalizeSQL(sqlSpy.mock.calls[1][0])).toBe(
        normalizeSQL(hierarchySql),
      )
    })

    it('creates the geography search functions', () => {
      expect(createFunctionSpy).toHaveBeenCalledWith(
        'search_geographies',
        [
          { name: 'search_term', type: 'TEXT' },
          { name: 'result_limit', type: 'INTEGER', default: 10 },
        ],
        {
          returns: searchGeographiesReturnSql,
          language: 'sql',
          stable: true,
        },
        searchGeographiesSql,
      )

      expect(createFunctionSpy).toHaveBeenCalledWith(
        'search_geographies_by_summary_level',
        [
          { name: 'search_term', type: 'TEXT' },
          { name: 'summary_level_code', type: 'TEXT' },
          { name: 'result_limit', type: 'INTEGER', default: 10 },
        ],
        {
          returns: searchGeographiesBySummaryLevelReturnSql,
          language: 'sql',
          stable: true,
        },
        searchGeographiesBySummaryLevelSql,
      )
    })

    it('creates indexes on summary_levels table', async () => {
      expect(normalizeSQL(sqlSpy.mock.calls[2][0])).toBe(
        normalizeSQL(summaryLevelsNameIdxSql),
      )
      expect(normalizeSQL(sqlSpy.mock.calls[3][0])).toBe(
        normalizeSQL(summaryLevelsCodeIdxSql),
      )
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('drops the new search functions', async () => {
      expect(dropFunctionSpy).toHaveBeenCalledWith(
        'search_geographies_by_summary_level',
        ['TEXT', 'TEXT', 'INTEGER'],
      )

      expect(dropFunctionSpy).toHaveBeenCalledWith('search_geographies', [
        'TEXT',
        'INTEGER',
      ])

      expect(dropFunctionSpy).toHaveBeenCalledWith('search_summary_levels', [
        'TEXT',
        'INTEGER',
      ])
    })

    it('drops the hiearchy_level column on summary_levels', async () => {
      expect(dropColumnsSpy).toHaveBeenCalledWith('summary_levels', [
        'hierarchy_level',
      ])
    })

    it('drops the indexes summary_levels', () => {
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_summary_levels_name_gin;',
      )
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP INDEX IF EXISTS idx_summary_levels_code;',
      )
    })
  })
})
