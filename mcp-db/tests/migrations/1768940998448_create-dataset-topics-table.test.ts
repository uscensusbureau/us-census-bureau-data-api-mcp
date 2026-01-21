import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  datasetTopicsArgs,
  up,
  down,
} from '../../migrations/1768940998448_create-dataset-topics-table.js'

describe('Migration 1768940998448 - Create Dataset Topics Table', () => {
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

    it('creates a dataset_topics join table', () => {
      expect(createTableSpy).toHaveBeenCalledWith(
        'dataset_topics',
        datasetTopicsArgs(mockPgm),
      )
    })

    it('creates the necessary indexes', () => {
      expect(createIndexSpy).toHaveBeenCalledWith(
        'dataset_topics',
        'dataset_id',
      )
      expect(createIndexSpy).toHaveBeenCalledWith('dataset_topics', 'topic_id')
    })

    it('adds a unique constraint on dataset_id and topic_id', () => {
      expect(addConstraintSpy).toHaveBeenCalledWith(
        'dataset_topics',
        'dataset_topics_unique',
        'UNIQUE(dataset_id, topic_id)',
      )
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('drops the dataset_topics join table', () => {
      expect(dropTableSpy).toHaveBeenCalledWith('dataset_topics')
    })
  })
})
