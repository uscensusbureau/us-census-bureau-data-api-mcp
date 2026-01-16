import { z } from 'zod'

export const SummaryLevelSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  get_variable: z.string().min(1, 'Get variable is required'),
  query_name: z.string().min(1, 'Query name is required'),
  on_spine: z.boolean(),
  code: z.string().min(1, 'Code is required'),
  parent_summary_level: z.string().nullable(),
})

export const SummaryLevelsArraySchema = z.array(SummaryLevelSchema)

export type SummaryLevel = z.infer<typeof SummaryLevelSchema>
