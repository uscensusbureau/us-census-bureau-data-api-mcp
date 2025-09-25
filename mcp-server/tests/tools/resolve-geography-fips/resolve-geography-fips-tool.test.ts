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

import {
  validateResponseStructure,
  validateToolStructure,
} from '../../helpers/test-utils'

import { DatabaseService } from '../../../src/services/database.service.js'
import {
  ResolveGeographyFipsTool,
  toolDescription,
} from '../../../src/tools/resolve-geography-fips.tool'

const defaultArgs = {
  geography_name: 'Philadelphia, Pennsylvania',
}

const summaryLevelArgs = {
  ...defaultArgs,
  summary_level: '160',
}

describe('ResolveGeographyFipsTool', () => {
  let tool: ResolveGeographyFipsTool
  let mockDbService: {
    healthCheck: Mock
    query: Mock
  }

  let mockSummaryLevels: SummaryLevelRow[]
  let mockGeographies: GeographySearchResultRow[]

  beforeAll(() => {
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

    mockDbService = {
      healthCheck: vi.fn(),
      query: vi.fn(),
    }
    ;(DatabaseService.getInstance as Mock).mockReturnValue(mockDbService)
  })

  beforeEach(() => {
    mockDbService.healthCheck.mockReset().mockResolvedValue(true)
    mockDbService.query
      .mockReset()
      .mockResolvedValue({ rows: mockSummaryLevels })

    tool = new ResolveGeographyFipsTool()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should have the correct metadata', () => {
    validateToolStructure(tool)
    expect(tool.name).toBe('resolve-geography-fips')
    expect(tool.description).toBe(toolDescription)
    expect(tool.requiresApiKey).toBe(false)
  })

  it('should have valid input schema', () => {
    const schema = tool.inputSchema

    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('geography_name')
    expect(schema.properties).toHaveProperty('summary_level')
    expect(schema.required).toEqual(['geography_name'])
  })

  it('should have matching args schema', () => {
    expect(() => tool.argsSchema.parse(defaultArgs)).not.toThrow()
  })

  describe('Database Integration', () => {
    it('should check database health', async () => {
      await tool.handler(defaultArgs)

      expect(mockDbService.healthCheck).toHaveBeenCalled()
    })

    it('should return error when database is unhealthy', async () => {
      mockDbService.healthCheck.mockResolvedValue(false)

      const response = await tool.handler(defaultArgs)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Database connection failed - cannot retrieve geography metadata',
      )
    })

    it('should handle database query errors', async () => {
      mockDbService.query.mockRejectedValue(
        new Error('Database connection failed'),
      )

      const response = await tool.handler(defaultArgs)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Database connection failed')
    })

    describe('when only the geography_name is provided', () => {
      it('should call search_geographies', async () => {
        await tool.handler(defaultArgs)

        // Verify the SQL query structure
        const queryCall = mockDbService.query.mock.calls[0][0]
        expect(queryCall).toContain('SELECT * FROM search_geographies($1)')
      })
    })

    describe('when the geography_name and summary_level_code are provided', () => {
      it('should call search_geographies_by_summary_level', async () => {
        await tool.handler(summaryLevelArgs)

        // Verify the SQL query structure
        const queryCall1 = mockDbService.query.mock.calls[0][0]
        const queryCall2 = mockDbService.query.mock.calls[1][0]
        expect(queryCall1).toContain('SELECT * FROM search_summary_levels($1)')
        expect(queryCall2).toContain(
          'SELECT * FROM search_geographies_by_summary_level($1, $2)',
        )
      })
    })
  })

  describe('Database Response Handling', () => {
    describe('when the summary_levels search returns no summary_levels', () => {
      it('calls search_geographies instead', async () => {
        mockDbService.query.mockResolvedValue({ rows: [] })
        await tool.handler(summaryLevelArgs)

        const queryCall1 = mockDbService.query.mock.calls[0][0]
        const queryCall2 = mockDbService.query.mock.calls[1][0]

        expect(queryCall1).toContain('SELECT * FROM search_summary_levels($1)')
        expect(queryCall2).toContain('SELECT * FROM search_geographies($1)')
      })
    })

    describe('when there are geography results', () => {
      it('returns the found geographies', async () => {
        mockGeographies = [
          {
            id: 1,
            name: 'Los Angeles',
            summary_level_name: 'Place',
            latitude: 34.0522,
            longitude: -118.2437,
            for_param: 'place:44000',
            in_param: 'state:06',
            weighted_score: 0.3,
          },
          {
            id: 2,
            name: 'Los Angeles County',
            summary_level_name: 'County',
            latitude: 34.0522,
            longitude: -118.2437,
            for_param: 'county:037',
            in_param: 'state:06',
            weighted_score: 0.4,
          },
        ]

        mockDbService.query.mockResolvedValue({ rows: mockGeographies })

        const result = await tool.handler({ geography_name: 'Los Angeles' })

        expect(result.content).toHaveLength(1)
        expect(result.content[0].type).toBe('text')
        expect(result.content[0].text).toContain(
          'Found 2 Matching Geographies:',
        )
        expect(result.content[0].text).toContain('Los Angeles')
        expect(result.content[0].text).toContain('Los Angeles County')
      })
    })

    describe('when there are no geography results', () => {
      it('returns a message indicating no results', async () => {
        mockDbService.query.mockResolvedValue({ rows: [] })

        const result = await tool.handler({
          geography_name: 'NonexistentPlace',
        })

        expect(result.content).toHaveLength(1)
        expect(result.content[0].type).toBe('text')
        expect(result.content[0].text).toContain(
          'No geographies found matching "NonexistentPlace".',
        )
      })

      it('includes summary level context when specified', async () => {
        mockDbService.query
          .mockResolvedValueOnce({ rows: [{ code: '050', name: 'County' }] }) // summary level found
          .mockResolvedValueOnce({ rows: [] }) // no geographies found

        const result = await tool.handler({
          geography_name: 'NonexistentPlace',
          summary_level: 'County',
        })

        expect(result.content[0].text).toContain(
          'No geographies found matching "NonexistentPlace".',
        )
      })
    })
  })
})
