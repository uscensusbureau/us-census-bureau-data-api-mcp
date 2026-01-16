import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  topicsTableArgs,
  up,
  down,
} from '../../migrations/1768496916541_create-topics-table.ts'

describe('Migration 1768496916541 - Create Topics Table', () => {
  let mockPgm: MigrationBuilder
  let createTableSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>
  let dropTableSpy: ReturnType<typeof vi.fn>
  let funcSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createTableSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)
    dropTableSpy = vi.fn().mockResolvedValue(undefined)
    funcSpy = vi.fn().mockResolvedValue(undefined)

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
    beforeEach(async () => {
      await up(mockPgm)
    })

    it('creates the Topics table', () => {
      expect(createTableSpy).toHaveBeenCalledWith(
        'topics',
        topicsTableArgs(mockPgm),
      )
    })

    it('creates indexes for the Topics table', () => {
      expect(createIndexSpy).toHaveBeenCalledWith('topics', 'parent_topic_id')
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('drops the Topics table', () => {
      expect(dropTableSpy).toHaveBeenCalledWith('topics', { cascade: true })
    })
  })
})
