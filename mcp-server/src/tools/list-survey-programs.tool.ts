import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import { DatabaseService } from '../services/database.service.js'
import {
  ListSurveyProgramsArgs,
  ListSurveyProgramsInputSchema,
} from '../schema/list-survey-programs.schema.js'
import { SurveyProgramRow } from '../types/survey-program.types.js'
import { ToolContent } from '../types/base.types.js'

export const toolDescription = `
  Returns a complete index of all Census Bureau survey programs available in this MCP server. Use this tool at the start of a session or to determine what data is available, which surveys are covered, and how to find a dataset. No input arguments are required.

  Each result object includes:
  - program_label: human-readable name of the program (e.g., "American Community Survey")
  - program_string: short acronym used to identify the program (e.g., "ACS")
  - description: brief orientation text describing the program's scope and methodology
  - table_count: number of indexed data tables available for this program

  Programs without tables have no indexed tables — use fetch-aggregate-data with known variable names for those programs instead.
  Table coverage summary: ACS (~83%), CPS (~14%), SIPP (~3%). Decennial Census, Population Estimates, and Decennial Census of Island Areas have limited coverage. Economic Census, Economic Surveys, Geography, Census Planning Database, and several other programs have no indexed tables.
`

export class ListSurveyProgramsTool extends BaseTool<ListSurveyProgramsArgs> {
  name = 'list-survey-programs'
  description = toolDescription
  readonly requiresApiKey = false

  private dbService: DatabaseService

  inputSchema: Tool['inputSchema'] = {
    type: 'object',
    properties: {},
    required: [],
  }

  get argsSchema() {
    return ListSurveyProgramsInputSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
    this.dbService = DatabaseService.getInstance()
  }

  private async listSurveyPrograms(): Promise<SurveyProgramRow[]> {
    const result = await this.dbService.query<SurveyProgramRow>(
      `SELECT * FROM list_survey_programs()`,
      [],
    )

    return result.rows
  }

  async toolHandler(
    _args: ListSurveyProgramsArgs,
  ): Promise<{ content: ToolContent[] }> {
    try {
      const isDbHealthy = await this.dbService.healthCheck()
      if (!isDbHealthy) {
        return this.createErrorResponse(
          'Database connection failed - cannot list survey programs.',
        )
      }

      const results = await this.listSurveyPrograms()

      if (results && results.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} Survey Program${results.length === 1 ? '' : 's'}:\n\n${JSON.stringify(results, null, 2)}`,
            },
          ],
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: 'No survey programs found.',
            },
          ],
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return this.createErrorResponse(
        `Failed to list survey programs: ${errorMessage}`,
      )
    }
  }
}