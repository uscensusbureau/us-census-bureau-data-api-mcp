import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  down,
  up,
} from '../../migrations/1757432274608_add-place-code-to-geographies'

describe('Migration 1757432274608 - Add Place Code to Geographies', () => {
  let mockPgm: MigrationBuilder
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumns: addColumnsSpy,
      dropColumns: dropColumnsSpy,
    } as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('up', () => {
    it('should add place_code column to geographies', async () => {
      await up(mockPgm)

      expect(addColumnsSpy).toHaveBeenCalledWith('geographies', {
        place_code: 'char(5)',
      })
    })
  })

  describe('down', () => {
    it('should drop place_code column from geographies', async () => {
      await down(mockPgm)

      expect(dropColumnsSpy).toHaveBeenCalledWith('geographies', ['place_code'])
    })
  })
})
