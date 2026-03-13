import { describe, it, expect } from 'vitest'
import { ListSurveyProgramsInputSchema } from '../../src/schema/list-survey-programs.schema'

describe('ListSurveyProgramsInputSchema', () => {
  it('should accept an empty object', () => {
    expect(() => ListSurveyProgramsInputSchema.parse({})).not.toThrow()
  })

  it('should ignore unknown keys', () => {
    expect(() =>
      ListSurveyProgramsInputSchema.parse({ unexpected: 'value' }),
    ).not.toThrow()
  })
})