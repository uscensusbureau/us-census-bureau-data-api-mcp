import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  down,
  geoYearsArgs,
  up,
  yearsArgs,
} from '../../migrations/1755190777124_create-years-table'

describe('Migration 1755190777124 - Create Years Table', () => {
  let mockPgm: MigrationBuilder
  let sqlSpy: ReturnType<typeof vi.fn>
  let addConstraintSpy: ReturnType<typeof vi.fn>
  let createTableSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>
  let dropTableSpy: ReturnType<typeof vi.fn>
  let funcSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sqlSpy = vi.fn().mockResolvedValue(undefined)
    createTableSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)
    dropTableSpy = vi.fn().mockResolvedValue(undefined)
    addConstraintSpy = vi.fn().mockResolvedValue(undefined)
    funcSpy = vi.fn((sql: string) => `POSTGRES_FUNCTION(${sql})`) // Mock function wrapper

    mockPgm = {
      sql: sqlSpy,
      createTable: createTableSpy,
      createIndex: createIndexSpy,
      dropTable: dropTableSpy,
      func: funcSpy,
      addConstraint: addConstraintSpy,
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

    it('should create the years table', async () => {
      expect(createTableSpy).toHaveBeenCalledWith('years', yearsArgs)
    })

    it('should create the geography_years table', async () => {
      expect(createTableSpy).toHaveBeenCalledWith(
        'geography_years',
        geoYearsArgs,
      )
    })

    it('should add a unique constraint for geography_years', async () => {
      expect(addConstraintSpy).toHaveBeenCalledWith(
        'geography_years',
        'geography_years_unique',
        'UNIQUE(geography_id, year_id)',
      )
    })

    it('should index the geography_id in the geography_years table', async () => {
      expect(createIndexSpy).toHaveBeenCalledWith(
        'geography_years',
        'geography_id',
      )
    })

    it('should index the year_id in the geography_years table', async () => {
      expect(createIndexSpy).toHaveBeenCalledWith('geography_years', 'year_id')
    })
  })

  describe('down', () => {
    it('should drop the years table', async () => {
      await down(mockPgm)

      expect(dropTableSpy).toHaveBeenCalledWith('years')
    })

    it('should drop the geography_years table', async () => {
      await down(mockPgm)

      expect(dropTableSpy).toHaveBeenCalledWith('geography_years')
    })
  })
})
