import { z } from 'zod'

import { Tool } from '@modelcontextprotocol/sdk/types.js'

import {
  AllDatasetMetadataJsonSchema,
  AllDatasetMetadataJsonResponseType,
  SimplifiedAPIDatasetType,
  AggregatedResultType,
  DatasetType,
} from '../schema/identify-datasets.schema.js'

import { BaseTool } from './base.tool.js'

import { ToolContent } from '../types/base.types.js'

export class IdentifyDatasetsTool extends BaseTool<object> {
  name = 'identify-datasets'
  description = `This tool returns a data catalog of available Census datasets from the Census API. 
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

  private isValidMetadataResponse(
    data: unknown,
  ): data is AllDatasetMetadataJsonResponseType {
    try {
      AllDatasetMetadataJsonSchema.parse(data)
      return true
    } catch {
      return false
    }
  }

  private simplifyDataset(dataset: DatasetType) {
    const simplified: SimplifiedAPIDatasetType = {
      c_dataset: Array.isArray(dataset.c_dataset)
        ? dataset.c_dataset.join('/')
        : dataset.c_dataset,
      title: dataset.title,
      description: dataset.description,
    }
    if ('c_vintage' in dataset) simplified.c_vintage = dataset.c_vintage
    if ('c_isAggregate' in dataset)
      simplified.c_isAggregate = dataset.c_isAggregate
    if ('c_isTimeseries' in dataset)
      simplified.c_isTimeseries = dataset.c_isTimeseries
    if ('c_isMicrodata' in dataset)
      simplified.c_isMicrodata = dataset.c_isMicrodata
    return simplified
  }

  private cleanTitle(title: string, vintage?: number): string {
    if (vintage === undefined) return title;

    const vintageStr = vintage.toString();

    // Match the vintage surrounded by optional whitespace or punctuation
    const regex = new RegExp(`\\b${vintageStr}\\b`);
    
    // Replace vintage while preserving spacing
    return title.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
  }

  //aggregate by c_dataset and describe, create a list of years (c_vintages)
  private aggregateDatasets(data: SimplifiedAPIDatasetType[]): AggregatedResultType[] {
    const grouped = new Map<string, AggregatedResultType>();

    for (const entry of data) {
      const key = `${entry.c_dataset}|${entry.description}`;
      const vintage = entry.c_vintage;

      if (!grouped.has(key)) {
        grouped.set(key, {
          c_dataset: entry.c_dataset,
          title: this.cleanTitle(entry.title, vintage),
          description: entry.description,
          c_vintages: vintage !== undefined ? [vintage] : [],
          c_isAggregate: entry.c_isAggregate,
          c_isTimeseries: entry.c_isTimeseries,
          c_isMicrodata: entry.c_isMicrodata
        });
      } else {
        const existing = grouped.get(key)!;
        if (vintage !== undefined && !existing.c_vintages.includes(vintage)) {
          existing.c_vintages.push(vintage);
        }
      }
    }

    // Optionally sort vintages
    for (const entry of grouped.values()) {
      entry.c_vintages.sort((a, b) => a - b);
    }

      return Array.from(grouped.values()).map(entry => {
      // Remove c_vintages if it is empty
      if (entry.c_vintages.length === 0) {
          const { c_vintages, ...rest } = entry;
          return rest;
      }
      return entry;
      });
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
        return this.createErrorResponse(
          `Failed to fetch catalog: ${response.status} ${response.statusText}`,
        )
      }

      const data = await response.json()
      if (!this.isValidMetadataResponse(data)) {
        return this.createErrorResponse(
          'Catalog response did not match expected metadata schema',
        )
      }

      const simplified = data.dataset.map(this.simplifyDataset)
      const aggregated = this.aggregateDatasets(simplified)

      console.log(JSON.stringify(aggregated, null, 2));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(aggregated, null, 2),
          },
        ],
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      return this.createErrorResponse(
        `Failed to fetch datasets: ${errorMessage}`,
      )
    }
  }
}
