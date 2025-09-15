import { describe, it, expect } from 'vitest'
import { PopulationArgsSchema } from '../../src/schema/population.prompt.schema'

describe('PopulationArgsSchema', () => {
  it('validates the inclusion of geography_name', () => {
    const populationArgs = {
      geography_name: 'Pennsylvania',
    }

    const result = PopulationArgsSchema.safeParse(populationArgs)

    expect(result.success).toBe(true)
  })
})
