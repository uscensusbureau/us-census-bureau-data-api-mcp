import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('../../../src/schema/program.schema', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/schema/program.schema')>()
  return {
    ...actual,
    transformProgramData: vi.fn(actual.transformProgramData),
  }
})

import { Client } from 'pg'
import { ProgramsConfig } from '../../../src/seeds/configs/programs.config'
import { transformProgramData } from '../../../src/schema/program.schema'

const fixturePrograms = [
  {
    COMPONENT_STRING: 'ACSSE',
    COMPONENT_LABEL: '1-Year Supplemental Estimates',
    COMPONENT_DESCRIPTION: 'ACS 1-Year Supplemental Estimates.',
    API_SHORT_NAME: 'acs/acsse',
    PROGRAM_STRING: 'ACS',
    PROGRAM_LABEL: 'American Community Survey',
    FREQUENCY: 'Annual',
    FREQUENCY_NOTES: '',
    PROGRAM_DESCRIPTION:
      'Continuous monthly survey pooled into 1-year and 5-year estimates, covering demographics, income, education, housing, and commuting for all U.S. geographies.',
  },
  {
    COMPONENT_STRING: 'ACSDT5Y',
    COMPONENT_LABEL: 'Detailed Tables 5-Year',
    COMPONENT_DESCRIPTION: 'ACS 5-Year Detailed Tables.',
    API_SHORT_NAME: 'acs/acs5',
    PROGRAM_STRING: 'ACS',
    PROGRAM_LABEL: 'American Community Survey',
    FREQUENCY: 'Annual',
    FREQUENCY_NOTES: '',
    PROGRAM_DESCRIPTION:
      'Continuous monthly survey pooled into 1-year and 5-year estimates, covering demographics, income, education, housing, and commuting for all U.S. geographies.',
  },
  {
    COMPONENT_STRING: 'CPSMARCH',
    COMPONENT_LABEL: 'March Supplement',
    COMPONENT_DESCRIPTION: 'Annual Social and Economic Supplement.',
    API_SHORT_NAME: 'cps/march',
    PROGRAM_STRING: 'CPS',
    PROGRAM_LABEL: 'Current Population Survey',
    FREQUENCY: 'Annual',
    FREQUENCY_NOTES: '',
    PROGRAM_DESCRIPTION:
      'Monthly labor force survey providing official U.S. unemployment statistics.',
  },
]

describe('Programs Config', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should have valid configuration structure', () => {
    expect(ProgramsConfig).toBeDefined()
    expect(ProgramsConfig.table).toBe('programs')
    expect(ProgramsConfig.file).toBe('components-programs.csv')
    expect(ProgramsConfig.conflictColumn).toBe('acronym')
    expect(ProgramsConfig.beforeSeed).toBeDefined()
  })

  describe('beforeSeed', () => {
    it('should call transformProgramData with rawData', () => {
      const mockClient = {} as Client
      const rawData: unknown[] = [...fixturePrograms]

      ProgramsConfig.beforeSeed!(mockClient, rawData)

      expect(transformProgramData).toHaveBeenCalledWith(rawData)
    })

    it('should replace rawData in place with transformed programs', () => {
      const mockClient = {} as Client
      const rawData: unknown[] = [...fixturePrograms]

      ProgramsConfig.beforeSeed!(mockClient, rawData)

      expect((rawData[0] as Record<string, unknown>).acronym).toBeDefined()
      expect(
        (rawData[0] as Record<string, unknown>).PROGRAM_STRING,
      ).toBeUndefined()
    })

    it('should handle empty data array', () => {
      const mockClient = {} as Client
      expect(() => ProgramsConfig.beforeSeed!(mockClient, [])).not.toThrow()
    })
  })
})
