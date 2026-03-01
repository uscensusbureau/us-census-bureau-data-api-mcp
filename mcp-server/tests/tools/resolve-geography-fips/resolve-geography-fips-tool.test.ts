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
import { GeographySearchResultRow } from '../../../src/types/geography.types'

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
    searchGeographies: Mock
    searchGeographiesBySummaryLevel: Mock
    searchSummaryLevels: Mock
  }

  let mockSummaryLevels: { code: string; name: string }[]
  let mockGeographies: GeographySearchResultRow[]

  beforeAll(() => {
    mockSummaryLevels = [
      { code: '010', name: 'United States' },
      { code: '040', name: 'State' },
      { code: '050', name: 'County' },
    ]

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

    mockDbService = {
      healthCheck: vi.fn(),
      searchGeographies: vi.fn(),
      searchGeographiesBySummaryLevel: vi.fn(),
      searchSummaryLevels: vi.fn(),
    }
    ;(DatabaseService.getInstance as Mock).mockReturnValue(mockDbService)
  })

  beforeEach(() => {
    mockDbService.healthCheck.mockReset().mockReturnValue(true)
    mockDbService.searchGeographies.mockReset().mockReturnValue(mockGeographies)
    mockDbService.searchGeographiesBySummaryLevel
      .mockReset()
      .mockReturnValue(mockGeographies)
    mockDbService.searchSummaryLevels
      .mockReset()
      .mockReturnValue(mockSummaryLevels)

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
      mockDbService.healthCheck.mockReturnValue(false)

      const response = await tool.handler(defaultArgs)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain(
        'Database connection failed - cannot retrieve geography metadata',
      )
    })

    it('should handle database query errors', async () => {
      mockDbService.searchGeographies.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const response = await tool.handler(defaultArgs)
      validateResponseStructure(response)
      expect(response.content[0].text).toContain('Database connection failed')
    })

    describe('when only the geography_name is provided', () => {
      it('should call searchGeographies', async () => {
        await tool.handler(defaultArgs)

        expect(mockDbService.searchGeographies).toHaveBeenCalledWith(
          defaultArgs.geography_name,
        )
      })
    })

    describe('when the geography_name and summary_level are provided', () => {
      it('should call searchSummaryLevels then searchGeographiesBySummaryLevel', async () => {
        await tool.handler(summaryLevelArgs)

        expect(mockDbService.searchSummaryLevels).toHaveBeenCalledWith(
          summaryLevelArgs.summary_level,
        )
        expect(
          mockDbService.searchGeographiesBySummaryLevel,
        ).toHaveBeenCalledWith(
          summaryLevelArgs.geography_name,
          mockSummaryLevels[0].code,
        )
      })
    })
  })

  describe('Database Response Handling', () => {
    describe('when the summary_levels search returns no summary_levels', () => {
      it('calls searchGeographies instead', async () => {
        mockDbService.searchSummaryLevels.mockReturnValue([])
        await tool.handler(summaryLevelArgs)

        expect(mockDbService.searchSummaryLevels).toHaveBeenCalled()
        expect(mockDbService.searchGeographies).toHaveBeenCalledWith(
          summaryLevelArgs.geography_name,
        )
        expect(
          mockDbService.searchGeographiesBySummaryLevel,
        ).not.toHaveBeenCalled()
      })
    })

    describe('when there are geography results', () => {
      it('returns the found geographies', async () => {
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
        mockDbService.searchGeographies.mockReturnValue([])

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
        mockDbService.searchSummaryLevels.mockReturnValue([
          { code: '050', name: 'County' },
        ])
        mockDbService.searchGeographiesBySummaryLevel.mockReturnValue([])

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
