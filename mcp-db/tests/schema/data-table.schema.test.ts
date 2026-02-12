import { describe, expect, it } from 'vitest'
import {
  RawConceptSchema,
  RawConceptsArraySchema,
  DataTableRecordSchema,
  DataTableDatasetCapturedSchema,
  DataTableDatasetDbSchema,
  transformDataTableData,
} from '../../src/schema/data-table.schema'

const validRawConceptData = {
  CONCEPT_LABEL: 'NATIVITY BY LANGUAGE SPOKEN AT HOME',
  CONCEPT_STRING: 'B16005D',
  DATASET_STRING: 'ACSDT5Y2009',
}

const invalidRawConceptData = {
  CONCEPT_LABEL: 'NATIVITY BY LANGUAGE SPOKEN AT HOME',
  CONCEPT_STRING: 'B16005D',
  // Missing DATASET_STRING
}

const multipleRawConcepts = [
  {
    CONCEPT_LABEL: 'NATIVITY BY LANGUAGE SPOKEN AT HOME',
    CONCEPT_STRING: 'B16005D',
    DATASET_STRING: 'ACSDT5Y2009',
  },
  {
    CONCEPT_LABEL: 'NATIVITY BY LANGUAGE SPOKEN AT HOME',
    CONCEPT_STRING: 'B16005D',
    DATASET_STRING: 'ACSDT5Y2017',
  },
  {
    CONCEPT_LABEL: 'MEDIAN HOUSEHOLD INCOME',
    CONCEPT_STRING: 'B19013',
    DATASET_STRING: 'ACSDT5Y2009',
  },
]

