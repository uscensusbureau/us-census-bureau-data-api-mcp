import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import { DatabaseService } from '../services/database.service.js'
import {
  SearchDataTablesArgs,
  SearchDataTablesArgsSchema,
  SearchDataTablesInputSchema,
} from '../schema/search-data-tables.schema.js'

import { ToolContent } from '../types/base.types.js'

export const toolDescription = `
  Search for Census Bureau data tables by ID, label, or dataset. Use this tool when users reference a topic or variable category (e.g., "language spoken at home", "income by race") and need to identify the correct table ID before fetching data. Accepts a table ID prefix (e.g., "B16005"), a natural language label query, and an optional dataset scope. Returns a ranked list of matching tables with their canonical labels and an array of datasets in which they appear.

  Each result object includes:
  - data_table_id: maps to the get.group parameter in fetch-aggregate-data (this is a top-level field on the result, not on each dataset entry)
  - datasets: an array of dataset entries, where each entry contains:
      - dataset_param: maps to the dataset parameter in fetch-aggregate-data (e.g., "acs/acs1", "acs/acs5")
      - year: use this to select the appropriate vintage year in fetch-aggregate-data
      - label: dataset-specific variant label, present only when it differs from the canonical data label
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

  async toolHandler(
    args: SearchDataTablesArgs,
  ): Promise<{ content: ToolContent[] }> {
    try {
      if (!this.dbService.healthCheck()) {
        return this.createErrorResponse(
          'Database connection failed - cannot search data tables.',
        )
      }

      const results = this.dbService.searchDataTables(args)

      if (results.length > 0) {
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
          args.dataset_id && `dataset "${args.dataset_id}"`,
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
