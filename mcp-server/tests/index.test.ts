import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from 'vitest'
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

vi.mock('../src/tools/search-data-tables.tool.js', () => ({
  SearchDataTablesTool: vi
    .fn()
    .mockImplementation(() => ({ name: 'search-data-tables' })),
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}))

describe('main', () => {
  let promptRegistrySpy: MockInstance
  let toolRegistrySpy: MockInstance
  let connectSpy: MockInstance

  beforeEach(() => {
    promptRegistrySpy = vi.spyOn(MCPServer.prototype, 'registerPrompt')
    toolRegistrySpy = vi.spyOn(MCPServer.prototype, 'registerTool')
    connectSpy = vi.spyOn(MCPServer.prototype, 'connect') as MockInstance
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

    expect(toolRegistrySpy).toHaveBeenCalledTimes(5)

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

    expect(toolRegistrySpy).toHaveBeenCalledWith({
      name: 'search-data-tables',
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
