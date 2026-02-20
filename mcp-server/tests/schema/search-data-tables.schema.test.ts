import { describe, it, expect } from 'vitest'
import { SearchDataTablesInputSchema } from '../../src/schema/search-data-tables.schema'

describe('SearchDataTablesInputSchema', () => {
  describe('valid inputs', () => {
    it('accepts data_table_id alone', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: 'B16005',
      })
      expect(result.success).toBe(true)
    })

    it('accepts label_query alone', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        label_query: 'language spoken at home',
      })
      expect(result.success).toBe(true)
    })

    it('accepts api_endpoint alone', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        api_endpoint: 'acs/acs1',
      })
      expect(result.success).toBe(true)
    })

    it('accepts all parameters together', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: 'B16005',
        label_query: 'language spoken at home',
        api_endpoint: 'acs/acs1',
        limit: 10,
      })
      expect(result.success).toBe(true)
    })

    it('accepts limit up to 100', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: 'B16005',
        limit: 100,
      })
      expect(result.success).toBe(true)
    })

    it('trims whitespace from string fields', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: '  B16005  ',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data_table_id).toBe('B16005')
      }
    })
  })

  describe('invalid inputs', () => {
    it('rejects empty object', () => {
      const result = SearchDataTablesInputSchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'At least one search parameter must be provided: data_table_id, label_query, or api_endpoint.',
        )
      }
    })

    it('rejects empty string for data_table_id', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty string for label_query', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        label_query: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty string for api_endpoint', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        api_endpoint: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects whitespace-only strings', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: '   ',
      })
      expect(result.success).toBe(false)
    })

    it('rejects limit above 100', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: 'B16005',
        limit: 101,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-integer limit', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: 'B16005',
        limit: 10.5,
      })
      expect(result.success).toBe(false)
    })

    it('rejects zero limit', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: 'B16005',
        limit: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative limit', () => {
      const result = SearchDataTablesInputSchema.safeParse({
        data_table_id: 'B16005',
        limit: -1,
      })
      expect(result.success).toBe(false)
    })
  })
})