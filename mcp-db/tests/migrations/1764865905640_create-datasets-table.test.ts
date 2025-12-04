import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  datasetsArgs,
  up,
  down,
} from '../../migrations/1764865905640_create-datasets-table'

describe('Migration 1764865905640 - Create Datasets Table', () => {
  let mockPgm: MigrationBuilder
  let createTableSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>
  let dropTableSpy: ReturnType<typeof vi.fn>
  let funcSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createTableSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)
    dropTableSpy = vi.fn().mockResolvedValue(undefined)
    funcSpy = vi.fn((sql: string) => `POSTGRES_FUNCTION(${sql})`)

    mockPgm = {
      createTable: createTableSpy,
      createIndex: createIndexSpy,
      dropTable: dropTableSpy,
      func: funcSpy,
    } as Partial<MigrationBuilder> as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    it('should create the datasets table with dataset_id indexed', async () => {
      await up(mockPgm)
      expect(createTableSpy).toHaveBeenCalledWith('datasets', datasetsArgs)
      expect(createIndexSpy).toHaveBeenCalledWith('datasets', 'dataset_id')
    })
  })

  describe('down', () => {
    it('should drop functions', async () => {
      await down(mockPgm)

      expect(dropTableSpy).toHaveBeenCalledWith('datasets')
    })
  })
})
