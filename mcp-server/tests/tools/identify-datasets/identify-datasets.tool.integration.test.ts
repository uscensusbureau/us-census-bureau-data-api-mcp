import { describe, it, expect } from 'vitest'
import { IdentifyDatasetsTool } from '../../../src/tools/identify-datasets.tool'

describe('IdentifyDatasetsTool - Integration Tests', () => {
  it('should fetch and process real Census dataset metadata', async () => {
    const tool = new IdentifyDatasetsTool()

    const response = await tool.handler()

    expect(response.content[0].type).toBe('text')
    const responseText = response.content[0].text
    const parsedResponse = JSON.parse(responseText)

    expect(Array.isArray(parsedResponse)).toBe(true)
    if (parsedResponse.length > 0) {
      expect(parsedResponse[0]).toHaveProperty('c_dataset')
      expect(parsedResponse[0]).toHaveProperty('title')
      expect(parsedResponse[0]).toHaveProperty('c_vintages')
    }
  }, 10000) 
})
