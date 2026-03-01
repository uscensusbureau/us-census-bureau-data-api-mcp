import { describe, it, expect } from 'vitest'
import { DatabaseService } from '../../src/services/database.service.js'

// These tests use the bundled census.db — no Docker or Postgres required.

describe('DatabaseService', () => {
  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseService.getInstance()
      const instance2 = DatabaseService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('healthCheck method', () => {
    it('should return true with the bundled database', () => {
      const service = DatabaseService.getInstance()
      expect(service.healthCheck()).toBe(true)
    })
  })

  describe('getSummaryLevels method', () => {
    it('should return an array of summary levels', () => {
      const service = DatabaseService.getInstance()
      const levels = service.getSummaryLevels()

      expect(Array.isArray(levels)).toBe(true)
      expect(levels.length).toBeGreaterThan(0)
    })

    it('should return levels with required fields', () => {
      const service = DatabaseService.getInstance()
      const levels = service.getSummaryLevels()
      const first = levels[0]

      expect(first).toHaveProperty('id')
      expect(first).toHaveProperty('code')
      expect(first).toHaveProperty('name')
      expect(first).toHaveProperty('on_spine')
      expect(first).toHaveProperty('query_name')
    })

    it('should include well-known summary level codes', () => {
      const service = DatabaseService.getInstance()
      const levels = service.getSummaryLevels()
      const codes = levels.map((l) => l.code)

      expect(codes).toContain('040') // State
      expect(codes).toContain('050') // County
    })
  })

  describe('searchSummaryLevels method', () => {
    it('should find summary level by exact name', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchSummaryLevels('County')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].code).toBe('050')
    })

    it('should find summary level by numeric code', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchSummaryLevels('40')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].code).toBe('040')
    })

    it('should return empty array for unrecognised term', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchSummaryLevels('ZZZUnknownZZZ')

      expect(results).toHaveLength(0)
    })
  })

  describe('searchGeographies method', () => {
    it('should return matching geographies', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchGeographies('Pennsylvania')

      expect(results.length).toBeGreaterThan(0)
    })

    it('should return rows with required fields', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchGeographies('Pennsylvania')
      const first = results[0]

      expect(first).toHaveProperty('id')
      expect(first).toHaveProperty('name')
      expect(first).toHaveProperty('summary_level_name')
      expect(first).toHaveProperty('latitude')
      expect(first).toHaveProperty('longitude')
      expect(first).toHaveProperty('for_param')
      expect(first).toHaveProperty('in_param')
      expect(first).toHaveProperty('weighted_score')
    })

    it('should return empty array for an impossible search term', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchGeographies('ZZZNOTAPLACEZZZQQQQQQ')

      expect(results).toHaveLength(0)
    })
  })

  describe('searchGeographiesBySummaryLevel method', () => {
    it('should filter by summary level code', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchGeographiesBySummaryLevel(
        'Pennsylvania',
        '040',
      )

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].for_param).toContain('state:')
    })

    it('should return empty array when level code does not match', () => {
      const service = DatabaseService.getInstance()
      // Search for a state-level record under the county level
      const results = service.searchGeographiesBySummaryLevel(
        'Pennsylvania',
        '999',
      )

      expect(results).toHaveLength(0)
    })
  })

  describe('searchDataTables method', () => {
    it('should return tables matching a table ID prefix', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchDataTables({ data_table_id: 'B01001' })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].data_table_id).toMatch(/^B01001/)
    })

    it('should return tables matching a label query', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchDataTables({
        label_query: 'language spoken at home',
      })

      expect(results.length).toBeGreaterThan(0)
    })

    it('should return rows with required fields', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchDataTables({ data_table_id: 'B01001' })
      const first = results[0]

      expect(first).toHaveProperty('data_table_id')
      expect(first).toHaveProperty('label')
      expect(first).toHaveProperty('datasets')
      expect(Array.isArray(first.datasets)).toBe(true)
    })

    it('should return datasets with required fields', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchDataTables({ data_table_id: 'B01001' })
      const ds = results[0].datasets[0]

      expect(ds).toHaveProperty('dataset_id')
      expect(ds).toHaveProperty('dataset_param')
      expect(ds).toHaveProperty('year')
    })

    it('should return empty array for an unrecognised table ID', () => {
      const service = DatabaseService.getInstance()
      const results = service.searchDataTables({ data_table_id: 'ZZZNOTATABLE' })

      expect(results).toHaveLength(0)
    })
  })
})
