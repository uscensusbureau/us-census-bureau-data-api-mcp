import { describe, expect, it } from 'vitest'
import { YearsArraySchema, YearSchema } from '../../src/schema/year.schema'

describe('SummaryLevelSchema', () => {
  it('should validate a Summary Level object', () => {
    const year = {
      year: 2020,
    }

    const result = YearSchema.safeParse(year)

    expect(result.success).toBe(true)
  })
})

describe('YearsArraySchema', () => {
  it('should validate a Summary Level object', () => {
    const years: YearSchema[] = [
      {
        year: 2020,
      },
      {
        year: 2023,
      },
    ]

    const result = YearsArraySchema.safeParse(years)

    expect(result.success).toBe(true)
  })
})
