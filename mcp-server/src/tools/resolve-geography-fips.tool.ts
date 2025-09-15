import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import { DatabaseService } from '../services/database.service.js'
import {
  ResolveGeographyFipsArgs,
  ResolveGeographyFipsArgsSchema,
  ResolveGeographyFipsInputSchema,
} from '../schema/resolve-geography-fips.schema.js'

import { GeographySearchResultRow } from '../types/geography.types.js'
import { SummaryLevelRow } from '../types/summary-level.types.js'
import { ToolContent } from '../types/base.types.js'

export const toolDescription = `
	Provides potential matches for Census Bureau geographies. Includes Nation, Region, Division, State, Counties, and County Subdivision 
	geographies. For each result, it returns information about the geography, for and in parameters with the correct
	FIPS code for constructing fetching data with other tools, and what years (vintages) the geography is available in.
`

export class ResolveGeographyFipsTool extends BaseTool<ResolveGeographyFipsArgs> {
  name = 'resolve-geography-fips'
  description = toolDescription

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

  private async searchGeographiesBySummaryLevel(
    query: string,
    summary_level_code: string,
  ): Promise<GeographySearchResultRow[]> {
    const result = await this.dbService.query<GeographySearchResultRow>(
      `SELECT * FROM search_geographies_by_summary_level($1, $2)`,
      [query, summary_level_code],
    )

    return result.rows
  }

  private async searchGeographies(
    query: string,
  ): Promise<GeographySearchResultRow[]> {
    const result = await this.dbService.query<GeographySearchResultRow>(
      `SELECT * FROM search_geographies($1)`,
      [query],
    )

    return result.rows
  }

  private async searchSummaryLevels(query: string): Promise<SummaryLevelRow[]> {
    const result = await this.dbService.query<SummaryLevelRow>(
      `SELECT * FROM search_summary_levels($1)`,
      [query],
    )

    return result.rows
  }

  async handler(
    args: ResolveGeographyFipsArgs,
  ): Promise<{ content: ToolContent[] }> {
    try {
      // Check database health first
      const isDbHealthy = await this.dbService.healthCheck()
      if (!isDbHealthy) {
        return this.createErrorResponse(
          'Database connection failed - cannot retrieve geography metadata.',
        )
      }

      let result

      if (args.summary_level) {
        const summary_levels = await this.searchSummaryLevels(
          args.summary_level,
        )

        if (summary_levels.length > 0) {
          result = await this.searchGeographiesBySummaryLevel(
            args.geography_name,
            summary_levels[0].code,
          )
        } else {
          result = await this.searchGeographies(args.geography_name)
        }
      } else {
        result = await this.searchGeographies(args.geography_name)
      }

      if (result && result.length > 0) {
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
