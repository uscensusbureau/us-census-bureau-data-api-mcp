import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MCPServer } from '../src/server'

vi.mock('../src/tools/list-datasets.tool.js', () => ({
  ListDatasetsTool: vi
    .fn()
    .mockImplementation(() => ({ name: 'list-datasets' })),
}))

vi.mock('../src/tools/fetch-dataset-geography.tool.js', () => ({
  FetchDatasetGeographyTool: vi
    .fn()
    .mockImplementation(() => ({ name: 'fetch-dataset-geography' })),
}))

vi.mock('../src/tools/fetch-aggregate-data.tool.js', () => ({
  FetchAggregateDataTool: vi
    .fn()
    .mockImplementation(() => ({ name: 'fetch-aggregate-data' })),
}))

vi.mock('../src/prompts/population.prompt.js', () => ({
  PopulationPrompt: vi
    .fn()
    .mockImplementation(() => ({ name: 'population-prompt' })),
}))

vi.mock('../src/tools/resolve-geography-fips.tool.js', () => ({
  ResolveGeographyFipsTool: vi
    .fn()
    .mockImplementation(() => ({ name: 'resolve-geography-fips' })),
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}))

describe('main', () => {
  let promptRegistrySpy: ReturnType<typeof vi.spyOn>
  let toolRegistrySpy: ReturnType<typeof vi.spyOn>
  let connectSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    promptRegistrySpy = vi.spyOn(MCPServer.prototype, 'registerPrompt')
    toolRegistrySpy = vi.spyOn(MCPServer.prototype, 'registerTool')
    connectSpy = vi.spyOn(MCPServer.prototype, 'connect')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()

    vi.resetModules()
  })

  it('should register tools and prompts and connect to the MCP Server', async () => {
    await import('../src/index.ts')

    expect(promptRegistrySpy).toHaveBeenCalledTimes(1)
    expect(promptRegistrySpy).toHaveBeenCalledWith({
      name: 'population-prompt',
    })

    expect(toolRegistrySpy).toHaveBeenCalledTimes(4)

    expect(toolRegistrySpy).toHaveBeenCalledWith({
      name: 'fetch-aggregate-data',
    })

    expect(toolRegistrySpy).toHaveBeenCalledWith({
      name: 'list-datasets',
    })
    expect(toolRegistrySpy).toHaveBeenCalledWith({
      name: 'fetch-dataset-geography',
    })

    expect(toolRegistrySpy).toHaveBeenCalledWith({
      name: 'resolve-geography-fips',
    })

    expect(connectSpy).toHaveBeenCalledTimes(1)
  })

  it('should handle errors in main function', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    // Make one of the operations throw an error
    connectSpy.mockRejectedValueOnce(new Error('Connection failed'))

    await import('../src/index.ts')

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error))
  })
})
