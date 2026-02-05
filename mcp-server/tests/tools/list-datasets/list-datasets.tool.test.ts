// Mock node-fetch
const mockFetch = vi.fn()

vi.mock('node-fetch', () => ({
  default: mockFetch,
}))

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ListDatasetsTool,
  toolDescription,
} from '../../../src/tools/list-datasets.tool'
import { sampleDatasetMetadata } from '../../helpers/test-data.js'
import {
  SimplifiedAPIDatasetType,
  AggregatedResultType,
} from '../../../src/schema/list-datasets.schema.js'

describe('ListDatasetsTool', () => {
  let tool: ListDatasetsTool

  beforeEach(async () => {
    tool = new ListDatasetsTool()

    mockFetch.mockClear()

    delete process.env.CENSUS_API_KEY
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Extend the class to expose private methods for testing
  class TestableListDatasetsTool extends ListDatasetsTool {
    public testCleanTitle(title: string, vintage?: number): string {
      return (this as ListDatasetsTool).cleanTitle(title, vintage)
    }

    public testAggregateDatasets(
      data: SimplifiedAPIDatasetType[],
    ): AggregatedResultType[] {
      return (this as ListDatasetsTool).aggregateDatasets(data)
    }
  }

  describe('Tool Configuration', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('list-datasets')
      expect(tool.description).toBe(toolDescription)
      expect(tool.requiresApiKey).toBe(true)
    })

    it('should have empty input schema', () => {
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {},
        required: [],
      })
    })

    it('should have empty args schema', () => {
      const schema = tool.argsSchema
      expect(schema.safeParse({})).toEqual({ success: true, data: {} })
    })
  })

  describe('Data Validation and Transformation', () => {
    beforeEach(() => {
      process.env.CENSUS_API_KEY = 'test-api-key'
    })

    it('should handle invalid schema response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalidStructure: true }),
      })

      const result = await tool.toolHandler(process.env.CENSUS_API_KEY)

      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining(
          'Catalog response did not match expected metadata schema',
        ),
      })

      mockFetch.mockClear()
    })

    it('should simplify dataset with array c_dataset', async () => {
      const mockApiResponse = {
        ...sampleDatasetMetadata,
        dataset: [
          {
            ...sampleDatasetMetadata.dataset[0],
            c_isAggregate: true,
          },
        ],
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const result = await tool.toolHandler({}, 'test-api-key')
      const parsedContent = JSON.parse(result.content[0].text)

      expect(parsedContent[0].dataset).toBe('acs/acs1')
    })

    it('should simplify dataset with string c_dataset', async () => {
      const mockApiResponse = {
        ...sampleDatasetMetadata,
        dataset: [
          {
            c_vintage: 2010,
            c_dataset: ['dec', 'sf1'],
            c_geographyLink:
              'http://api.census.gov/data/2010/dec/sf1/geography.json',
            c_variablesLink:
              'http://api.census.gov/data/2010/dec/sf1/variables.json',
            c_tagsLink: 'http://api.census.gov/data/2010/dec/sf1/tags.json',
            c_examplesLink:
              'http://api.census.gov/data/2010/dec/sf1/examples.json',
            c_groupsLink: 'http://api.census.gov/data/2010/dec/sf1/groups.json',
            c_sorts_url: 'http://api.census.gov/data/2010/dec/sf1/sorts.json',
            c_documentationLink: 'https://www.census.gov/developer/',
            c_isAggregate: true,
            c_isCube: true,
            c_isAvailable: true,
            '@type': 'dcat:Dataset',
            title: 'Decennial SF1',
            accessLevel: 'public',
            bureauCode: ['006:07'],
            description: 'Summary File 1 (SF 1) contains detailed tables...',
            distribution: [
              {
                '@type': 'dcat:Distribution',
                accessURL: 'http://api.census.gov/data/2010/dec/sf1',
                description: 'API endpoint',
                format: 'API',
                mediaType: 'application/json',
                title: 'API endpoint',
              },
            ],
            contactPoint: {
              fn: 'Census Bureau Call Center',
              hasEmail: 'mailto:pio@census.gov',
            },
            identifier: 'https://api.census.gov/data/id/DECENNIALSF12010',
            keyword: ['census'],
            license: 'https://creativecommons.org/publicdomain/zero/1.0/',
            modified: '2018-08-28 12:52:11.0',
            programCode: ['006:004'],
            references: ['https://www.census.gov/developers/'],
            publisher: {
              '@type': 'org:Organization',
              name: 'U.S. Census Bureau',
              subOrganizationOf: {
                '@type': 'org:Organization',
                name: 'U.S. Department Of Commerce',
                subOrganizationOf: {
                  '@type': 'org:Organization',
                  name: 'U.S. Government',
                },
              },
            },
          },
        ],
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const result = await tool.toolHandler({}, 'test-api-key')
      const parsedContent = JSON.parse(result.content[0].text)

      expect(parsedContent[0].dataset).toBe('dec/sf1')
    })

    it('should include optional fields when present', async () => {
      const mockApiResponse = {
        ...sampleDatasetMetadata,
        dataset: [
          {
            ...sampleDatasetMetadata.dataset[0],
            c_isAggregate: true,
          },
        ],
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const result = await tool.toolHandler({}, 'test-api-key')
      const parsedContent = JSON.parse(result.content[0].text)

      expect(parsedContent[0]).toHaveProperty('years')
    })

    it('should omit optional fields when not present', async () => {
      const mockApiResponse = {
        ...sampleDatasetMetadata,
        dataset: [
          {
            ...sampleDatasetMetadata.dataset[0],
            c_isAggregate: true,
          },
        ],
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const result = await tool.toolHandler({}, 'test-api-key')
      const parsedContent = JSON.parse(result.content[0].text)

      expect(parsedContent[0]).not.toHaveProperty('c_isAggregate')
      expect(parsedContent[0]).not.toHaveProperty('c_isTimeseries')
      expect(parsedContent[0]).not.toHaveProperty('c_isMicrodata')
    })

    it('should return empty array when API returns no datasets', async () => {
      const mockApiResponse = { ...sampleDatasetMetadata, dataset: [] }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)

      const result = await tool.toolHandler({}, 'test-api-key')

      const parsedContent = JSON.parse(result.content[0].text)

      expect(parsedContent).toEqual([])
    })
  })

  describe('Cleaning title', () => {
    let tool: TestableListDatasetsTool

    beforeEach(() => {
      process.env.CENSUS_API_KEY = 'test-api-key'
      tool = new TestableListDatasetsTool()
    })

    it('should return original title when vintage is undefined', () => {
      const title =
        'Annual Economic Surveys: Annual Survey of Manufactures Benchmark 2017'
      const result = tool.testCleanTitle(title)
      expect(result).toBe(title)
    })

    it('should return original title when years are hyphenated', () => {
      const title = '2018-2022 American Community Survey: Migration Flows'
      const result = tool.testCleanTitle(title, 2018)
      expect(result).toBe(title)
    })

    it('should remove vintage year from title', () => {
      const title =
        'Economic Census: Industry by Products Statistics for the U.S.: 2022'
      const result = tool.testCleanTitle(title, 2022)
      expect(result).toBe(
        'Economic Census: Industry by Products Statistics for the U.S.:',
      )
    })

    it('should remove vintage at the beginning of title', () => {
      const title = '2000 County Business Patterns: Business Patterns'
      const result = tool.testCleanTitle(title, 2000)
      expect(result).toBe('County Business Patterns: Business Patterns')
    })

    it('should remove vintage in the middle of title', () => {
      const title = 'Aug 2011 Current Population Survey: Basic Monthly'
      const result = tool.testCleanTitle(title, 2011)
      expect(result).toBe('Aug Current Population Survey: Basic Monthly')
    })

    it('should not remove partial matches', () => {
      const title = 'Survey 20201 Data'
      const result = tool.testCleanTitle(title, 2020)
      expect(result).toBe('Survey 20201 Data')
    })

    it('should only remove first occurrences of vintage', () => {
      const title = '2020 Survey 2020 Data'
      const result = tool.testCleanTitle(title, 2020)
      expect(result).toBe('Survey 2020 Data')
    })
  })

  describe('Aggregating simplified dataset metadata', () => {
    let tool: TestableListDatasetsTool

    beforeEach(() => {
      tool = new TestableListDatasetsTool()
    })

    it('should aggregate single dataset', () => {
      const data: SimplifiedAPIDatasetType[] = [
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2020,
          title: 'American Community Survey 2020',
          c_isAggregate: true,
        },
      ]

      const result = tool.testAggregateDatasets(data)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        dataset: 'acs/acs1',
        title: 'American Community Survey',
        years: [2020],
      })
    })

    it('should aggregate multiple datasets with same c_dataset', () => {
      const data: SimplifiedAPIDatasetType[] = [
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2020,
          title: 'American Community Survey 2020',
          c_isAggregate: true,
        },
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2019,
          title: 'American Community Survey 2019',
          c_isAggregate: true,
        },
      ]

      const result = tool.testAggregateDatasets(data)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        dataset: 'acs/acs1',
        title: 'American Community Survey',
        years: [2019, 2020],
      })
    })

    it('should handle different titles for same dataset, keep only the latest/most recent', () => {
      const data: SimplifiedAPIDatasetType[] = [
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2020,
          title: 'American Community Survey 2020',
          c_isAggregate: true,
        },
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2019,
          title: 'ACS 1-Year 2019',
          c_isAggregate: true,
        },
      ]

      const result = tool.testAggregateDatasets(data)

      expect(result[0].title).toEqual('American Community Survey')
    })

    it('should not duplicate identical titles', () => {
      const data: SimplifiedAPIDatasetType[] = [
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2020,
          title: 'Survey 2020',
          c_isAggregate: true,
        },
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2019,
          title: 'Survey 2019',
          c_isAggregate: true,
        },
      ]

      const result = tool.testAggregateDatasets(data)

      expect(result[0].title).toEqual('Survey')
    })

    it('should handle datasets without vintage', () => {
      const data: SimplifiedAPIDatasetType[] = [
        {
          c_dataset: 'acs/acs1',
          title: 'American Community Survey',
          c_isAggregate: true,
        },
      ]

      const result = tool.testAggregateDatasets(data)

      expect(result[0]).toEqual({
        dataset: 'acs/acs1',
        title: 'American Community Survey',
        years: [],
      })
    })

    it('should sort vintages in ascending order', () => {
      const data: SimplifiedAPIDatasetType[] = [
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2022,
          title: 'Survey',
          c_isAggregate: true,
        },
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2018,
          title: 'Survey',
          c_isAggregate: true,
        },
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2020,
          title: 'Survey',
          c_isAggregate: true,
        },
      ]

      const result = tool.testAggregateDatasets(data)

      expect(result[0].years).toEqual([2018, 2020, 2022])
    })

    it('should handle empty input array', () => {
      const result = tool.testAggregateDatasets([])
      expect(result).toEqual([])
    })

    it('should handle multiple different datasets', () => {
      const data: SimplifiedAPIDatasetType[] = [
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2020,
          title: 'ACS 1-Year',
          c_isAggregate: true,
        },
        {
          c_dataset: 'acs/acs5',
          c_vintage: 2020,
          title: 'ACS 5-Year',
          c_isAggregate: true,
        },
      ]

      const result = tool.testAggregateDatasets(data)

      expect(result).toHaveLength(2)
      expect(result.map((r) => r.dataset)).toEqual(['acs/acs1', 'acs/acs5'])
    })

    it('should not duplicate vintages', () => {
      const data: SimplifiedAPIDatasetType[] = [
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2020,
          title: 'Survey A',
          c_isAggregate: true,
        },
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2020,
          title: 'Survey B',
          c_isAggregate: true,
        },
      ]

      const result = tool.testAggregateDatasets(data)

      expect(result[0].years).toEqual([2020])
    })

    it('should handle non-number vintage values gracefully', () => {
      const data: SimplifiedAPIDatasetType[] = [
        {
          c_dataset: 'acs/acs1',
          c_vintage: 2020,
          title: 'Survey',
          c_isAggregate: true,
        },
        {
          c_dataset: 'acs/acs1',
          c_vintage: undefined,
          title: 'Survey',
          c_isAggregate: true,
        },
      ]

      const result = tool.testAggregateDatasets(data)

      expect(result[0].years).toEqual([2020])
    })
  })

  describe('JSON Parsing Errors', () => {
    beforeEach(() => {
      process.env.CENSUS_API_KEY = 'test-api-key'
    })

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      const result = await tool.toolHandler({}, 'test-api-key')

      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('Failed to fetch datasets: Invalid JSON'),
      })
    })
  })

  describe('Constructor Binding', () => {
    it('should properly bind handler method', () => {
      // @ts-expect-error: spying on prototype method's bind isn't type-safe but is valid for testing
      const handlerBindSpy = vi.spyOn(
        ListDatasetsTool.prototype.handler,
        'bind',
      )
      new ListDatasetsTool()

      // This test ensures the handler is properly bound and won't lose context
      expect(handlerBindSpy).toHaveBeenCalled()
      handlerBindSpy.mockRestore()
    })
  })
})
