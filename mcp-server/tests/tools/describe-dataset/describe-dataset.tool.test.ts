const mockFetch = vi.fn()

vi.mock('node-fetch', () => ({
  default: mockFetch,
}))

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DescribeDatasetTool } from '../../../src/tools/describe-dataset.tool'
import {
  validateResponseStructure,
  validateToolStructure,
  validateResponseStructure,
  createMockResponse,
  createMockFetchError,
  sampleCensusError,
} from '../../helpers/test-utils.js'

import { sampleDatasetMetadata } from '../../helpers/test-data.js'

describe('DescribeDatasetTool', () => {
  let tool: DescribeDatasetTool

  beforeEach(() => {
    tool = new DescribeDatasetTool()
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('Tool Configuration', () => {
    it('should have correct tool metadata', () => {
      validateToolStructure(tool)
      expect(tool.name).toBe('describe-dataset')
      expect(tool.description).toBe(
        'Fetch metadata for a Census Bureau dataset.',
      )
    })

    it('should have valid input schema', () => {
      const schema = tool.inputSchema
      expect(schema.type).toBe('object')
      expect(schema.properties).toHaveProperty('dataset')
      expect(schema.properties).toHaveProperty('year')
      expect(schema.required).toEqual(['dataset'])
    })

    it('should have matching args schema', () => {
      // Test required fields
      const validArgs = {
        dataset: 'acs/acs1',
        year: 2022,
      }
      expect(() => tool.argsSchema.parse(validArgs)).not.toThrow()
    })
  })

  describe('Schema Validation', () => {
    it('should validate required parameters', () => {
      const incompleteArgs = { year: 2024 } // missing dataset
      expect(() => tool.argsSchema.parse(incompleteArgs)).toThrow()
    })

    it('should validate parameter types', () => {
      const invalidArgs = {
        dataset: 123, // should be string
        year: '2022', // should be number
      }
      expect(() => tool.argsSchema.parse(invalidArgs)).toThrow()
    })

    it('should accept valid optional parameters', () => {
      const validArgs = {
        dataset: 'acs/acs1',
        year: 2022,
      }
      expect(() => tool.argsSchema.parse(validArgs)).not.toThrow()
    })
  })

  describe('API Key Handling', () => {
    it('should return error when API key is missing', async () => {
      const originalApiKey = process.env.CENSUS_API_KEY
      delete process.env.CENSUS_API_KEY

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain('CENSUS_API_KEY is not set')

      // Restore API key
      process.env.CENSUS_API_KEY = originalApiKey
    })

    it('should use API key when available', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleDatasetMetadata))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      await tool.handler(args)

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('key='))
    })
  })

  describe('URL Construction', () => {
    it('should construct basic URL correctly', async () => {
      // Mock to fail on first call, succeed on profile.json
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
        .mockResolvedValueOnce(createMockResponse(sampleDatasetMetadata))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      await tool.handler(args)
      const calls = mockFetch.mock.calls
      expect(calls[0][0]).toContain(
        'https://api.census.gov/data/2022/acs/acs1?key=',
      )
    })

    it('should construct URL without year for timeseries', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleDatasetMetadata))

      const args = {
        dataset: 'timeseries/asm/area2012',
      }

      await tool.handler(args)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://api.census.gov/data/timeseries/asm/area2012?key=',
        ),
      )
    })
  })

  describe('API Response Handling', () => {
    it('should handle successful API response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleDatasetMetadata))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)

      // Since you changed to JSON response, check for JSON content
      expect(response.content[0].type).toBe('text')
      const responseText = response.content[0].text
      expect(responseText).toContain('"@type": "DatasetMetadata"')
      expect(responseText).toContain(
        '"title": "American Community Survey: 1-Year Estimates: Detailed Tables"',
      )
    })

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(sampleCensusError, 400, 'Bad Request'),
      )

      const args = {
        dataset: 'invalid/dataset',
        year: 2022,
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Failed to fetch dataset metadata: Unable to retrieve metadata from any available endpoint for invalid/dataset (2022). This dataset may not have metadata available, or may be a data-only endpoint.',
      )
    })

    it('should handle network errors', async () => {
      mockFetch.mockImplementation(() => createMockFetchError('Network error'))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Failed to fetch dataset metadata: Network error',
      )
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Failed to fetch dataset metadata: Invalid JSON',
      )
    })
  })
})
