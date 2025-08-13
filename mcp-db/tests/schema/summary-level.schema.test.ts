import { describe, expect, it } from 'vitest'
import {
  SummaryLevelsArraySchema,
  SummaryLevelSchema,
} from '../../src/schema/summary-level.schema'

describe('SummaryLevelSchema', () => {
  it('should validate a Summary Level object', () => {
    const summaryLevel = {
      get_variable: 'US',
      query_name: 'United States',
      name: 'United States',
      code: '010',
      parent_summary_level: null,
      on_spine: true,
      description:
        'The entire United States, including the 50 states, District of Columbia, and territories. The highest level in the Census Bureau’s geographic hierarchy.',
    }

    const result = SummaryLevelSchema.safeParse(summaryLevel)

    expect(result.success).toBe(true)
  })
})

describe('SummaryLevelsArraySchema', () => {
  it('should validate a Summary Level object', () => {
    const summaryLevels: SummaryLevelSchema[] = [
      {
        get_variable: 'US',
        query_name: 'United States',
        name: 'United States',
        code: '010',
        parent_summary_level: null,
        on_spine: true,
        description:
          'The entire United States, including the 50 states, District of Columbia, and territories. The highest level in the Census Bureau’s geographic hierarchy.',
      },
      {
        get_variable: 'REGION',
        query_name: 'region',
        name: 'Region',
        code: '020',
        parent_summary_level: '010',
        on_spine: true,
        description:
          'Four groupings of states established by the Census Bureau for the presentation of census data: Northeast, Midwest, South, and West regions.',
      },
    ]

    const result = SummaryLevelsArraySchema.safeParse(summaryLevels)

    expect(result.success).toBe(true)
  })
})
