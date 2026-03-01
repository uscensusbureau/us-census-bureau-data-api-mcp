import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import { DatabaseService } from '../services/database.service.js'
import {
  ResolveGeographyFipsArgs,
  ResolveGeographyFipsArgsSchema,
  ResolveGeographyFipsInputSchema,
} from '../schema/resolve-geography-fips.schema.js'

import { GeographySearchResultRow } from '../types/geography.types.js'
import { ToolContent } from '../types/base.types.js'

export const toolDescription = `
  Converts geographic place names into Census FIPS codes and query parameters. Use this tool when users reference locations by name (e.g., "Philadelphia", "Cook County", "New York State") rather than codes. Accepts natural language geography names and optional summary level filters (State, County, Place, County Subdivision). Returns FIPS codes, query syntax for fetch-aggregate-data tool, available vintages, and geographic hierarchy. Essential for translating human-readable location references into Census API parameters.
`
export class ResolveGeographyFipsTool extends BaseTool<ResolveGeographyFipsArgs> {
  name = 'resolve-geography-fips'
  description = toolDescription
  readonly requiresApiKey = false

  private dbService: DatabaseService

  inputSchema: Tool['inputSchema'] =
    ResolveGeographyFipsArgsSchema as Tool['inputSchema']

  get argsSchema() {
    return ResolveGeographyFipsInputSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
    this.dbService = DatabaseService.getInstance()
  }

  async toolHandler(
    args: ResolveGeographyFipsArgs,
  ): Promise<{ content: ToolContent[] }> {
    try {
      if (!this.dbService.healthCheck()) {
        return this.createErrorResponse(
          'Database connection failed - cannot retrieve geography metadata.',
        )
      }

      let result: GeographySearchResultRow[]

      if (args.summary_level) {
        const summaryLevels = this.dbService.searchSummaryLevels(args.summary_level)

        if (summaryLevels.length > 0) {
          result = this.dbService.searchGeographiesBySummaryLevel(
            args.geography_name,
            summaryLevels[0].code,
          )
        } else {
          result = this.dbService.searchGeographies(args.geography_name)
        }
      } else {
        result = this.dbService.searchGeographies(args.geography_name)
      }

      if (result.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Found ${result.length} Matching Geographies:\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `No geographies found matching "${args.geography_name}".`,
            },
          ],
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return this.createErrorResponse(
        `Failed to resolve geography: ${errorMessage}`,
      )
    }
  }
}
