import { describe, expect, it } from 'vitest'
import { YearsArraySchema, YearSchema } from '../../src/schema/year.schema'
import { z } from 'zod'

describe('YearSchema', () => {
  it('should validate a Year object', () => {
    const year = {
      year: 2020,
    }

    const result = YearSchema.safeParse(year)

    expect(result.success).toBe(true)
    expect(result.data.import_geographies).toBe(false)
  })
})

describe('YearsArraySchema', () => {
  it('should validate a Years array', () => {
    const years: z.infer<typeof YearSchema>[] = [
      {
        year: 2020,
        import_geographies: true,
      },
      {
        year: 2023,
        import_geographies: true,
      },
    ]

    const result = YearsArraySchema.safeParse(years)

    expect(result.success).toBe(true)
  })
})
