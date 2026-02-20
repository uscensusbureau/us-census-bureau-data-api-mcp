import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import { DatabaseService } from '../services/database.service.js'
import {
  SearchDataTablesArgs,
  SearchDataTablesArgsSchema,
  SearchDataTablesInputSchema,
} from '../schema/search-data-tables.schema.js'

import { DataTableSearchResultRow } from '../types/data-table.types.js'
import { ToolContent } from '../types/base.types.js'

export const toolDescription = `
  Search for Census Bureau data tables by ID, label, or data API endpoint (e.g. acs/acs1). Use this tool when users reference a topic or variable category (e.g., "language spoken at home", "income by race") and need to identify the correct table ID before fetching data. Accepts a table ID prefix (e.g., "B16005"), a natural language label query, and an optional API endpoint scope. Returns a ranked list of matching tables with their canonical labels, component, and available years.
  
  Each result object includes:
  - data_table_id: maps to the get.group parameter in fetch-aggregate-data
  - label: canonical label for the data table
  - component: the program and component this table belongs to (e.g., "American Community Survey - ACS 1-Year Estimates")
  - years: an array of years in which this table is available
  `

export class SearchDataTablesTool extends BaseTool<SearchDataTablesArgs> {
  name = 'search-data-tables'
  description = toolDescription
  readonly requiresApiKey = false

  private dbService: DatabaseService

  inputSchema: Tool['inputSchema'] =
    SearchDataTablesArgsSchema as unknown as Tool['inputSchema']

  get argsSchema() {
    return SearchDataTablesInputSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
    this.dbService = DatabaseService.getInstance()
  }

  private async searchDataTables(
    args: SearchDataTablesArgs,
  ): Promise<DataTableSearchResultRow[]> {
    const {
      data_table_id = null,
      label_query = null,
      api_endpoint = null,
      limit = 20,
    } = args

    const result = await this.dbService.query<DataTableSearchResultRow>(
      `SELECT * FROM search_data_tables($1, $2, $3, $4)`,
      [data_table_id, label_query, api_endpoint, limit],
    )

    return result.rows
  }

  async toolHandler(
    args: SearchDataTablesArgs,
  ): Promise<{ content: ToolContent[] }> {
    try {
      // Check database health first
      const isDbHealthy = await this.dbService.healthCheck()
      if (!isDbHealthy) {
        return this.createErrorResponse(
          'Database connection failed - cannot search data tables.',
        )
      }

      const results = await this.searchDataTables(args)

      if (results && results.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} Matching Data Table${results.length === 1 ? '' : 's'}:\n\n${JSON.stringify(results, null, 2)}`,
            },
          ],
        }
      } else {
        const searchTerms = [
          args.data_table_id && `table ID "${args.data_table_id}"`,
          args.label_query && `label "${args.label_query}"`,
          args.api_endpoint && `api endpoint "${args.api_endpoint}"`,
        ]
          .filter(Boolean)
          .join(', ')

        return {
          content: [
            {
              type: 'text',
              text: `No data tables found matching ${searchTerms}.`,
            },
          ],
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return this.createErrorResponse(
        `Failed to search data tables: ${errorMessage}`,
      )
    }
  }
}
