import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { BaseTool } from './base.tool.js'
import {
  getVariableNamesOnly,
  FetchDatasetVariablesArgs,
  FetchDatasetVariablesArgsSchema,
  FetchDatasetVariablesInputSchema,
  VariablesJsonSchema,
} from '../schema/dataset-variables.schema.js'

import { ToolContent } from '../types/base.types.js'

export class FetchDatasetVariablesTool extends BaseTool<FetchDatasetVariablesArgs> {
  name = 'fetch-dataset-variables'
  description = 'Fetch available variables for querying a dataset.'

  inputSchema: Tool['inputSchema'] =
    FetchDatasetVariablesArgsSchema as Tool['inputSchema']

  get argsSchema() {
    return FetchDatasetVariablesInputSchema
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  async handler(
    args: FetchDatasetVariablesArgs,
  ): Promise<{ content: ToolContent[] }> {
    try {
      const apiKey = process.env.CENSUS_API_KEY
      if (!apiKey) {
        return this.createErrorResponse('Error: CENSUS_API_KEY is not set.')
      }

      const fetch = (await import('node-fetch')).default
      let group = '' // Start with a blank group
      let year = '' // Start with a blank year
      let variablesAppendix = '' // Assign a blank URL appendix

      if (args.group) {
        group = `/groups/${args.group}`
      } // Add the year if it is present in the input args
      if (args.year) {
        year = `${args.year}/`
      } // Add the year if it is present in the input args
      if (!args.group) {
        variablesAppendix = '/variables'
      }

      const baseUrl = `https://api.census.gov/data/${year}${args.dataset}${group}${variablesAppendix}.json` // Construct the URL
      const variablesUrl = `${baseUrl}?key=${apiKey}` // Add the API Key

      const variablesResponse = await fetch(variablesUrl)

      if (variablesResponse.ok) {
        const variablesData = await variablesResponse.json()

        try {
          const validatedData = VariablesJsonSchema.parse(variablesData)
          const variableNames = getVariableNamesOnly(validatedData)

          // Calculate some useful stats for the LLM
          const totalVariables = variableNames.length
          let groupResponse = ''

          if (args.group) {
            groupResponse = `Group: ${args.group}`
          }

          const responseText = [
            `Dataset: ${args.dataset}${args.year ? ` (${args.year})` : ''}`,
            `${groupResponse}`,
            `Total Variables: ${totalVariables}`,
            ``,
            `Complete variable list:`,
            JSON.stringify(variableNames, null, 2),
          ].join('\n')

          return {
            content: [
              {
                type: 'text',
                text: responseText,
              },
            ],
          }
        } catch (validationError) {
          // If validation fails, return the error details
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
        console.log(variablesResponse.status)
        return this.createErrorResponse(
          `Variables endpoint returned: ${variablesResponse.status} ${variablesResponse.statusText}`,
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      return this.createErrorResponse(
        `Failed to fetch dataset variables: ${errorMessage}`,
      )
    }
  }
}
