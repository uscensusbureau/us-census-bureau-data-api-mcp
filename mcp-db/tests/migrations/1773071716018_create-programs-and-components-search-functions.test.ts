import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { MigrationBuilder } from 'node-pg-migrate'

vi.mock('fs', () => ({
  readFileSync: vi
    .fn()
    .mockReturnValue(
      `COMPONENT_STRING,COMPONENT_LABEL,COMPONENT_DESCRIPTION,API_SHORT_NAME,PROGRAM_STRING,PROGRAM_LABEL,FREQUENCY,FREQUENCY_NOTES,PROGRAM_DESCRIPTION\n` +
        `acs/acs1,1-Year Estimates,ACS 1-year estimates,acs/acs1,ACS,American Community Survey,Annual,,Continuous monthly survey pooled into 1-year and 5-year estimates\n` +
        `dec/dec1,Summary File 1,Decennial summary file,dec/dec1,DEC,It's the Decennial Census,,Notes with 'quotes',It's the Decennial Census description\n`,
    ),
}))

describe('Migration - Create Programs and Components Search Functions', () => {
  let mockPgm: MigrationBuilder
  let addColumnsSpy: ReturnType<typeof vi.fn>
  let dropColumnsSpy: ReturnType<typeof vi.fn>
  let sqlSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    addColumnsSpy = vi.fn().mockResolvedValue(undefined)
    dropColumnsSpy = vi.fn().mockResolvedValue(undefined)
    sqlSpy = vi.fn().mockResolvedValue(undefined)

    mockPgm = {
      addColumns: addColumnsSpy,
      dropColumns: dropColumnsSpy,
      sql: sqlSpy,
    } as Partial<MigrationBuilder> as MigrationBuilder
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('updateProgramComponentColumns SQL', () => {
    let updateProgramComponentColumns: string

    beforeEach(async () => {
      const migration = await import(
        '../../migrations/1773071716018_create-programs-and-components-search-functions'
      )
      updateProgramComponentColumns = migration.updateProgramComponentColumns
    })

    it('escapes single quotes in program descriptions', () => {
      expect(updateProgramComponentColumns).toContain(
        `'It''s the Decennial Census description'`,
      )
    })

    it('escapes single quotes in component frequency_notes', () => {
      expect(updateProgramComponentColumns).toContain(`'Notes with ''quotes'''`)
    })

    it('converts empty frequency to NULL', () => {
      expect(updateProgramComponentColumns).toContain(`'dec/dec1', NULL,`)
    })

    it('converts empty frequency_notes to NULL', () => {
      expect(updateProgramComponentColumns).toContain(
        `'acs/acs1', 'Annual', NULL`,
      )
    })

    it('includes valid program values', () => {
      expect(updateProgramComponentColumns).toContain(
        `'ACS', 'Continuous monthly survey pooled into 1-year and 5-year estimates'`,
      )
    })
  })

  describe('up', () => {
    beforeEach(async () => {
      const { up } = await import(
        '../../migrations/1773071716018_create-programs-and-components-search-functions'
      )
      await up(mockPgm)
    })

    it('adds frequency and frequency_notes columns to components', () => {
      expect(addColumnsSpy).toHaveBeenCalledWith('components', {
        frequency: { type: 'varchar(50)' },
        frequency_notes: { type: 'text' },
      })
    })

    it('runs the backfill SQL for program and component columns', async () => {
      const { updateProgramComponentColumns } = vi.mocked(
        await import(
          '../../migrations/1773071716018_create-programs-and-components-search-functions'
        ),
      )
      expect(sqlSpy).toHaveBeenCalledWith(updateProgramComponentColumns)
    })

    it('runs backfill before creating survey functions', () => {
      const backfillOrder = sqlSpy.mock.invocationCallOrder[0]
      const programsFnOrder = sqlSpy.mock.invocationCallOrder[1]
      const componentsFnOrder = sqlSpy.mock.invocationCallOrder[2]

      expect(backfillOrder).toBeLessThan(programsFnOrder)
      expect(backfillOrder).toBeLessThan(componentsFnOrder)
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      const { down } = await import(
        '../../migrations/1773071716018_create-programs-and-components-search-functions'
      )
      await down(mockPgm)
    })

    it('drops the list_survey_components function', () => {
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP FUNCTION IF EXISTS list_survey_components(TEXT)',
      )
    })

    it('drops the list_survey_programs function', () => {
      expect(sqlSpy).toHaveBeenCalledWith(
        'DROP FUNCTION IF EXISTS list_survey_programs()',
      )
    })

    it('drops frequency and frequency_notes columns from components', () => {
      expect(dropColumnsSpy).toHaveBeenCalledWith('components', [
        'frequency',
        'frequency_notes',
      ])
    })

    it('nulls out program descriptions', () => {
      expect(sqlSpy).toHaveBeenCalledWith(
        'UPDATE programs SET description = NULL;',
      )
    })

    it('drops functions before dropping columns', () => {
      const dropColumnsOrder = dropColumnsSpy.mock.invocationCallOrder[0]
      const dropComponentsFnOrder = sqlSpy.mock.invocationCallOrder[0]

      expect(dropComponentsFnOrder).toBeLessThan(dropColumnsOrder)
    })
  })
})
