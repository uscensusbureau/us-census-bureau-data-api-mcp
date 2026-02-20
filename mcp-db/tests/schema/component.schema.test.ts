import { describe, expect, it } from 'vitest'
import {
  RawComponentSchema,
  RawComponentsArraySchema,
  ComponentRecordSchema,
  transformComponentData,
} from '../../src/schema/components.schema'

const validRawComponentData = {
  COMPONENT_STRING: 'ACSSE',
  COMPONENT_LABEL: '1-Year Supplemental Estimates',
  COMPONENT_DESCRIPTION:
    'ACS 1-Year Supplemental Estimates extend standard 1-year ACS coverage to smaller geographic areas.',
  API_SHORT_NAME: 'acs/acsse',
  PROGRAM_STRING: 'ACS',
}

const invalidRawComponentData = {
  COMPONENT_STRING: 'ACSSE',
  COMPONENT_LABEL: '1-Year Supplemental Estimates',
  // Missing COMPONENT_DESCRIPTION, API_SHORT_NAME, PROGRAM_STRING
}

const multipleRawComponents = [
  {
    COMPONENT_STRING: 'ACSSE',
    COMPONENT_LABEL: '1-Year Supplemental Estimates',
    COMPONENT_DESCRIPTION: 'ACS 1-Year Supplemental Estimates.',
    API_SHORT_NAME: 'acs/acsse',
    PROGRAM_STRING: 'ACS',
  },
  {
    COMPONENT_STRING: 'ACSDT5Y',
    COMPONENT_LABEL: 'Detailed Tables 5-Year',
    COMPONENT_DESCRIPTION: 'ACS 5-Year Detailed Tables.',
    API_SHORT_NAME: 'acs/acs5',
    PROGRAM_STRING: 'ACS',
  },
  {
    COMPONENT_STRING: 'ACSSE',
    COMPONENT_LABEL: '1-Year Supplemental Estimates',
    COMPONENT_DESCRIPTION: 'ACS 1-Year Supplemental Estimates.',
    API_SHORT_NAME: 'acs/acsse',
    PROGRAM_STRING: 'ACS',
  },
]

const programIdMap = new Map<string, number>([
  ['ACS', 1],
  ['CPS', 2],
])

