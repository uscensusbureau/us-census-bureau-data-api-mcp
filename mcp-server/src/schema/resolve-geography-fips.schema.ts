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
      description: 'The name of the geography to resolve.',
      examples: [
        'Philadelphia city, Pennsylvania',
        'Philadelphia County, Pennsylvania',
        'Philadelphia, Pennsylvania',
        'Philadelphia',
      ],
    },
    summary_level: {
      type: 'string',
      description:
        'Filters the geography resolution by the name or summary level code of a matching summary level.',
      examples: [
        'Place',
        '160',
        'County Subdivision',
        'County',
        'State',
        '040',
        'Division',
        'Region',
      ],
    },
  },
  required: ['geography_name'],
}

export type ResolveGeographyFipsArgs = z.infer<
  typeof ResolveGeographyFipsInputSchema
>
