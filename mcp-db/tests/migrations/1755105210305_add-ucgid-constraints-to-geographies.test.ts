import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

import {
  down,
  up,
} from '../../migrations/1755105210305_add-ucgid-constraints-to-geographies'

describe('Migration 1755105210305 - Add UCGID to Geographies', () => {
  let mockPgm: MigrationBuilder
  let addConstraintSpy: ReturnType<typeof vi.fn>
  let dropConstraintSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addConstraintSpy = vi.fn().mockResolvedValue(undefined)
    dropConstraintSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addConstraint: addConstraintSpy,
      dropConstraint: dropConstraintSpy,
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

    it('should add columns to geographies', async () => {
      expect(addConstraintSpy).toHaveBeenCalledWith(
        'geographies',
        'geographies_ucgid_code_unique',
        'UNIQUE(ucgid_code)',
      )
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await down(mockPgm)
    })

    it('should drop columns from geographies', async () => {
      expect(dropConstraintSpy).toHaveBeenCalledWith(
        'geographies',
        'geographies_ucgid_code_unique',
      )
    })
  })
})
