import { z } from 'zod';

export const GeographyLevelSchema = z.object({
  name: z.string(),
  description: z.string(),
  get_variable: z.string(),
  query_name: z.string(),
  on_spine: z.boolean(),
  summary_level: z.string(),
  parent_summary_level: z.string().nullable()
});