describe('DataTableSchema', () => {
  describe('RawConceptsArraySchema', () => {
    it('should validate array of raw concepts', () => {
      const result = RawConceptsArraySchema.safeParse([validRawConceptData])
      expect(result.success).toBe(true)
    })

    it('should invalidate array of incorrect raw concepts', () => {
      const result = RawConceptsArraySchema.safeParse([invalidRawConceptData])
      expect(result.success).toBe(false)
    })

    it('should validate multiple raw concepts', () => {
      const result = RawConceptsArraySchema.safeParse(multipleRawConcepts)
      expect(result.success).toBe(true)
    })
  })

  describe('RawConceptSchema', () => {
    it('should validate concept.csv fields', () => {
      const result = RawConceptSchema.safeParse(validRawConceptData)
      expect(result.success).toBe(true)
    })

    it('should invalidate incorrect concept.csv fields', () => {
      const result = RawConceptSchema.safeParse(invalidRawConceptData)
      expect(result.success).toBe(false)
    })

    it('should transform CONCEPT_LABEL to title case', () => {
      const result = RawConceptSchema.parse(validRawConceptData)
      expect(result.CONCEPT_LABEL).toBe('Nativity by Language Spoken at Home')
    })

    it('should handle already title-cased labels', () => {
      const titleCasedData = {
        CONCEPT_LABEL: 'Median Household Income',
        CONCEPT_STRING: 'B19013',
        DATASET_STRING: 'ACSDT5Y2009',
      }
      const result = RawConceptSchema.parse(titleCasedData)
      expect(result.CONCEPT_LABEL).toBe('Median Household Income')
    })

    it('should handle mixed case labels', () => {
      const mixedCaseData = {
        CONCEPT_LABEL: 'NaTiViTy By LaNgUaGe',
        CONCEPT_STRING: 'B16005D',
        DATASET_STRING: 'ACSDT5Y2009',
      }
      const result = RawConceptSchema.parse(mixedCaseData)
      expect(result.CONCEPT_LABEL).toBe('Nativity by Language')
    })
  })

  describe('DataTableRecordSchema', () => {
    it('validates a complete record', () => {
      const dataTableRecord = {
        data_table_id: 'B16005D',
        label: 'Nativity by Language Spoken at Home',
      }

      const result = DataTableRecordSchema.safeParse(dataTableRecord)
      expect(result.success).toBe(true)
    })

    it('invalidates an incomplete record', () => {
      const dataTableRecord = {
        data_table_id: 'B16005D',
        // Missing label
      }

      const result = DataTableRecordSchema.safeParse(dataTableRecord)
      expect(result.success).toBe(false)
    })
  })

  describe('DataTableDatasetCapturedSchema', () => {
    it('validates a complete captured relationship record with string IDs', () => {
      const capturedRecord = {
        data_table_id: 'B16005D',
        dataset_id: 'ACSDT5Y2009',
        label: 'Nativity by Language Spoken at Home',
      }

      const result = DataTableDatasetCapturedSchema.safeParse(capturedRecord)
      expect(result.success).toBe(true)
    })

    it('invalidates an incomplete captured relationship record', () => {
      const capturedRecord = {
        data_table_id: 'B16005D',
        // Missing dataset_id and label
      }

      const result = DataTableDatasetCapturedSchema.safeParse(capturedRecord)
      expect(result.success).toBe(false)
    })

    it('invalidates when IDs are not strings', () => {
      const invalidRecord = {
        data_table_id: 123, // Should be string
        dataset_id: 'ACSDT5Y2009',
        label: 'Test',
      }

      const result = DataTableDatasetCapturedSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })
  })

  describe('DataTableDatasetDbSchema', () => {
    it('validates a complete DB record with numeric IDs', () => {
      const dbRecord = {
        data_table_id: 1,
        dataset_id: 10,
        label: 'Nativity by Language Spoken at Home',
      }

      const result = DataTableDatasetDbSchema.safeParse(dbRecord)
      expect(result.success).toBe(true)
    })

    it('invalidates an incomplete DB record', () => {
      const dbRecord = {
        data_table_id: 1,
        // Missing dataset_id and label
      }

      const result = DataTableDatasetDbSchema.safeParse(dbRecord)
      expect(result.success).toBe(false)
    })

    it('invalidates when IDs are not numbers', () => {
      const invalidRecord = {
        data_table_id: 'B16005D', // Should be number
        dataset_id: 10,
        label: 'Test',
      }

      const result = DataTableDatasetDbSchema.safeParse(invalidRecord)
      expect(result.success).toBe(false)
    })
  })

  describe('transformDataTableData', () => {
    it('returns deduplicated data tables and relationships', () => {
      const result = transformDataTableData(multipleRawConcepts)

      expect(result.dataTables).toHaveLength(2) // B16005D and B19013
      expect(result.relationships).toHaveLength(3) // All 3 rows
    })

    it('transforms data with correct mappings and title case', () => {
      const result = transformDataTableData([validRawConceptData])

      expect(result.dataTables[0]).toEqual({
        data_table_id: 'B16005D',
        label: 'Nativity by Language Spoken at Home',
      })
    })

    it('creates correct relationships with string IDs and title-cased labels', () => {
      const result = transformDataTableData([validRawConceptData])

      expect(result.relationships[0]).toEqual({
        data_table_id: 'B16005D',
        dataset_id: 'ACSDT5Y2009',
        label: 'Nativity by Language Spoken at Home',
      })

      // Verify the IDs are strings (captured format, not DB format)
      expect(typeof result.relationships[0].data_table_id).toBe('string')
      expect(typeof result.relationships[0].dataset_id).toBe('string')
    })

    it('deduplicates data tables by data_table_id', () => {
      const duplicateConcepts = [
        {
          CONCEPT_LABEL: 'NATIVITY BY LANGUAGE SPOKEN AT HOME',
          CONCEPT_STRING: 'B16005D',
          DATASET_STRING: 'ACSDT5Y2009',
        },
        {
          CONCEPT_LABEL: 'NATIVITY BY LANGUAGE SPOKEN AT HOME',
          CONCEPT_STRING: 'B16005D',
          DATASET_STRING: 'ACSDT5Y2017',
        },
      ]

      const result = transformDataTableData(duplicateConcepts)

      // Should have only 1 data table (B16005D)
      expect(result.dataTables).toHaveLength(1)
      expect(result.dataTables[0].data_table_id).toBe('B16005D')
      expect(result.dataTables[0].label).toBe(
        'Nativity by Language Spoken at Home',
      )

      // But should have 2 relationships
      expect(result.relationships).toHaveLength(2)
    })

    it('preserves all relationships even when tables are deduplicated', () => {
      const result = transformDataTableData(multipleRawConcepts)

      // 2 unique tables
      expect(result.dataTables).toHaveLength(2)

      // But all 3 relationships preserved with title-cased labels
      expect(result.relationships).toHaveLength(3)
      expect(result.relationships).toEqual([
        {
          data_table_id: 'B16005D',
          dataset_id: 'ACSDT5Y2009',
          label: 'Nativity by Language Spoken at Home',
        },
        {
          data_table_id: 'B16005D',
          dataset_id: 'ACSDT5Y2017',
          label: 'Nativity by Language Spoken at Home',
        },
        {
          data_table_id: 'B19013',
          dataset_id: 'ACSDT5Y2009',
          label: 'Median Household Income',
        },
      ])
    })

    it('throws error for invalid data', () => {
      expect(() => transformDataTableData([invalidRawConceptData])).toThrow()
    })
  })
})
