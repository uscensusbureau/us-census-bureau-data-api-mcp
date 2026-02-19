import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import fetch from 'node-fetch'

import { BaseTool } from './base.tool.js'
import { buildCitation } from '../helpers/citation.js'
import {
  CacheDuration,
  CacheDurationUnit,
  QueryCacheService,
} from '../services/queryCache.service.js'
import {
  FetchAggregateDataToolSchema,
  TableArgs,
  TableSchema,
} from '../schema/fetch-aggregate-data.schema.js'
import { ToolContent } from '../types/base.types.js'

import {
  datasetValidator,
  validateGeographyArgs,
} from '../schema/validators.js'

export const toolDescription = `
  Fetches statistical data from U.S. Census Bureau datasets including population, demographics, income, housing, employment, and economic indicators. Use this tool when users request Census statistics, demographic breakdowns, or socioeconomic data for specific geographic areas. Requires a dataset identifier, year/vintage, geographic scope (state, county, tract, etc.), and specific variables or table groups. Returns structured data with proper citations for authoritative government statistics.
`

export class FetchAggregateDataTool extends BaseTool<TableArgs> {
  name = 'fetch-aggregate-data'
  description = toolDescription
  inputSchema: Tool['inputSchema'] = TableSchema as Tool['inputSchema']
  readonly requiresApiKey = true

  private cacheService: QueryCacheService
  private cacheDuration: CacheDuration

  get argsSchema() {
    return FetchAggregateDataToolSchema.superRefine((args, ctx) => {
      //Check that the correct tool is used to fetch data
      const identifiedDataset = datasetValidator(args.dataset)

      if (identifiedDataset.tool !== this.name) {
        ctx.addIssue({
          path: ['dataset'],
          code: z.ZodIssueCode.custom,
          message: identifiedDataset.message,
        })
      }

      validateGeographyArgs(args, ctx)
    })
  }

  constructor() {
    super()
    this.handler = this.handler.bind(this)
    this.cacheService = QueryCacheService.getInstance()
    this.cacheDuration = new CacheDuration(1, CacheDurationUnit.YEAR)
  }

  validateArgs(input: unknown) {
    return this.argsSchema.safeParse(input)
  }

  async toolHandler(
    args: TableArgs,
    apiKey: string,
  ): Promise<{ content: ToolContent[] }> {
    const baseUrl = `https://api.census.gov/data/${args.year}/${args.dataset}`

    let getParams = ''

    if (args.get.variables || args.get.group) {
      if (args.get.variables) {
        getParams = args.get.variables.join(',')
      }

      if (args.get.group) {
        if (getParams != '') {
          getParams += ','
        }
        getParams += `group(${args.get.group})`
      }
    }

    const query = new URLSearchParams({
      get: getParams,
    })

    if (args.for) {
      query.append('for', args.for)
    }

    if (args.in) {
      query.append('in', args.in)
    }

    if (args.ucgid) {
      query.append('ucgid', args.ucgid)
    }

    if (args.predicates) {
      for (const [key, value] of Object.entries(args.predicates)) {
        query.append(key, value)
      }
    }

    const descriptive = args.descriptive?.toString() ?? 'false'
    query.append('descriptive', descriptive)

    const variablesForDbQuery = args.get.variables || []
    const geographySpecForDbQuery = JSON.stringify({
      for: args.for || null,
      in: args.in || null,
    })

    query.append('key', apiKey)
    const url = `${baseUrl}?${query.toString()}`

    const cacheParams = {
      dataset: args.dataset,
      group: args.get.group || null,
      year: args.year,
      variables: variablesForDbQuery,
      geographySpec: geographySpecForDbQuery,
    }

    // Check cache
    const cachedData = await this.cacheService.get(cacheParams)
    if (cachedData) {
      console.log(`Retrieving tool results from cache`)
      const responseText = this.createSuccessResponseText(
        cachedData,
        args.dataset,
        url,
      )
      return this.createSuccessResponse(responseText)
    }

    try {
      const res = await fetch(url)

      console.log(`URL Attempted: ${url}`)

      if (!res.ok) {
        return this.createErrorResponse(
          `Census API error: ${res.status} ${res.statusText}`,
        )
      }

      const data = (await res.json()) as string[][]

      void this.cacheService
        .set(cacheParams, data, this.cacheDuration)
        .catch((error: Error) => {
          console.error('Cache write failed:', error)
        })

      const responseText = this.createSuccessResponseText(
        data,
        args.dataset,
        url,
      )
      return this.createSuccessResponse(responseText)
    } catch (err) {
      return this.createErrorResponse(`Fetch failed: ${(err as Error).message}`)
    }
  }

  private createSuccessResponseText(
    responseData: string[][],
    dataset: string,
    url: string,
  ): string {
    const [headers, ...rows] = responseData

    const output = rows
      .map((row) => headers.map((h, i) => `${h}: ${row[i]}`).join(', '))
      .join('\n')

    const citation = buildCitation(url)
    return `Response from ${dataset}:\n${output}\n${citation}`
  }
}
