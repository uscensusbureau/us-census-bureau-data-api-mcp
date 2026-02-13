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

// Mock DatabaseService
vi.mock('../../../src/services/database.service.js', () => ({
  DatabaseService: {
    getInstance: vi.fn(),
  },
}))

import {
  validateResponseStructure,
  validateToolStructure,
} from '../../helpers/test-utils'

import { DatabaseService } from '../../../src/services/database.service.js'
import {
  SearchDataTablesTool,
  toolDescription,
} from '../../../src/tools/search-data-tables.tool'
import { DataTableSearchResultRow } from '../../../src/types/data-table.types'

const byIdArgs = { data_table_id: 'B16005' }
const byLabelArgs = { label_query: 'language spoken at home' }
const byDatasetArgs = { dataset_id: 'ACSDTY2009' }
const allParamsArgs = {
  data_table_id: 'B16005',
  label_query: 'language spoken at home',
  dataset_id: 'ACSDTY2009',
  limit: 10,
}

const mockDataTables: DataTableSearchResultRow[] = [
  {
    data_table_id: 'B16005',
    label: 'Nativity By Language Spoken At Home By Ability To Speak English',
    datasets: [
      { dataset_id: 'ACSDTY2009', year: 2009 },
      { dataset_id: 'ACSDTY2010', year: 2010 },
    ],
  },
  {
    data_table_id: 'B16005D',
    label: 'Nativity By Language Spoken At Home By Ability To Speak English',
    datasets: [
      {
        dataset_id: 'ACSDTY2009',
        year: 2009,
        label: 'Nativity By Language Spoken At Home (Asian Alone)',
      },
      {
        dataset_id: 'ACSDTY2010',
        year: 2010,
        label: 'Nativity By Language Spoken At Home (Asian Alone)',
      },
    ],
  },
]

