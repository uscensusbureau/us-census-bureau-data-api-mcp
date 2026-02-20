import { z } from 'zod'

export const SearchDataTablesArgsSchema = {
  type: 'object',
  properties: {
    data_table_id: {
      type: 'string',
      description:
        'Census table ID or prefix to search by (e.g., "B16005" matches B16005, B16005A, B16005D, etc.). Supports exact match or prefix match.',
    },
    label_query: {
      type: 'string',
      description:
        'Natural language search phrase for the table label (e.g., "language spoken at home", "income by age"). Uses fuzzy similarity matching.',
    },
    api_endpoint: {
      type: 'string',
      description:
        'Scope results to a specific data API endpoint (e.g., "acs/acs1"). When provided, only tables belonging to that endpoint are returned.',
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results to return. Defaults to 20.',
    },
  },
  required: [],
} as const

export const SearchDataTablesInputSchema = z
  .object({
    data_table_id: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Census table ID or prefix to search by (e.g., "B16005" matches B16005, B16005A, B16005D, etc.). Supports exact match or prefix match.',
      ),
    label_query: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Natural language search phrase for the table label (e.g., "language spoken at home", "income by age"). Uses fuzzy similarity matching.',
      ),
    api_endpoint: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Scope results to a specific component API endpoint (e.g., "acs/acs1"). When provided, only tables available under that component are returned.',
      ),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe('Maximum number of results to return. Defaults to 20.'),
  })
  .refine(
    (args) =>
      args.data_table_id !== undefined ||
      args.label_query !== undefined ||
      args.api_endpoint !== undefined,
    {
      message:
        'At least one search parameter must be provided: data_table_id, label_query, or api_endpoint.',
    },
  )

export type SearchDataTablesArgs = z.infer<typeof SearchDataTablesInputSchema>