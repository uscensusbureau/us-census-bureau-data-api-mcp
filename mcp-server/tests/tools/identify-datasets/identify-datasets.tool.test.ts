// Mock node-fetch
const mockFetch = vi.fn()

vi.mock('node-fetch', () => ({
  default: mockFetch,
}))

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdentifyDatasetsTool } from '../../../src/tools/identify-datasets.tool'
import { sampleDatasetMetadata } from '../../../tests/helpers/test-data' 


describe('IdentifyDatasetsTool', () => {
  let tool: IdentifyDatasetsTool

  beforeEach(async () => {
    tool = new IdentifyDatasetsTool()

    mockFetch.mockClear()
    
    delete process.env.CENSUS_API_KEY
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Tool Configuration', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('identify-datasets')
      expect(tool.description).toContain('returns a data catalog of available Census datasets')
    })

    it('should have empty input schema', () => {
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {},
        required: []
      })
    })

    it('should have empty args schema', () => {
      const schema = tool.argsSchema
      expect(schema.safeParse({})).toEqual({ success: true, data: {} })
    })
  })

  describe('Environment Variable Validation', () => {
    it('should return error when CENSUS_API_KEY is not set', async () => {
      const result = await tool.handler()
      
      expect(result.content).toHaveLength(1)
      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('CENSUS_API_KEY is not set')
      })
    })

    it('should return error when CENSUS_API_KEY is empty string', async () => {
      process.env.CENSUS_API_KEY = ''
      
      const result = await tool.handler()
      
      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('CENSUS_API_KEY is not set')
      })
    })
  })


  describe('API Response Handling', () => {
    beforeEach(() => {
      process.env.CENSUS_API_KEY = 'test-api-key'
    })

    it('should handle successful API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleDatasetMetadata)
      })

      const result = await tool.handler()

      expect(mockFetch).toHaveBeenCalledWith('https://api.census.gov/data.json?key=test-api-key')
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      
      const parsedContent = JSON.parse(result.content[0].text)
      expect(parsedContent).toHaveLength(1)
      
      expect(parsedContent[0]).toEqual({
        c_dataset: 'acs/acs1',
        title: 'American Community Survey: 1-Year Estimates: Detailed Tables',
        description: 'The American Community Survey (ACS) is an ongoing survey that provides vital information on a yearly basis about our nation and its people.',
        c_vintage: 2022
      })
    })

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })

      const result = await tool.handler()

      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('Failed to fetch catalog: 403 Forbidden')
      })
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await tool.handler()

      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('Failed to fetch datasets: Network error')
      })
    })

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValue('String error')

      const result = await tool.handler()

      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('Failed to fetch datasets: Unknown error occurred')
      })
    })
  })

  describe('Data Validation and Transformation', () => {
    beforeEach(() => {
      process.env.CENSUS_API_KEY = 'test-api-key'
    })
    
    it('should handle invalid schema response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalidStructure: true })
      })

      const result = await tool.handler()

      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('Catalog response did not match expected metadata schema')
      })

      mockFetch.mockClear()
    })
    
    it('should simplify dataset with array c_dataset', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleDatasetMetadata)
      })
      
      const result = await tool.handler()
      
      const parsedContent = JSON.parse(result.content[0].text)
      
      expect(parsedContent[0].c_dataset).toBe('acs/acs1')
    })

    it('should simplify dataset with string c_dataset', async () => {
      const mockApiResponse = {
        ...sampleDatasetMetadata,
        dataset: [{
          c_vintage: 2010,
          c_dataset: ["dec", "sf1"],
          c_geographyLink: "http://api.census.gov/data/2010/dec/sf1/geography.json",
          c_variablesLink: "http://api.census.gov/data/2010/dec/sf1/variables.json",
          c_tagsLink: "http://api.census.gov/data/2010/dec/sf1/tags.json",
          c_examplesLink: "http://api.census.gov/data/2010/dec/sf1/examples.json",
          c_groupsLink: "http://api.census.gov/data/2010/dec/sf1/groups.json",
          c_sorts_url: "http://api.census.gov/data/2010/dec/sf1/sorts.json",
          c_documentationLink: "https://www.census.gov/developer/",
          c_isAggregate: true,
          c_isCube: true,
          c_isAvailable: true,
          "@type": "dcat:Dataset",
          title: "Decennial SF1",
          accessLevel: "public",
          bureauCode: ["006:07"],
          description: "Summary File 1 (SF 1) contains detailed tables...",
          distribution: [
            {
              "@type": "dcat:Distribution",
              accessURL: "http://api.census.gov/data/2010/dec/sf1",
              description: "API endpoint",
              format: "API",
              mediaType: "application/json",
              title: "API endpoint"
            }
          ],
          contactPoint: {
            fn: "Census Bureau Call Center",
            hasEmail: "mailto:pio@census.gov"
          },
          identifier: "https://api.census.gov/data/id/DECENNIALSF12010",
          keyword: ["census"],
          license: "https://creativecommons.org/publicdomain/zero/1.0/",
          modified: "2018-08-28 12:52:11.0",
          programCode: ["006:004"],
          references: ["https://www.census.gov/developers/"],
          publisher: {
            "@type": "org:Organization",
            name: "U.S. Census Bureau",
            subOrganizationOf: {
              "@type": "org:Organization",
              name: "U.S. Department Of Commerce",
              subOrganizationOf: {
                "@type": "org:Organization",
                name: "U.S. Government"
              }
            }
          }
        }]
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await tool.handler()
      const parsedContent = JSON.parse(result.content[0].text)
      
      expect(parsedContent[0].c_dataset).toBe('dec/sf1')
    })

    it('should include optional fields when present', async () => {
      const mockApiResponse = {
        ...sampleDatasetMetadata,
        dataset: [
          {
            ...sampleDatasetMetadata.dataset[0],
            c_isAggregate: true
          }
        ]
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await tool.handler()
      const parsedContent = JSON.parse(result.content[0].text)

      expect(parsedContent[0]).toHaveProperty('c_isAggregate')
    })

    it('should omit optional fields when not present', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleDatasetMetadata)
      })

      const result = await tool.handler()
      const parsedContent = JSON.parse(result.content[0].text)
      
      expect(parsedContent[0]).not.toHaveProperty('c_isAggregate')
      expect(parsedContent[0]).not.toHaveProperty('c_isTimeseries')
      expect(parsedContent[0]).not.toHaveProperty('c_isMicrodata')
    })

    it('should return empty array when API returns no datasets', async () => {
      const mockApiResponse = { ...sampleDatasetMetadata, dataset: [] };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      } as Response);

      const result = await tool.handler()

      const parsedContent = JSON.parse(result.content[0].text)

      expect(parsedContent).toEqual([])
    })
  })

  describe('JSON Parsing Errors', () => {
    beforeEach(() => {
      process.env.CENSUS_API_KEY = 'test-api-key'
    })

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      const result = await tool.handler()

      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('Failed to fetch datasets: Invalid JSON')
      })
    })
  })

  describe('Constructor Binding', () => {
    it('should properly bind handler method', () => {
      // ts-ignore to spy on bind
      // @ts-ignore
      const handlerBindSpy = vi.spyOn(IdentifyDatasetsTool.prototype.handler, 'bind')
      new IdentifyDatasetsTool()
      // This test ensures the handler is properly bound and won't lose context
      expect(handlerBindSpy).toHaveBeenCalled()
      handlerBindSpy.mockRestore()
    })
  })
})