function getTextContent(
  response: Awaited<ReturnType<SearchDataTablesTool['handler']>>,
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

describe('SearchDataTablesTool', () => {
  let tool: SearchDataTablesTool
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
    mockDbService.query.mockReset().mockResolvedValue({ rows: mockDataTables })

    tool = new SearchDataTablesTool()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should have the correct metadata', () => {
    validateToolStructure(tool)
    expect(tool.name).toBe('search-data-tables')
    expect(tool.description).toBe(toolDescription)
    expect(tool.requiresApiKey).toBe(false)
  })

  it('should have valid input schema', () => {
    const schema = tool.inputSchema

    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('data_table_id')
    expect(schema.properties).toHaveProperty('label_query')
    expect(schema.properties).toHaveProperty('dataset_id')
    expect(schema.properties).toHaveProperty('limit')
    expect(schema.required).toEqual([])
  })

  describe('args schema validation', () => {
    it('should accept data_table_id alone', () => {
      expect(() => tool.argsSchema.parse(byIdArgs)).not.toThrow()
    })

    it('should accept label_query alone', () => {
      expect(() => tool.argsSchema.parse(byLabelArgs)).not.toThrow()
    })

    it('should accept dataset_id alone', () => {
      expect(() => tool.argsSchema.parse(byDatasetArgs)).not.toThrow()
    })

    it('should accept all params together', () => {
      expect(() => tool.argsSchema.parse(allParamsArgs)).not.toThrow()
    })

    it('should reject when no search params are provided', () => {
      expect(() => tool.argsSchema.parse({})).toThrow(
        'At least one search parameter must be provided',
      )
    })

    it('should reject limit above 100', () => {
      expect(() =>
        tool.argsSchema.parse({ data_table_id: 'B16005', limit: 101 }),
      ).toThrow()
    })

    it('should reject a non-positive limit', () => {
      expect(() =>
        tool.argsSchema.parse({ data_table_id: 'B16005', limit: 0 }),
      ).toThrow()
    })
  })

  describe('Database Integration', () => {
    it('should check database health before querying', async () => {
      await tool.handler(byIdArgs)

      expect(mockDbService.healthCheck).toHaveBeenCalledOnce()
    })

    it('should return error when database is unhealthy', async () => {
      mockDbService.healthCheck.mockResolvedValue(false)

      const response = await tool.handler(byIdArgs)
      validateResponseStructure(response)
      expect(getTextContent(response).text).toContain(
        'Database connection failed - cannot search data tables.',
      )
    })

    it('should handle database query errors gracefully', async () => {
      mockDbService.query.mockRejectedValue(new Error('Connection timeout'))

      const response = await tool.handler(byIdArgs)
      validateResponseStructure(response)
      expect(getTextContent(response).text).toContain(
        'Failed to search data tables: Connection timeout',
      )
    })

    it('should call search_data_tables with correct positional params', async () => {
      await tool.handler(allParamsArgs)

      const [sql, params] = mockDbService.query.mock.calls[0]
      expect(sql).toContain('SELECT * FROM search_data_tables($1, $2, $3, $4)')
      expect(params).toEqual([
        'B16005',
        'language spoken at home',
        'ACSDTY2009',
        10,
      ])
    })

    it('should pass null for omitted optional params', async () => {
      await tool.handler(byLabelArgs)

      const [, params] = mockDbService.query.mock.calls[0]
      expect(params[0]).toBeNull() // data_table_id
      expect(params[1]).toBe('language spoken at home')
      expect(params[2]).toBeNull() // dataset_id
      expect(params[3]).toBe(20) // default limit
    })

    it('should use default limit of 20 when limit is not provided', async () => {
      await tool.handler(byIdArgs)

      const [, params] = mockDbService.query.mock.calls[0]
      expect(params[3]).toBe(20)
    })
  })

  describe('Response Handling', () => {
    describe('when results are found', () => {
      it('returns the matching data tables', async () => {
        const result = await tool.handler(byLabelArgs)

        expect(result.content).toHaveLength(1)
        expect(result.content[0].type).toBe('text')
        expect(getTextContent(result).text).toContain(
          'Found 2 Matching Data Tables:',
        )
        expect(getTextContent(result).text).toContain('B16005')
        expect(getTextContent(result).text).toContain('B16005D')
      })

      it('uses singular form when exactly one result is returned', async () => {
        mockDbService.query.mockResolvedValue({ rows: [mockDataTables[0]] })

        const result = await tool.handler(byIdArgs)

        expect(getTextContent(result).text).toContain(
          'Found 1 Matching Data Table:',
        )
        expect(getTextContent(result).text).not.toContain('Data Tables:')
      })

      it('serialises datasets including variant labels', async () => {
        const result = await tool.handler(byIdArgs)
        const parsed = JSON.parse(getTextContent(result).text.split('\n\n')[1])

        const tableD = parsed.find(
          (t: DataTableSearchResultRow) => t.data_table_id === 'B16005D',
        )
        expect(tableD.datasets[0].label).toBe(
          'Nativity By Language Spoken At Home (Asian Alone)',
        )
      })

      it('omits label from dataset entries that match the canonical label', async () => {
        const result = await tool.handler(byIdArgs)
        const parsed = JSON.parse(getTextContent(result).text.split('\n\n')[1])

        const baseTable = parsed.find(
          (t: DataTableSearchResultRow) => t.data_table_id === 'B16005',
        )
        expect(baseTable.datasets[0].label).toBeUndefined()
      })
    })

    describe('when no results are found', () => {
      beforeEach(() => {
        mockDbService.query.mockResolvedValue({ rows: [] })
      })

      it('returns a no-results message for a data_table_id search', async () => {
        const result = await tool.handler({ data_table_id: 'ZZZZZZ' })

        expect(getTextContent(result).text).toBe(
          'No data tables found matching table ID "ZZZZZZ".',
        )
      })

      it('returns a no-results message for a label_query search', async () => {
        const result = await tool.handler({ label_query: 'nonexistent topic' })

        expect(getTextContent(result).text).toBe(
          'No data tables found matching label "nonexistent topic".',
        )
      })

      it('returns a no-results message for a dataset_id search', async () => {
        const result = await tool.handler({ dataset_id: 'UNKNOWN2099' })

        expect(getTextContent(result).text).toBe(
          'No data tables found matching dataset "UNKNOWN2099".',
        )
      })

      it('lists all provided search terms in the no-results message', async () => {
        const result = await tool.handler({
          data_table_id: 'B99999',
          label_query: 'obscure topic',
          dataset_id: 'UNKNOWN2099',
        })

        expect(getTextContent(result).text).toContain('table ID "B99999"')
        expect(getTextContent(result).text).toContain('label "obscure topic"')
        expect(getTextContent(result).text).toContain('dataset "UNKNOWN2099"')
      })
    })
  })
})
