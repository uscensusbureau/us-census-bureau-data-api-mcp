import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  searchGeographiesBySummaryLevelSql,
  searchGeographiesBySummaryLevelReturnSql,
} from '../../migrations/1756926825327_add-geographies-search-functions'

import {
  updatedSearchGeographiesBySummaryLevelSql,
  updatedSearchGeographiesBySummaryLevelReturnSql,
  up,
  down,
} from '../../migrations/1770647177491_fix-search-geographies-by-summary-level.js'

describe('Migration 1770647177491 - Fix Search Geographies by Summary Level', () => {
  let mockPgm: MigrationBuilder
  let dropFunctionSpy: ReturnType<typeof vi.fn>
  let createFunctionSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    dropFunctionSpy = vi.fn().mockResolvedValue(undefined)
    createFunctionSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      dropFunction: dropFunctionSpy,
      createFunction: createFunctionSpy,
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

    it('drops the old search_geographies_by_summary_level function', () => {
      expect(dropFunctionSpy).toHaveBeenCalledWith(
        'search_geographies_by_summary_level',
        ['TEXT', 'TEXT', 'INTEGER'],
      )
    })

    it('recreates search_geographies_by_summary_level with fixed SQL', () => {
      expect(createFunctionSpy).toHaveBeenCalledWith(
        'search_geographies_by_summary_level',
        [
          { name: 'search_term', type: 'TEXT' },
          { name: 'summary_level_code', type: 'TEXT' },
          { name: 'result_limit', type: 'INTEGER', default: 10 },
        ],
        {
          returns: updatedSearchGeographiesBySummaryLevelReturnSql,
          language: 'sql',
        },
        updatedSearchGeographiesBySummaryLevelSql,
      )
    })

    it('uses positional parameters in the SQL query', () => {
      // Verify that the SQL uses $1, $2, $3 instead of named parameters
      expect(updatedSearchGeographiesBySummaryLevelSql).toContain('$1')
      expect(updatedSearchGeographiesBySummaryLevelSql).toContain('$2')
      expect(updatedSearchGeographiesBySummaryLevelSql).toContain('$3')
      expect(updatedSearchGeographiesBySummaryLevelSql).toContain(
        'g.summary_level_code = $2',
      )
    })

    it('calls createFunction after dropFunction', () => {
      const callOrder = vi.mocked(mockPgm.dropFunction).mock
        .invocationCallOrder[0]
      const createCallOrder = vi.mocked(mockPgm.createFunction).mock
        .invocationCallOrder[0]
      expect(callOrder).toBeLessThan(createCallOrder)
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('drops the updated search_geographies_by_summary_level function', () => {
      expect(dropFunctionSpy).toHaveBeenCalledWith(
        'search_geographies_by_summary_level',
        ['TEXT', 'TEXT', 'INTEGER'],
      )
    })

    it('recreates the original search_geographies_by_summary_level function', () => {
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
        },
        searchGeographiesBySummaryLevelSql,
      )
    })
  })
})
