const mockFetch = vi.fn()

vi.mock('node-fetch', () => ({
  default: mockFetch,
}))

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  FetchAggregateDataTool,
  toolDescription,
} from '../../../src/tools/fetch-aggregate-data.tool'
import {
  validateToolStructure,
  validateResponseStructure,
  createMockResponse,
  createMockFetchError,
  sampleCensusError,
} from '../../helpers/test-utils'

import { sampleTableByGroupData } from '../../helpers/test-data'

describe('FetchAggregateDataTool', () => {
  let tool: FetchAggregateDataTool

  beforeEach(() => {
    tool = new FetchAggregateDataTool()
    mockFetch.mockClear()

    process.env.CENSUS_API_KEY = 'test-api-key-12345'
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('Tool Configuration', () => {
    it('should have correct tool metadata', () => {
      validateToolStructure(tool)
      expect(tool.name).toBe('fetch-aggregate-data')
      expect(tool.description).toBe(toolDescription)
    })

    it('should have valid input schema', () => {
      const schema = tool.inputSchema
      expect(schema.type).toBe('object')
      expect(schema.properties).toHaveProperty('dataset')
      expect(schema.properties).toHaveProperty('year')
      expect(schema.properties).toHaveProperty('get')
      expect(schema.required).toEqual(['dataset', 'year', 'get'])
    })

    it('should validate presence of for or ucgid', () => {
      const missingGeoArg = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
      }

      const result = tool.argsSchema.safeParse(missingGeoArg)

      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'custom', // Check the error code
            message:
              'No geography specified error - define for or ucgid arguments.',
          }),
        ]),
      )
    })

    it('should validate complex geography level definitions', () => {
      const complexArgs = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'tract:*',
        in: 'state:01 county:001',
      }

      expect(() => tool.argsSchema.parse(complexArgs)).not.toThrow()
    })

    it('should catch invalid geography level definitions', () => {
      const invalidArgs = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: ['state:*'],
        in: ['county:01'],
      }

      expect(() => tool.argsSchema.parse(invalidArgs)).toThrow()
    })

    it('should have matching args schema', () => {
      // Test required fields
      const validArgs = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          variables: ['STC_TTL'],
        },
        for: 'state:05',
      }
      expect(() => tool.argsSchema.parse(validArgs)).not.toThrow()

      // Test optional fields
      const argsWithOptionals = {
        ...validArgs,
        for: 'state:*',
        in: 'us:1',
        predicates: { AGEGROUP: '29' },
      }
      expect(() => tool.argsSchema.parse(argsWithOptionals)).not.toThrow()
    })
  })

  describe('Schema Validation', () => {
    it('should validate required parameters', () => {
      const incompleteArgs = { dataset: 'acs/acs1', year: 2022 } // missing variables
      expect(() => tool.argsSchema.parse(incompleteArgs)).toThrow()
    })

    it('should fail without get defined', () => {
      const invalidArgs = {
        dataset: 'acs/acs1', // should be string
        year: 2022, // should be number
      }
      expect(() => tool.argsSchema.parse(invalidArgs)).toThrow()
    })

    it('should fail with empty get object', () => {
      const invalidArgs = {
        dataset: 'acs/acs1', // should be string
        year: 2022, // should be number
        get: {},
      }
      expect(() => tool.argsSchema.parse(invalidArgs)).toThrow()
    })

    it('should validate parameter types', () => {
      const invalidArgs = {
        dataset: 123, // should be string
        year: '2022', // should be number
        get: {
          group: [123456],
          variables: 'not-array',
        }, // should be array
      }
      expect(() => tool.argsSchema.parse(invalidArgs)).toThrow()
    })

    it('should accept valid optional parameters', () => {
      const validArgs = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
          variables: ['PAYQTR1'],
        },
        for: 'state:01',
        in: 'us:1',
        predicates: { AGEGROUP: '29', PAYANN: '100000' },
        descriptive: true,
      }
      expect(() => tool.argsSchema.parse(validArgs)).not.toThrow()
    })

    it('should accept dataset if tool match', () => {
      const validArgs = {
        dataset: 'acs/acs1', // should be string
        year: 2022, // should be number
        get: {
          group: 'B01001',
        },
        for: 'state:01',
      }

      expect(() => tool.argsSchema.parse(validArgs)).not.toThrow()
    })

    it('should reject dataset if tool mismatch', () => {
      const invalidArgs = {
        dataset: 'timeseries/data/set', // should be string
        year: 2022, // should be number
        get: {
          group: 'B01001',
        },
        for: 'state:*',
      }

      const result = tool.validateArgs(invalidArgs)

      expect(() => tool.argsSchema.parse(invalidArgs)).toThrow()
      expect(result.error.issues[0].message).toContain(
        'This data is currently not supported by the U.S. Census Bureau Data API MCP Server.',
      )
    })
  })

  describe('API Key Handling', () => {
    it('should return error when API key is missing', async () => {
      const originalApiKey = process.env.CENSUS_API_KEY
      delete process.env.CENSUS_API_KEY

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain('CENSUS_API_KEY is not set')

      // Restore API key
      process.env.CENSUS_API_KEY = originalApiKey
    })

    it('should use API key when available', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleTableByGroupData))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:03',
      }

      await tool.handler(args)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=test-api-key-12345'),
      )
    })
  })

  describe('URL Construction', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(createMockResponse(sampleTableByGroupData))
    })

    it('should construct basic URL correctly', async () => {
      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:*',
      }

      await tool.handler(args)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.census.gov/data/2022/acs/acs1'),
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('get=group%28B01001%29'),
      )
    })

    it('should handle group variable', async () => {
      const args = {
        dataset: 'acs/acs1',
        year: 2019,
        get: {
          group: 'B02015',
        },
        for: 'state:*',
      }

      await tool.handler(args)

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('get=group%28B02015%29')
    })

    it('should include optional parameters in URL', async () => {
      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:01',
        in: 'us:1',
        predicates: { AGEGROUP: '29' },
        descriptive: true,
      }

      await tool.handler(args)

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('for=state%3A01')
      expect(calledUrl).toContain('in=us%3A1')
      expect(calledUrl).toContain('AGEGROUP=29')
      expect(calledUrl).toContain('descriptive=true')
    })

    it('should handle multiple predicates', async () => {
      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:*',
        predicates: { AGEGROUP: '29', PAYANN: '100000' },
      }

      await tool.handler(args)

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('AGEGROUP=29')
      expect(calledUrl).toContain('PAYANN=100000')
    })
  })

  describe('API Response Handling', () => {
    it('should handle successful API response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleTableByGroupData))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:*',
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)

      const responseText = response.content[0].text
      expect(responseText).toContain('Response from acs/acs1:')
      expect(responseText).toContain('Alabama')
      expect(responseText).toContain('Alaska')
      expect(responseText).toContain('Arizona')
    })

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(sampleCensusError, 400, 'Bad Request'),
      )

      const args = {
        dataset: 'invalid/dataset',
        year: 2022,
        get: {
          group: '123456',
        },
        for: 'state:*',
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Census API error: 400 Bad Request',
      )
    })

    it('should handle network errors', async () => {
      mockFetch.mockImplementation(() => createMockFetchError('Network error'))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:*',
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Fetch failed: Network error')
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:02',
      }

      const response = await tool.handler(args)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Fetch failed: Invalid JSON')
    })
  })

  describe('Data Formatting', () => {
    it('should format data correctly with headers', async () => {
      const testData = [
        ['NAME', 'B01001_001E', 'state'],
        ['Test State', '1000000', '01'],
      ]
      mockFetch.mockResolvedValue(createMockResponse(testData))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:01',
      }

      const response = await tool.handler(args)
      const responseText = response.content[0].text

      expect(responseText).toContain(
        'NAME: Test State, B01001_001E: 1000000, state: 01',
      )
    })

    it('should handle empty data arrays', async () => {
      const emptyData = [['NAME', 'B01001_001E', 'state']] // Headers only
      mockFetch.mockResolvedValue(createMockResponse(emptyData))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:*',
      }

      const response = await tool.handler(args)
      const responseText = response.content[0].text

      expect(responseText).toContain('Response from acs/acs1:')
      // Should not contain any data rows
      expect(responseText.split('\n')).toHaveLength(2)
    })
  })

  describe('Integration Tests', () => {
    it('should perform complete successful request flow', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleTableByGroupData))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
        get: {
          group: 'B01001',
        },
        for: 'state:*',
      }

      const response = await tool.handler(args)

      // Verify fetch was called with correct URL
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('https://api.census.gov/data/2022/acs/acs1')
      expect(calledUrl).toContain('get=group%28B01001%29')
      expect(calledUrl).toContain('for=state%3A*')
      expect(calledUrl).toContain('key=test-api-key-12345')

      // Verify response format
      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Response from acs/acs1:')
    })

    it('should handle complex query with all parameters', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleTableByGroupData))

      const args = {
        dataset: 'acs/acs5',
        year: 2021,
        get: {
          group: 'B01001',
        },
        for: 'county:*',
        in: 'state:01',
        predicates: { AGEGROUP: '29', PAYANN: '100000' },
      }

      const response = await tool.handler(args)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0][0]

      // Verify all parameters are included
      expect(calledUrl).toContain('2021/acs/acs5')
      expect(calledUrl).toContain('B01001')
      expect(calledUrl).toContain('for=county%3A*')
      expect(calledUrl).toContain('in=state%3A01')
      expect(calledUrl).toContain('AGEGROUP=29')
      expect(calledUrl).toContain('PAYANN=100000')

      validateResponseStructure(response)
    })
  })
})
