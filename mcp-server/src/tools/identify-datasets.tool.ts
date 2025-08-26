import { z } from 'zod'

import { Tool } from '@modelcontextprotocol/sdk/types.js'

import {
  DatasetMetadataJsonSchema,
  DatasetMetadataJsonResponseType,
  SimplifiedAPIDatasetType,
} from '../schema/identify-datasets.schema.js'

import { BaseTool } from './base.tool.js'

import { ToolContent } from '../types/base.types.js'

export class IdentifyDatasetsTool extends BaseTool<{}> { 
  name = 'identify-datasets'
  description = 
  `This tool returns a data catalog of available Census datasets from the Census API. 
  The LLM should analyze this catalog against the user's request and identify the best dataset match(es).
  The LLM must return at least one dataset name or indicate low confidence if no dataset is a strong match. 

  Dataset selection guidelines:
    - Always make your best guess as the primary recommendation
    - Match on subject matter first, then temporal scope
    - When year is specified, prioritize exact matches
    - For topic matches, prefer more specific over general datasets
    - Prefer more comprehensive datasets when scope is unclear
    - Explain WHY you chose that dataset, focusing on topic relevance and time alignment
    - Include 2-3 alternatives with clear reasoning
    - Mention key trade-offs (accuracy vs. timeliness, scope vs. detail, specificity vs. completeness)
    - If the user request is ambiguous, state your assumptions
    - Flag when no dataset is a strong match (confidence: 'low')
    `

  inputSchema: Tool['inputSchema'] = {
    type: 'object',
    properties: {},
    required: [],
  }

  get argsSchema() {
  return z.object({})
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  private isValidMetadataResponse(data: unknown): data is DatasetMetadataJsonResponseType {
    try {
      DatasetMetadataJsonSchema.parse(data)
      return true
    } catch {
      return false
    }
  }

  private simplifyDataset(dataset: any) {
    const simplified: SimplifiedAPIDatasetType = {
      c_dataset: Array.isArray(dataset.c_dataset) ? dataset.c_dataset.join('/') : dataset.c_dataset,
      title: dataset.title,
      description: dataset.description,
    }
    if ('c_vintage' in dataset) simplified.c_vintage = dataset.c_vintage
    if ('c_isAggregate' in dataset) simplified.c_isAggregate = dataset.c_isAggregate
    if ('c_isTimeseries' in dataset) simplified.c_isTimeseries = dataset.c_isTimeseries
    if ('c_isMicrodata' in dataset) simplified.c_isMicrodata = dataset.c_isMicrodata
    return simplified
  }

  async handler(): Promise<{ content: ToolContent[] }> {
    try {
      const apiKey = process.env.CENSUS_API_KEY
      if (!apiKey) {
        return this.createErrorResponse('CENSUS_API_KEY is not set')
      }

      const fetch = (await import('node-fetch')).default
      const catalogUrl = `https://api.census.gov/data.json?key=${apiKey}`

      const response = await fetch(catalogUrl)
      if (!response.ok) {
        return this.createErrorResponse(`Failed to fetch catalog: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      if (!this.isValidMetadataResponse(data)) {
        return this.createErrorResponse('Catalog response did not match expected metadata schema')
      }

      const simplified = data.dataset.map(this.simplifyDataset)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(simplified, null, 2),
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return this.createErrorResponse(`Failed to fetch datasets: ${errorMessage}`)
    }
  }
}