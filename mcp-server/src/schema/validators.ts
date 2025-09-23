import { z } from 'zod'
import type { RefinementCtx } from 'zod'

type Dataset = {
  tool: string
  message: string
  identifiers?: string[]
}

type TableArgs = {
  group?: string
  variables?: string[]
  for?: string
  ucgid?: string
}

const datasets: Dataset[] = [
  {
    tool: 'fetch-aggregate-data',
    message: 'Incompatible dataset. Please use the fetch-aggregate-data tool.',
  },
  {
    tool: 'fetch-timeseries-data',
    message:
      'This data is currently not supported by the U.S. Census Bureau Data API MCP Server.',
    identifiers: ['timeseries'],
  },
  {
    tool: 'fetch-microdata',
    message:
      'This data is currently not supported by the U.S. Census Bureau Data API MCP Server.',
    identifiers: ['cfspum', 'cps', 'pums', 'pumpr', 'sipp'],
  },
]

export function datasetValidator(datasetArg: string): Dataset {
  const matched = datasets.find((dataset: Dataset) =>
    dataset.identifiers?.some((identifier: string) =>
      datasetArg.includes(identifier),
    ),
  )

  return (
    matched ?? datasets.find((dataset: Dataset) => !('identifiers' in dataset))!
  )
}

export function validateGeographyArgs(args: TableArgs, ctx: RefinementCtx) {
  if (!args.for && !args.ucgid) {
    ctx.addIssue({
      path: ['for', 'ucgid'],
      code: z.ZodIssueCode.custom,
      message: 'No geography specified error - define for or ucgid arguments.',
    })
  } else if (args.for && args.ucgid) {
    ctx.addIssue({
      path: ['for', 'ucgid'],
      code: z.ZodIssueCode.custom,
      message:
        'Too many geographies specified error - define for or ucgid only, not both.',
    })
  }
}
