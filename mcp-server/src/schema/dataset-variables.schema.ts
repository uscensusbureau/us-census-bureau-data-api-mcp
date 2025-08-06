import { z } from 'zod'

//Argument Validation
export const FetchDatasetVariablesInputSchema = z.object({
  dataset: z.string().describe("Dataset identifier, e.g. 'acs/acs1'"),
  group: z
    .string()
    .describe(
      "Filter variables by a specific group for this dataset, e.g. 'S0101'",
    )
    .optional(),
  year: z
    .number()
    .describe('The year or vintage of the data, e.g. 2022')
    .optional(),
})

export const FetchDatasetVariablesArgsSchema = {
  type: 'object',
  properties: {
    dataset: {
      type: 'string',
      description: "The dataset identifier (e.g. 'acs/acs1')",
    },
    group: {
      type: 'string',
      description:
        "Filter variables by a specific group for this dataset, e.g. 'S0101'",
    },
    year: {
      type: 'number',
      description: 'The year or vintage of the data, e.g. 2022',
    },
  },
  required: ['dataset'],
}

//API Response Validation
const DateTimeSpecSchema = z.object({
  year: z.boolean().optional(),
  quarter: z.boolean().optional(),
  month: z.boolean().optional(),
  day: z.boolean().optional(),
})

const ValueRangeSchema = z.object({
  min: z.string(),
  max: z.string(),
  description: z.string(),
})

const ValuesSchema = z.object({
  item: z.record(z.string(), z.string()).optional(),
  range: z.array(ValueRangeSchema).optional(),
})

const VariableSchema = z.object({
  label: z.string(),
  concept: z.string().optional(),
  required: z.union([z.string(), z.boolean()]).optional(),
  predicateType: z
    .enum([
      'fips-for',
      'fips-in',
      'datetime',
      'int',
      'float',
      'lat',
      'long',
      'string',
      'ucgid',
    ])
    .optional(),
  group: z.string(),
  limit: z.number(),
  predicateOnly: z.boolean().optional(),
  'suggested-weight': z.string().optional(),
  attributes: z.string().optional(),
  datetime: DateTimeSpecSchema.optional(),
  values: ValuesSchema.optional(),
})

type FullVariable = z.infer<typeof VariableSchema>
type FullVariablesResponse = { variables: Record<string, FullVariable> }

export function getVariableNamesOnly(
  response: FullVariablesResponse,
): string[] {
  return Object.keys(response.variables)
}

export interface VariableBasic {
  name: string
  label: string
}

export function getVariableBasics(
  response: FullVariablesResponse,
): VariableBasic[] {
  return Object.entries(response.variables).map(([name, variable]) => ({
    name,
    label: variable.label,
  }))
}

export const VariablesJsonSchema = z.object({
  variables: z.record(z.string(), VariableSchema),
})

//Helper Functions for Validation and Parsing
export function validateJsonResponse(data: unknown): VariablesJsonResponse {
  return VariablesJsonSchema.parse(data)
}

//Export Types for Validation
export type FetchDatasetVariablesArgs = z.infer<
  typeof FetchDatasetVariablesInputSchema
>
export type VariablesJsonResponse = z.infer<typeof VariablesJsonSchema>
