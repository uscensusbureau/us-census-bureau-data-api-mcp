import { z } from 'zod'

export const SummaryLevelSchema = z.object({
  name: z.string(),
  description: z.string(),
  get_variable: z.string(),
  query_name: z.string(),
  on_spine: z.boolean(),
  code: z.string(),
  parent_summary_level: z.string().nullable(),
})

export const SummaryLevelsArraySchema = z.array(SummaryLevelSchema)
