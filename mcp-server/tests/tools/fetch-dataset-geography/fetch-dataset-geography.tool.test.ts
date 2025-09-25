const mockFetch = vi.fn()

vi.mock('node-fetch', () => ({
  default: mockFetch,
}))

// Mock DatabaseService
vi.mock('../../../src/services/database.service.js', () => ({
  DatabaseService: {
    getInstance: vi.fn(),
  },
}))

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
  Mock,
} from 'vitest'
import { FetchDatasetGeographyTool } from '../../../src/tools/fetch-dataset-geography.tool.js'
import { DatabaseService } from '../../../src/services/database.service.js'
import {
  SummaryLevelRow,
  GeographyMetadata,
} from '../types/summary-level.types.js'
import {
  validateResponseStructure,
  validateToolStructure,
  createMockResponse,
  createMockFetchError,
  sampleCensusError,
} from '../../helpers/test-utils.js'

describe('FetchDatasetGeographyTool', () => {
  let tool: FetchDatasetGeographyTool
  let mockDbService: {
    healthCheck: Mock
    query: Mock
  }

  // Static mock data - created once and reused
  let mockSummaryLevels: GeographyMetadata<SummaryLevelRow[]>
  let mockCensusApiResponse: GeographyJson

  beforeAll(() => {
    // Create mock data once for all tests
    mockSummaryLevels = [
      {
        id: 1,
        name: 'United States',
        description: 'United States total',
        get_variable: 'NATION',
        query_name: 'us',
        on_spine: true,
        code: '010',
        parent_summary_level: null,
        parent_geography_level_id: null,
      },
      {
        id: 2,
        name: 'State',
        description: 'States and State equivalents',
        get_variable: 'STATE',
        query_name: 'state',
        on_spine: true,
        code: '040',
        parent_summary_level: '010',
        parent_geography_level_id: 1,
      },
      {
        id: 3,
        name: 'County',
        description: 'Counties and county equivalents',
        get_variable: 'COUNTY',
        query_name: 'county',
        on_spine: true,
        code: '050',
        parent_summary_level: '040',
        parent_geography_level_id: 2,
      },
    ]

    // Mock Census API response that matches our database data
    mockCensusApiResponse = {
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

    // Setup database service mock once
    mockDbService = {
      healthCheck: vi.fn(),
      query: vi.fn(),
    }
    ;(DatabaseService.getInstance as Mock).mockReturnValue(mockDbService)
  })

  beforeEach(() => {
    // Reset mock implementations and call history, but reuse the mock objects
    mockDbService.healthCheck.mockReset().mockResolvedValue(true)
    mockDbService.query
      .mockReset()
      .mockResolvedValue({ rows: mockSummaryLevels })
    mockFetch.mockReset()

    // Create fresh tool instance for each test
    tool = new FetchDatasetGeographyTool()
  })

  afterEach(() => {
    // Only clear call history, keep mock implementations
    vi.clearAllMocks()
  })

  describe('Tool Configuration', () => {
    it('should have correct tool metadata', () => {
      validateToolStructure(tool)
      expect(tool.name).toBe('fetch-dataset-geography')
      expect(tool.description).toBe(
        'Fetch available geographies for filtering a dataset.',
      )
      expect(tool.requiresApiKey).toBe(true)
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

  describe('Database Integration', () => {
    it('should return error when database is unhealthy', async () => {
      mockDbService.healthCheck.mockResolvedValue(false)

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Database connection failed - cannot retrieve geography metadata',
      )
    })

    it('should query geography levels from database', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCensusApiResponse))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      await tool.toolHandler(args, process.env.CENSUS_API_KEY)

      expect(mockDbService.healthCheck).toHaveBeenCalled()

      // Verify the SQL query structure
      const queryCall = mockDbService.query.mock.calls[0][0]
      expect(queryCall).toContain('FROM summary_levels')
      expect(queryCall).toContain('ORDER BY code')
    })

    it('should handle database query errors', async () => {
      mockDbService.query.mockRejectedValue(
        new Error('Database connection failed'),
      )

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Database connection failed')
    })
  })

  describe('URL Construction', () => {
    it('should construct basic URL correctly', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCensusApiResponse))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      const calls = mockFetch.mock.calls
      expect(calls[0][0]).toContain(
        'https://api.census.gov/data/2022/acs/acs1/geography.json?key=',
      )
    })

    it('should construct URL without year for timeseries', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCensusApiResponse))

      const args = {
        dataset: 'timeseries/asm/area2012',
      }

      await tool.toolHandler(args, process.env.CENSUS_API_KEY)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://api.census.gov/data/timeseries/asm/area2012/geography.json?key=',
        ),
      )
    })
  })

  describe('API Response Handling', () => {
    it('should handle successful API response with database enhancement', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCensusApiResponse))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      validateResponseStructure(response)

      expect(response.content[0].type).toBe('text')
      const responseText = response.content[0].text

      // Parse the JSON response to verify database integration
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      expect(parsedData).toHaveLength(3)

      // Verify database values are used instead of API values
      expect(parsedData[0]).toMatchObject({
        displayName: 'United States', // From database, not API
        querySyntax: 'us', // From database query_name
        code: '010',
        onSpine: true, // From database on_spine
        description: 'United States total', // From database description
      })

      expect(parsedData[1]).toMatchObject({
        displayName: 'State',
        querySyntax: 'state',
        code: '040',
        onSpine: true,
        queryExample: 'for=state:*',
      })

      expect(parsedData[2]).toMatchObject({
        displayName: 'County',
        querySyntax: 'county',
        code: '050',
        onSpine: true,
        queryExample: 'for=county:*&in=state:*',
      })
    })

    it('should handle fallback for unknown geography codes', async () => {
      // Mock API response with unknown geography code
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

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      validateResponseStructure(response)

      const responseText = response.content[0].text
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      // Should use fallback values since no database record found
      expect(parsedData[0]).toMatchObject({
        displayName: 'Unknown Geography', // Fallback display name
        querySyntax: 'unknown+geography', // Fallback query syntax
        code: '999',
        onSpine: false, // Default fallback value
      })
    })

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(sampleCensusError, 400, 'Bad Request'),
      )

      const args = {
        dataset: 'invalid/dataset',
        year: 2022,
      }

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Geography endpoint returned: 400 Bad Request',
      )
    })

    it('should handle network errors', async () => {
      mockFetch.mockImplementation(() => createMockFetchError('Network error'))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Failed to fetch dataset geography levels: Network error',
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

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Failed to fetch dataset geography levels: Invalid JSON',
      )
    })

    it('should handle invalid API response format', async () => {
      const invalidResponse = { invalid: 'data' }
      mockFetch.mockResolvedValue(createMockResponse(invalidResponse))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Response validation failed')
    })
  })

  describe('Metadata Building from Database', () => {
    it('should build correct query examples for hierarchical geographies', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCensusApiResponse))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      const responseText = response.content[0].text
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      // US should have simple query (no parent)
      expect(parsedData[0].queryExample).toBe('for=us:*')

      // State should reference US parent
      expect(parsedData[1].queryExample).toBe('for=state:*')

      // County should reference State parent
      expect(parsedData[2].queryExample).toBe('for=county:*&in=state:*')
    })

    it('should use onSpine from database', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCensusApiResponse))

      const args = {
        dataset: 'acs/acs1',
        year: 2022,
      }

      const response = await tool.toolHandler(args, process.env.CENSUS_API_KEY)
      const responseText = response.content[0].text
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      // All our mock geography levels have on_spine: true
      parsedData.forEach((geography) => {
        expect(geography.onSpine).toBe(true)
      })
    })
  })
})
