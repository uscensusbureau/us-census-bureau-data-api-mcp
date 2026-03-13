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
import { TextContent } from '@modelcontextprotocol/sdk/types.js'

vi.mock('../../../src/services/database.service.js', () => ({
  DatabaseService: {
    getInstance: vi.fn(),
  },
}))

import { validateToolStructure } from '../../helpers/test-utils'

import { DatabaseService } from '../../../src/services/database.service.js'
import {
  ListSurveyProgramsTool,
  toolDescription,
} from '../../../src/tools/list-survey-programs.tool'
import { SurveyProgramRow } from '../../../src/types/survey-program.types'

const mockSurveyPrograms: SurveyProgramRow[] = [
  {
    program_label: 'American Community Survey',
    program_string: 'ACS',
    description:
      'Ongoing survey providing annual demographic, social, economic, and housing data for communities across the United States.',
    table_count: 1200,
    searchable: true,
  },
  {
    program_label: 'Current Population Survey',
    program_string: 'CPS',
    description:
      'Monthly survey of households conducted by the Census Bureau for the Bureau of Labor Statistics.',
    table_count: 300,
    searchable: true,
  },
  {
    program_label: 'Economic Census',
    program_string: 'ECN',
    description:
      'Official five-year measure of American business and the economy.',
    table_count: 0,
    searchable: false,
  },
]

function getTextContent(
  response: Awaited<ReturnType<ListSurveyProgramsTool['handler']>>,
  index = 0,
): TextContent {
  const item = response.content[index]
  if (item.type !== 'text') {
    throw new Error(
      `Expected content[${index}] to be type "text", got "${item.type}"`,
    )
  }
  return item as TextContent
}

describe('ListSurveyProgramsTool', () => {
  let tool: ListSurveyProgramsTool
  let mockDbService: {
    healthCheck: Mock
    query: Mock
  }

  beforeAll(() => {
    mockDbService = {
      healthCheck: vi.fn(),
      query: vi.fn(),
    }
    ;(DatabaseService.getInstance as Mock).mockReturnValue(mockDbService)
  })

  beforeEach(() => {
    mockDbService.healthCheck.mockReset().mockResolvedValue(true)
    mockDbService.query.mockReset().mockResolvedValue({ rows: mockSurveyPrograms })

    tool = new ListSurveyProgramsTool()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should have the correct metadata', () => {
    validateToolStructure(tool)
    expect(tool.name).toBe('list-survey-programs')
    expect(tool.description).toBe(toolDescription)
    expect(tool.requiresApiKey).toBe(false)
  })

  it('should have a valid input schema with no properties or required fields', () => {
    const schema = tool.inputSchema

    expect(schema.type).toBe('object')
    expect(schema.properties).toEqual({})
    expect(schema.required).toEqual([])
  })

  describe('args schema validation', () => {
    it('should accept an empty object', () => {
      expect(() => tool.argsSchema.parse({})).not.toThrow()
    })

    it('should ignore unknown keys', () => {
      expect(() =>
        tool.argsSchema.parse({ unexpected: 'value' }),
      ).not.toThrow()
    })
  })

  describe('Response Handling', () => {
    describe('when results are found', () => {
      it('returns all survey programs', async () => {
        const result = await tool.handler({})

        expect(result.content).toHaveLength(1)
        expect(result.content[0].type).toBe('text')
        expect(getTextContent(result).text).toContain(
          'Found 3 Survey Programs:',
        )
        expect(getTextContent(result).text).toContain('American Community Survey')
        expect(getTextContent(result).text).toContain('Current Population Survey')
        expect(getTextContent(result).text).toContain('Economic Census')
      })

      it('uses singular form when exactly one result is returned', async () => {
        mockDbService.query.mockResolvedValue({ rows: [mockSurveyPrograms[0]] })

        const result = await tool.handler({})

        expect(getTextContent(result).text).toContain('Found 1 Survey Program:')
        expect(getTextContent(result).text).not.toContain('Survey Programs:')
      })

      it('serialises all fields for each program', async () => {
        const result = await tool.handler({})
        const parsed = JSON.parse(getTextContent(result).text.split('\n\n')[1])

        const acs = parsed.find(
          (p: SurveyProgramRow) => p.program_string === 'ACS',
        )
        expect(acs.program_label).toBe('American Community Survey')
        expect(acs.table_count).toBe(1200)
        expect(acs.searchable).toBe(true)
      })

      it('correctly reflects searchable: false for programs without indexed tables', async () => {
        const result = await tool.handler({})
        const parsed = JSON.parse(getTextContent(result).text.split('\n\n')[1])

        const ecn = parsed.find(
          (p: SurveyProgramRow) => p.program_string === 'ECN',
        )
        expect(ecn.table_count).toBe(0)
        expect(ecn.searchable).toBe(false)
      })

      it('handles null description gracefully', async () => {
        const programWithNullDescription: SurveyProgramRow = {
          ...mockSurveyPrograms[0],
          description: null,
        }
        mockDbService.query.mockResolvedValue({
          rows: [programWithNullDescription],
        })

        const result = await tool.handler({})
        const parsed = JSON.parse(getTextContent(result).text.split('\n\n')[1])

        expect(parsed[0].description).toBeNull()
      })
    })

    describe('when no results are found', () => {
      beforeEach(() => {
        mockDbService.query.mockResolvedValue({ rows: [] })
      })

      it('returns a no-results message', async () => {
        const result = await tool.handler({})

        expect(getTextContent(result).text).toBe(
          'No survey programs found.',
        )
      })
    })
  })
})