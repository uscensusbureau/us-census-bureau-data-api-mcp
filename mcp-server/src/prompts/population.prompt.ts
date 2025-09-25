import { z } from 'zod'
import { BasePrompt } from './base.prompt.js'
import { PopulationArgsSchema } from '../schema/population.prompt.schema.js'

export class PopulationPrompt extends BasePrompt<
  z.infer<typeof PopulationArgsSchema>
> {
  name = 'get_population_data'
  description =
    'Get official current population data for any US geographic area using U.S. Census Bureau Data'

  arguments = [
    {
      name: 'geography_name',
      description: 'Name of the geographic area (city, state, county, etc.)',
      required: true,
    },
  ]

  constructor() {
    super()
    this.handler = this.handler.bind(this)
  }

  get argsSchema() {
    return PopulationArgsSchema
  }

  async handler(args: z.infer<typeof PopulationArgsSchema>) {
    const { geography_name } = args

    let promptText = `Get the most recent population data for ${geography_name}`
    promptText +=
      ' using the Census MCP Server. Start by using the resolve-geography-fips tool to identify the correct geography.'

    // This should work now that we have proper inheritance
    return this.createPromptResponse(
      `What’s the population of ${geography_name}?`,
      promptText,
    )
  }
}