describe('ComponentsSchema', () => {
  describe('RawComponentsArraySchema', () => {
    it('should validate array of raw components', () => {
      const result = RawComponentsArraySchema.safeParse([validRawComponentData])
      expect(result.success).toBe(true)
    })

    it('should invalidate array of incorrect raw components', () => {
      const result = RawComponentsArraySchema.safeParse([
        invalidRawComponentData,
      ])
      expect(result.success).toBe(false)
    })

    it('should validate multiple raw components', () => {
      const result = RawComponentsArraySchema.safeParse(multipleRawComponents)
      expect(result.success).toBe(true)
    })
  })

  describe('RawComponentSchema', () => {
    it('should validate components.csv fields', () => {
      const result = RawComponentSchema.safeParse(validRawComponentData)
      expect(result.success).toBe(true)
    })

    it('should invalidate missing COMPONENT_DESCRIPTION', () => {
      const result = RawComponentSchema.safeParse({
        ...validRawComponentData,
        COMPONENT_DESCRIPTION: undefined,
      })
      expect(result.success).toBe(false)
    })

    it('should invalidate missing API_SHORT_NAME', () => {
      const result = RawComponentSchema.safeParse({
        ...validRawComponentData,
        API_SHORT_NAME: undefined,
      })
      expect(result.success).toBe(false)
    })

    it('should invalidate missing PROGRAM_STRING', () => {
      const result = RawComponentSchema.safeParse({
        ...validRawComponentData,
        PROGRAM_STRING: undefined,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ComponentRecordSchema', () => {
    it('validates a complete record', () => {
      const result = ComponentRecordSchema.safeParse({
        component_id: 'ACSSE',
        label: '1-Year Supplemental Estimates',
        description: 'ACS 1-Year Supplemental Estimates.',
        api_endpoint: 'acs/acsse',
        program_id: 1,
      })
      expect(result.success).toBe(true)
    })

    it('invalidates a record with string program_id', () => {
      const result = ComponentRecordSchema.safeParse({
        component_id: 'ACSSE',
        label: '1-Year Supplemental Estimates',
        description: 'ACS 1-Year Supplemental Estimates.',
        api_endpoint: 'acs/acsse',
        program_id: 'ACS', // Should be number
      })
      expect(result.success).toBe(false)
    })

    it('invalidates a record missing program_id', () => {
      const result = ComponentRecordSchema.safeParse({
        component_id: 'ACSSE',
        label: '1-Year Supplemental Estimates',
        description: 'ACS 1-Year Supplemental Estimates.',
        api_endpoint: 'acs/acsse',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('transformComponentData', () => {
    it('returns deduplicated components with resolved program_ids', () => {
      const result = transformComponentData(multipleRawComponents, programIdMap)
      expect(result).toHaveLength(2) // ACSSE and ACSDT5Y
    })

    it('transforms data with correct field mappings', () => {
      const result = transformComponentData(
        [validRawComponentData],
        programIdMap,
      )
      expect(result[0]).toEqual({
        component_id: 'ACSSE',
        label: '1-Year Supplemental Estimates',
        description:
          'ACS 1-Year Supplemental Estimates extend standard 1-year ACS coverage to smaller geographic areas.',
        api_endpoint: 'acs/acsse',
        program_id: 1,
      })
    })

    it('deduplicates components by component_id', () => {
      const result = transformComponentData(multipleRawComponents, programIdMap)
      expect(result).toHaveLength(2)
      expect(result[0].component_id).toBe('ACSSE')
      expect(result[1].component_id).toBe('ACSDT5Y')
    })

    it('resolves program_id from programIdMap', () => {
      const result = transformComponentData(
        [validRawComponentData],
        programIdMap,
      )
      expect(result[0].program_id).toBe(1)
    })

    it('preserves first occurrence when deduplicating', () => {
      const duplicatesWithDifferentLabels = [
        { ...validRawComponentData, COMPONENT_LABEL: 'First Label' },
        { ...validRawComponentData, COMPONENT_LABEL: 'Second Label' },
      ]
      const result = transformComponentData(
        duplicatesWithDifferentLabels,
        programIdMap,
      )
      expect(result).toHaveLength(1)
      expect(result[0].label).toBe('First Label')
    })

    it('throws error for invalid data', () => {
      expect(() =>
        transformComponentData([invalidRawComponentData], programIdMap),
      ).toThrow()
    })

    it('throws when programIdMap is empty', () => {
      expect(() =>
        transformComponentData([validRawComponentData], new Map()),
      ).toThrow(
        'transformComponentData called with empty programIdMap — ensure programs are seeded before components',
      )
    })

    it('throws listing all programs missing from programIdMap', () => {
      const unknownProgramComponent = {
        ...validRawComponentData,
        PROGRAM_STRING: 'UNKNOWN_PROGRAM',
      }
      const anotherUnknownProgramComponent = {
        ...validRawComponentData,
        COMPONENT_STRING: 'ACSDT5Y',
        PROGRAM_STRING: 'ANOTHER_UNKNOWN',
      }

      expect(() =>
        transformComponentData(
          [unknownProgramComponent, anotherUnknownProgramComponent],
          programIdMap,
        ),
      ).toThrow(
        'Components reference programs not found in programIdMap: UNKNOWN_PROGRAM, ANOTHER_UNKNOWN',
      )
    })

    it('reports each missing program acronym only once regardless of how many components reference it', () => {
      const manyWithSameMissingProgram = [
        {
          ...validRawComponentData,
          COMPONENT_STRING: 'COMP_A',
          PROGRAM_STRING: 'MISSING',
        },
        {
          ...validRawComponentData,
          COMPONENT_STRING: 'COMP_B',
          PROGRAM_STRING: 'MISSING',
        },
        {
          ...validRawComponentData,
          COMPONENT_STRING: 'COMP_C',
          PROGRAM_STRING: 'MISSING',
        },
      ]

      expect(() =>
        transformComponentData(manyWithSameMissingProgram, programIdMap),
      ).toThrow(
        'Components reference programs not found in programIdMap: MISSING',
      )
    })

    it('throws only for missing programs, not for valid ones in a mixed batch', () => {
      const mixedComponents = [
        validRawComponentData,
        {
          ...validRawComponentData,
          COMPONENT_STRING: 'COMP_X',
          PROGRAM_STRING: 'UNKNOWN_PROGRAM',
        },
      ]

      expect(() =>
        transformComponentData(mixedComponents, programIdMap),
      ).toThrow('UNKNOWN_PROGRAM')
    })
  })
})
