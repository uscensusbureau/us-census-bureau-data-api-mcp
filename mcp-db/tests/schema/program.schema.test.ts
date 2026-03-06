import { describe, expect, it } from 'vitest'
import {
  RawProgramSchema,
  RawProgramsArraySchema,
  ProgramRecordSchema,
  transformProgramData,
} from '../../src/schema/program.schema'

const validRawProgramData = {
  PROGRAM_STRING: 'ACS',
  PROGRAM_LABEL: 'American Community Survey',
}

const invalidRawProgramData = {
  PROGRAM_STRING: 'ACS',
  // Missing PROGRAM_LABEL
}

const multipleRawPrograms = [
  {
    PROGRAM_STRING: 'ACS',
    PROGRAM_LABEL: 'American Community Survey',
  },
  {
    PROGRAM_STRING: 'ACS',
    PROGRAM_LABEL: 'American Community Survey',
  },
  {
    PROGRAM_STRING: 'CPS',
    PROGRAM_LABEL: 'Current Population Survey',
  },
]

describe('ProgramsSchema', () => {
  describe('RawProgramsArraySchema', () => {
    it('should validate array of raw programs', () => {
      const result = RawProgramsArraySchema.safeParse([validRawProgramData])
      expect(result.success).toBe(true)
    })

    it('should invalidate array of incorrect raw programs', () => {
      const result = RawProgramsArraySchema.safeParse([invalidRawProgramData])
      expect(result.success).toBe(false)
    })

    it('should validate multiple raw programs', () => {
      const result = RawProgramsArraySchema.safeParse(multipleRawPrograms)
      expect(result.success).toBe(true)
    })
  })

  describe('RawProgramSchema', () => {
    it('should validate components.csv program fields', () => {
      const result = RawProgramSchema.safeParse(validRawProgramData)
      expect(result.success).toBe(true)
    })

    it('should invalidate missing PROGRAM_LABEL', () => {
      const result = RawProgramSchema.safeParse(invalidRawProgramData)
      expect(result.success).toBe(false)
    })

    it('should invalidate missing PROGRAM_STRING', () => {
      const result = RawProgramSchema.safeParse({
        PROGRAM_LABEL: 'American Community Survey',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ProgramRecordSchema', () => {
    it('validates a complete record', () => {
      const result = ProgramRecordSchema.safeParse({
        acronym: 'ACS',
        label: 'American Community Survey',
      })
      expect(result.success).toBe(true)
    })

    it('invalidates a record missing acronym', () => {
      const result = ProgramRecordSchema.safeParse({
        label: 'American Community Survey',
      })
      expect(result.success).toBe(false)
    })

    it('invalidates a record missing label', () => {
      const result = ProgramRecordSchema.safeParse({
        acronym: 'ACS',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('transformProgramData', () => {
    it('returns deduplicated programs', () => {
      const result = transformProgramData(multipleRawPrograms)
      expect(result.programs).toHaveLength(2) // ACS and CPS
    })

    it('transforms data with correct field mappings', () => {
      const result = transformProgramData([validRawProgramData])
      expect(result.programs[0]).toEqual({
        acronym: 'ACS',
        label: 'American Community Survey',
      })
    })

    it('deduplicates programs by acronym', () => {
      const result = transformProgramData(multipleRawPrograms)
      expect(result.programs).toHaveLength(2)
      expect(result.programs[0].acronym).toBe('ACS')
      expect(result.programs[1].acronym).toBe('CPS')
    })

    it('preserves first occurrence when deduplicating', () => {
      const duplicatesWithDifferentLabels = [
        { PROGRAM_STRING: 'ACS', PROGRAM_LABEL: 'American Community Survey' },
        { PROGRAM_STRING: 'ACS', PROGRAM_LABEL: 'A Different Label' },
      ]
      const result = transformProgramData(duplicatesWithDifferentLabels)
      expect(result.programs).toHaveLength(1)
      expect(result.programs[0].label).toBe('American Community Survey')
    })

    it('throws error for invalid data', () => {
      expect(() => transformProgramData([invalidRawProgramData])).toThrow()
    })
  })
})
