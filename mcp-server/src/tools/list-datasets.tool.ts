import { z } from 'zod'

import { Tool } from '@modelcontextprotocol/sdk/types.js'

import {
  AllDatasetMetadataJsonSchema,
  AllDatasetMetadataJsonResponseType,
  SimplifiedAPIDatasetType,
  AggregatedResultType,
  DatasetType,
} from '../schema/list-datasets.schema.js'

import { BaseTool } from './base.tool.js'

import { ToolContent } from '../types/base.types.js'

export class ListDatasetsTool extends BaseTool<object> {
  name = 'list-datasets'
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
    }
    if ('c_vintage' in dataset) simplified.c_vintage = dataset.c_vintage
    if ('c_isAggregate' in dataset)
      simplified.c_isAggregate = dataset.c_isAggregate
    return simplified
  }

private cleanTitle(title: string, vintage?: number): string {
    if (vintage === undefined) return title;

    const vintageStr = vintage.toString();

    // Avoid matching vintage if it's part of a number-number pattern (like 2018-2022)
    const regex = new RegExp(`(?<!\\d\\s*-\\s*)\\b${vintageStr}\\b(?!\\s*-\\s*\\d)`);

    // Replace only the first vintage while preserving spacing
    return title.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
}

// Aggregate by c_dataset, create arrays vintages and keep only latest title
private aggregateDatasets(data: SimplifiedAPIDatasetType[]): AggregatedResultType[] {
  const grouped = new Map<string, AggregatedResultType>();

  for (const entry of data) {
    // Filter out datasets that do not have c_isAggregate: true
    if (entry.c_isAggregate !== true) {
      continue;
    }

    const key = entry.c_dataset;
    const vintage = entry.c_vintage;

    const cleanedTitle = this.cleanTitle(entry.title, vintage);

    if (!grouped.has(key)) {
      grouped.set(key, {
        dataset: entry.c_dataset,
        title: cleanedTitle,
        years: vintage !== undefined && typeof vintage === 'number' ? [vintage] : []
      });
    } else {
      const existing = grouped.get(key)!;
      
      // Only keep the first title (skip adding additional titles)
      if (existing.title.length === 0) {
        existing.title.push(cleanedTitle);
      }
      
      // Add vintage if it's a number and not already present
      if (vintage !== undefined && typeof vintage === 'number' && !existing.years.includes(vintage)) {
        existing.years.push(vintage);
      }
    }
  }

  // Sort vintages for each entry
  for (const entry of grouped.values()) {
    entry.years.sort((a, b) => a - b);
  }

  return Array.from(grouped.values());
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

      let simplified = data.dataset.map(this.simplifyDataset)
      // Sort simplified datasets by c_vintage (descending)
      simplified = simplified.sort((a, b) => (b.c_vintage || 0) - (a.c_vintage || 0))

      const aggregated = this.aggregateDatasets(simplified)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(aggregated, (key, value) => {
              return value === null ? undefined : value;
            }),
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
