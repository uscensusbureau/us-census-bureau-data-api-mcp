import { z } from 'zod'

export const YearSchema = z.object({
  year: z.int().min(1776),
})

export const YearsArraySchema = z.array(YearSchema)
