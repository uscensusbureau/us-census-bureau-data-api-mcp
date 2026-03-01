/**
 * Integration tests for FetchDatasetGeographyTool using the bundled SQLite database.
 * No Docker or Postgres required.
 * External Census API calls are mocked; database integration uses real bundled data.
 */
const mockFetch = vi.fn()

vi.mock('node-fetch', () => ({
  default: mockFetch,
}))

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { DatabaseService } from '../../../src/services/database.service.js'
import { FetchDatasetGeographyTool } from '../../../src/tools/fetch-dataset-geography.tool.js'
import { TextContent } from '@modelcontextprotocol/sdk/types.js'

// Minimal FIPS response using codes present in the bundled DB (010, 040, 050)
const sampleFipsResponse = {
  fips: [
    {
      name: 'us',
      geoLevelDisplay: '010',
      referenceDate: '2022-01-01',
    },
    {
      name: 'state',
      geoLevelDisplay: '040',
      referenceDate: '2022-01-01',
    },
    {
      name: 'county',
      geoLevelDisplay: '050',
      referenceDate: '2022-01-01',
      requires: ['state'],
      wildcard: ['state'],
      optionalWithWCFor: 'state',
    },
  ],
}

function createMockResponse(data: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
  }
}

describe('FetchDatasetGeographyTool - Integration Tests', () => {
  let tool: FetchDatasetGeographyTool

  beforeAll(() => {
    ;(DatabaseService as unknown as { instance: unknown }).instance = undefined
    tool = new FetchDatasetGeographyTool()
  })

  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Real Database Integration', () => {
    it('should report healthy with the bundled SQLite database', () => {
      const service = DatabaseService.getInstance()
      expect(service.healthCheck()).toBe(true)
    })

    it('should return summary levels from the bundled SQLite database', () => {
      const service = DatabaseService.getInstance()
      const levels = service.getSummaryLevels()

      expect(Array.isArray(levels)).toBe(true)
      expect(levels.length).toBeGreaterThan(0)

      const us = levels.find((l) => l.code === '010')
      expect(us).toBeDefined()
      expect(us?.name).toBe('United States')
      expect(us?.on_spine).toBe(true)

      const state = levels.find((l) => l.code === '040')
      expect(state).toBeDefined()
      expect(state?.name).toBe('State')
      expect(state?.on_spine).toBe(true)

      const county = levels.find((l) => l.code === '050')
      expect(county).toBeDefined()
      expect(county?.name).toBe('County')
    })

    it('should return summary level rows with all required fields', () => {
      const service = DatabaseService.getInstance()
      const levels = service.getSummaryLevels()
      const first = levels[0]

      expect(first).toHaveProperty('id')
      expect(first).toHaveProperty('code')
      expect(first).toHaveProperty('name')
      expect(first).toHaveProperty('description')
      expect(first).toHaveProperty('get_variable')
      expect(first).toHaveProperty('query_name')
      expect(first).toHaveProperty('on_spine')
    })

    it('should expose parent_summary_level for hierarchy building', () => {
      const service = DatabaseService.getInstance()
      const levels = service.getSummaryLevels()

      // County (050) should reference State (040) as its parent
      const county = levels.find((l) => l.code === '050')
      expect(county).toBeDefined()
      expect(county?.parent_summary_level).toBe('040')

      // US (010) has no parent
      const us = levels.find((l) => l.code === '010')
      expect(us?.parent_summary_level).toBeNull()
    })
  })

  describe('Database-Driven Metadata Enhancement', () => {
    it('should use database display names and on_spine over API values', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleFipsResponse))

      const response = await tool.toolHandler(
        { dataset: 'acs/acs1', year: 2022 },
        'test-api-key',
      )

      expect(response.content[0].type).toBe('text')
      const responseText = (response.content[0] as TextContent).text

      expect(responseText).toContain('Available geographies for acs/acs1 (2022)')

      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))
      expect(Array.isArray(parsedData)).toBe(true)

      // US should use database displayName (not the API raw name 'us')
      const usRecord = parsedData.find((geo: { code: string }) => geo.code === '010')
      expect(usRecord).toBeDefined()
      expect(usRecord.displayName).toBe('United States') // From database
      expect(usRecord.onSpine).toBe(true)                // From database
      expect(usRecord.description).toContain('United States') // From database

      // State should use database displayName (not 'state')
      const stateRecord = parsedData.find((geo: { code: string }) => geo.code === '040')
      expect(stateRecord).toBeDefined()
      expect(stateRecord.displayName).toBe('State') // From database
      expect(stateRecord.onSpine).toBe(true)        // From database

      // County should use database displayName
      const countyRecord = parsedData.find((geo: { code: string }) => geo.code === '050')
      expect(countyRecord).toBeDefined()
      expect(countyRecord.displayName).toBe('County') // From database
    })

    it('should build hierarchical query examples from database parent relationships', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleFipsResponse))

      const response = await tool.toolHandler(
        { dataset: 'acs/acs1', year: 2022 },
        'test-api-key',
      )

      const responseText = (response.content[0] as TextContent).text
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      // US has no parent → standalone query
      const usRecord = parsedData.find((geo: { code: string }) => geo.code === '010')
      expect(usRecord?.queryExample).toContain('for=')
      expect(usRecord?.queryExample).not.toContain('&in=')

      // County's parent is State → hierarchical query
      const countyRecord = parsedData.find((geo: { code: string }) => geo.code === '050')
      expect(countyRecord?.queryExample).toContain('for=county')
      expect(countyRecord?.queryExample).toContain('in=state')
    })

    it('should handle fallback for geography codes not in database', async () => {
      const unknownCodeResponse = {
        fips: [
          {
            name: 'unknown geography',
            geoLevelDisplay: '999',
            referenceDate: '2022-01-01',
          },
        ],
      }

      mockFetch.mockResolvedValue(createMockResponse(unknownCodeResponse))

      const response = await tool.toolHandler(
        { dataset: 'acs/acs1', year: 2022 },
        'test-api-key',
      )

      const responseText = (response.content[0] as TextContent).text
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      // Should use fallback values since no database record found for code 999
      expect(parsedData[0]).toMatchObject({
        displayName: 'Unknown Geography', // Fallback display name
        querySyntax: 'unknown+geography', // Fallback query syntax
        code: '999',
        onSpine: false,                   // Default fallback value
      })
    })

    it('should return error when API call fails', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}, 400, 'Bad Request'))

      const response = await tool.toolHandler(
        { dataset: 'invalid/dataset', year: 2022 },
        'test-api-key',
      )

      expect((response.content[0] as TextContent).text).toContain(
        'Geography endpoint returned: 400 Bad Request',
      )
    })

    it('should return error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const response = await tool.toolHandler(
        { dataset: 'acs/acs1', year: 2022 },
        'test-api-key',
      )

      expect((response.content[0] as TextContent).text).toContain(
        'Failed to fetch dataset geography levels: Network error',
      )
    })

    it('should construct correct URL with year', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleFipsResponse))

      await tool.toolHandler({ dataset: 'acs/acs1', year: 2022 }, 'test-key')

      expect(mockFetch.mock.calls[0][0]).toContain(
        'https://api.census.gov/data/2022/acs/acs1/geography.json?key=test-key',
      )
    })

    it('should construct correct URL without year for timeseries', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleFipsResponse))

      await tool.toolHandler({ dataset: 'timeseries/asm/area2012' }, 'test-key')

      expect(mockFetch.mock.calls[0][0]).toContain(
        'https://api.census.gov/data/timeseries/asm/area2012/geography.json?key=test-key',
      )
    })
  })
})
