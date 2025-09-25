import { describe, it, expect } from 'vitest'
import { ListDatasetsTool } from '../../../src/tools/list-datasets.tool'

describe('ListDatasetsTool - Integration Tests', () => {
  it('should fetch and process real Census dataset metadata', async () => {
    const tool = new ListDatasetsTool()

    const response = await tool.toolHandler({}, process.env.CENSUS_API_KEY)

    expect(response.content[0].type).toBe('text')
    const responseText = response.content[0].text

    const parsedResponse = JSON.parse(responseText)

    expect(Array.isArray(parsedResponse)).toBe(true)
    if (parsedResponse.length > 0) {
      expect(parsedResponse[0]).toHaveProperty('dataset')
      expect(parsedResponse[0]).toHaveProperty('title')
      expect(parsedResponse[0]).toHaveProperty('years')
    }
  }, 10000)
})
