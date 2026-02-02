import { z } from 'zod'

export const YearSchema = z.object({
  year: z.int().min(1776),
  import_geographies: z.boolean().default(false),
})

export const YearsArraySchema = z.array(YearSchema)
