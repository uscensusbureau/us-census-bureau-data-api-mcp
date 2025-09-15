import { describe, it, expect, vi } from 'vitest'

import { PopulationPrompt } from '../../../src/prompts/population.prompt'
import { PopulationArgsSchema } from '../../../src/schema/population.prompt.schema'

describe('Population Prompt', () => {
  it('has the correct name', () => {
    const prompt = new PopulationPrompt()
    expect(prompt.name).toBe('get_population_data')
  })

  it('has a description', () => {
    const prompt = new PopulationPrompt()
    expect(prompt.description).toBe(
      'Get official current population data for any US geographic area using U.S. Census Bureau Data',
    )
  })

  it('accepts the correct arguments', () => {
    const prompt = new PopulationPrompt()
    expect(prompt.arguments).toEqual([
      {
        name: 'geography_name',
        description: 'Name of the geographic area (city, state, county, etc.)',
        required: true,
      },
    ])
  })

  describe('argsSchema', () => {
    it('returns the arguments schema', () => {
      const prompt = new PopulationPrompt()
      expect(prompt.argsSchema).toBe(PopulationArgsSchema)
    })
  })

  describe('handler', () => {
    it('formats a prompt for server utilization using the provided geography_name', async () => {
      const prompt = new PopulationPrompt()
      const testGeography = 'New York City'

      const mockResponse = {
        title: `Retrieve official Census population data for ${testGeography}`,
        prompt: `Get the most recent population data for ${testGeography} using the Census MCP Server. Start by using the resolve-geography-fips tool to identify the correct geography.`,
      }

      prompt.createPromptResponse = vi.fn().mockReturnValue(mockResponse)

      const result = await prompt.handler({ geography_name: testGeography })

      expect(prompt.createPromptResponse).toHaveBeenCalledWith(
        `What’s the population of ${testGeography}?`,
        `Get the most recent population data for ${testGeography} using the Census MCP Server. Start by using the resolve-geography-fips tool to identify the correct geography.`,
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles different geography names correctly', async () => {
      const prompt = new PopulationPrompt()
      const testCases = [
        'California',
        'Los Angeles County',
        'Miami-Dade County',
      ]

      prompt.createPromptResponse = vi.fn()

      for (const geography of testCases) {
        await prompt.handler({ geography_name: geography })

        expect(prompt.createPromptResponse).toHaveBeenCalledWith(
          `What’s the population of ${geography}?`,
          `Get the most recent population data for ${geography} using the Census MCP Server. Start by using the resolve-geography-fips tool to identify the correct geography.`,
        )
      }
    })
  })
})
