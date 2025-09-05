import { z } from 'zod'

export const ResolveGeographyFipsInputSchema = z.object({
  geography_name: z.string().describe('The name of the Geography to resolve.'),
  summary_level: z
    .string()
    .describe('The name or code of the Summary Level to search.')
    .optional(),
})

export const ResolveGeographyFipsArgsSchema = {
  type: 'object',
  properties: {
    geography_name: {
      type: 'string',
      description: 'The name of the Geography to resolve.',
    },
    summary_level: {
      type: 'string',
      description: 'The name or code of the Summary Level to search.',
    },
  },
  required: ['geography_name'],
}

export type ResolveGeographyFipsArgs = z.infer<
  typeof ResolveGeographyFipsInputSchema
>
