import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import { DatabaseService } from '../services/database.service.js'
import {
  FetchDatasetGeographyArgs,
  FetchDatasetGeographyArgsSchema,
  FetchDatasetGeographyInputSchema,
  GeographyJsonSchema,
} from '../schema/dataset-geography.schema.js'

import { ToolContent } from '../types/base.types.js'
import {
  SummaryLevelRow,
  GeographyMetadata,
  ParsedGeographyEntry,
} from '../types/summary-level.types.js'

export class FetchDatasetGeographyTool extends BaseTool<FetchDatasetGeographyArgs> {
  name = 'fetch-dataset-geography'
  description = 'Fetch available geographies for filtering a dataset.'

  private dbService: DatabaseService

  inputSchema: Tool['inputSchema'] =
    FetchDatasetGeographyArgsSchema as Tool['inputSchema']

  get argsSchema() {
    return FetchDatasetGeographyInputSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
    this.dbService = DatabaseService.getInstance()
  }

  private async getSummaryLevels(): Promise<SummaryLevelRow[]> {
    const result = await this.dbService.query<SummaryLevelRow>(`
      SELECT 
        id,
        name,
        description,
        get_variable,
        query_name,
        on_spine,
        summary_level,
        parent_summary_level,
        parent_summary_level_id
      FROM summary_levels
      ORDER BY summary_level
    `)

    return result.rows
  }

  private buildGeographyMetadata(
    levels: SummaryLevelRow[],
  ): GeographyMetadata {
    const metadata: GeographyMetadata = {}

    for (const level of levels) {
      // Generate query example based on hierarchy
      let queryExample: string
      if (level.parent_summary_level) {
        // Find parent level to build hierarchical query
        const parentLevel = levels.find(
          (l) => l.summary_level === level.parent_summary_level,
        )
        if (parentLevel) {
          // Special case: Don't use US as a parent in queries
          if (parentLevel.summary_level === '010') {
            // For geographies that have US as parent, just use standalone syntax
            queryExample = `for=${level.query_name}:*`
          } else {
            // Normal hierarchical query
            queryExample = `for=${level.query_name}:*&in=${parentLevel.query_name}:*`
          }
        } else {
          queryExample = `for=${level.query_name}:*`
        }
      } else {
        // No parent - standalone query
        queryExample = `for=${level.query_name}:*`
      }

      metadata[level.name] = {
        querySyntax: level.query_name,
        code: level.summary_level,
        queryExample: queryExample,
        onSpine: level.on_spine,
      }
    }

    return metadata
  }

  // Override the parseGeographyJson function to use database data
  private parseGeographyJsonWithDb(
    rawGeography: unknown,
    geographyLevels: SummaryLevelRow[],
  ): ParsedGeographyEntry[] {
    const validatedRaw = GeographyJsonSchema.parse(rawGeography)

    if (validatedRaw.fips.length === 0) {
      console.log('No FIPS geography data found in response')
      return []
    }

    // Build metadata from database
    const geographyMetadata = this.buildGeographyMetadata(geographyLevels)

    // Create reverse lookup by summary level code
    const codeToLevel = new Map<string, SummaryLevelRow>()
    geographyLevels.forEach((level) => {
      codeToLevel.set(level.summary_level, level)
    })

    const parsed = validatedRaw.fips.map((entry) => {
      const dbLevel = codeToLevel.get(entry.geoLevelDisplay)
      const metadata = dbLevel ? geographyMetadata[dbLevel.name] : null

      // Use database data if available, fallback to simple replacement
      const displayName =
        dbLevel?.name || this.getDisplayNameFromApiName(entry.name)
      const querySyntax = dbLevel?.query_name || entry.name.replace(/\s+/g, '+')
      const queryExample =
        metadata?.queryExample ||
        this.generateFallbackQueryExample(entry.name, entry.requires)

      return {
        vintage: entry.referenceDate,
        displayName: displayName,
        querySyntax: querySyntax,
        code: entry.geoLevelDisplay,
        name: entry.name,
        hierarchy: entry.requires
          ? [...entry.requires, entry.name]
          : [entry.name],
        fullName: displayName,
        description: dbLevel?.description || undefined,
        onSpine: metadata?.onSpine ?? false,
        queryExample: queryExample,
        requires: entry.requires,
        allowsWildcard: entry.wildcard,
        wildcardFor: entry.optionalWithWCFor,
      }
    })

    return parsed
  }

  // Simple fallback for query example generation (only used if database record not found)
  private generateFallbackQueryExample(
    name: string,
    requires?: string[],
  ): string {
    const querySyntax = name.replace(/\s+/g, '+')

    if (!requires || requires.length === 0) {
      return `for=${querySyntax}:*`
    }

    const parentSyntax = requires
      .map((req) => req.replace(/\s+/g, '+'))
      .join(':*&in=')
    return `for=${querySyntax}:*&in=${parentSyntax}:*`
  }

  private getDisplayNameFromApiName(apiName: string): string {
    return apiName
      .split(/[\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  async handler(
    args: FetchDatasetGeographyArgs,
  ): Promise<{ content: ToolContent[] }> {
    try {
      const apiKey = process.env.CENSUS_API_KEY
      if (!apiKey) {
        return this.createErrorResponse('Error: CENSUS_API_KEY is not set.')
      }

      // Check database health first
      const isDbHealthy = await this.dbService.healthCheck()
      if (!isDbHealthy) {
        return this.createErrorResponse(
          'Database connection failed - cannot retrieve geography metadata.',
        )
      }

      // Get geography levels from database
      const geographyLevels = await this.getSummaryLevels()

      const fetch = (await import('node-fetch')).default
      let year = ''
      if (args.year) {
        year = `${args.year}/`
      }

      const baseUrl = `https://api.census.gov/data/${year}${args.dataset}/geography.json`
      const geographyUrl = `${baseUrl}?key=${apiKey}`

      const geographyResponse = await fetch(geographyUrl)

      if (geographyResponse.ok) {
        const geographyData = await geographyResponse.json()

        try {
          const validatedData = GeographyJsonSchema.parse(geographyData)
          // Use the database-aware parsing function
          const parsedGeographyData = this.parseGeographyJsonWithDb(
            validatedData,
            geographyLevels,
          )

          return {
            content: [
              {
                type: 'text',
                text: `Available geographies for ${args.dataset}${args.year ? ` (${args.year})` : ''}:\n\n${JSON.stringify(parsedGeographyData, null, 2)}`,
              },
            ],
          }
        } catch (validationError) {
          const validationMessage =
            validationError instanceof Error
              ? validationError.message
              : 'Validation failed'
          console.error('Schema validation failed:', validationMessage)

          return this.createErrorResponse(
            `Response validation failed: ${validationMessage}`,
          )
        }
      } else {
        console.log(geographyResponse.status)
        return this.createErrorResponse(
          `Geography endpoint returned: ${geographyResponse.status} ${geographyResponse.statusText}`,
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return this.createErrorResponse(
        `Failed to fetch dataset geography levels: ${errorMessage}`,
      )
    }
  }
}
