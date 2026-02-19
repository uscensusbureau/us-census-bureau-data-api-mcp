import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  programsArgs,
  componentsArgs,
  up,
  down,
} from '../../migrations/1771447308817_create-components'

describe('Migration - Create Programs and Components Tables', () => {
  let mockPgm: MigrationBuilder
  let createTableSpy: ReturnType<typeof vi.fn>
  let dropTableSpy: ReturnType<typeof vi.fn>
  let createIndexSpy: ReturnType<typeof vi.fn>
  let funcSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    funcSpy = vi.fn((name: string) => name)
    createTableSpy = vi.fn().mockResolvedValue(undefined)
    dropTableSpy = vi.fn().mockResolvedValue(undefined)
    createIndexSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      createTable: createTableSpy,
      dropTable: dropTableSpy,
      createIndex: createIndexSpy,
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

    it('creates the programs table', () => {
      expect(createTableSpy).toHaveBeenCalledWith(
        'programs',
        programsArgs(mockPgm),
      )
    })

    it('creates the components table', () => {
      expect(createTableSpy).toHaveBeenCalledWith(
        'components',
        componentsArgs(mockPgm),
      )
    })

    it('creates programs table before components table', () => {
      const programsCall = createTableSpy.mock.calls.findIndex(
        (call) => call[0] === 'programs',
      )
      const componentsCall = createTableSpy.mock.calls.findIndex(
        (call) => call[0] === 'components',
      )

      expect(programsCall).toBeLessThan(componentsCall)
    })

    it('creates an index on components.program_id', () => {
      expect(createIndexSpy).toHaveBeenCalledWith('components', 'program_id')
    })

    it('creates tables before indexes', () => {
      const lastCreateTableOrder = Math.max(
        ...createTableSpy.mock.invocationCallOrder,
      )
      const firstCreateIndexOrder = Math.min(
        ...createIndexSpy.mock.invocationCallOrder,
      )

      expect(lastCreateTableOrder).toBeLessThan(firstCreateIndexOrder)
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('drops the components table', () => {
      expect(dropTableSpy).toHaveBeenCalledWith('components')
    })

    it('drops the programs table', () => {
      expect(dropTableSpy).toHaveBeenCalledWith('programs')
    })

    it('drops components before programs to respect foreign key constraints', () => {
      const componentsCall = dropTableSpy.mock.calls.findIndex(
        (call) => call[0] === 'components',
      )
      const programsCall = dropTableSpy.mock.calls.findIndex(
        (call) => call[0] === 'programs',
      )

      expect(componentsCall).toBeLessThan(programsCall)
    })
  })
})
