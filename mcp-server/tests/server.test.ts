import { describe, it, expect, beforeEach, vi } from 'vitest'
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { MCPServer } from '../src/server'
import { ToolRegistry } from '../src/tools/base.tool'
import { MockFetchSummaryTableTool } from './mocks/fetch-summary-table.mock'
import { ErrorThrowingTool } from './mocks/error-throwing-tool.mock'

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start() {
      return true
    },
  })),
}))

describe('MCP Server', () => {
  let mcpServer: MCPServer
  let mockFetchSummaryTableTool: MockFetchSummaryTableTool
  let connectSpy: ReturnType<typeof vi.spyOn>
  let getAllSpy: ReturnType<typeof vi.spyOn>
  let registrySpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    connectSpy = vi.spyOn(Server.prototype, 'connect')
    getAllSpy = vi.spyOn(ToolRegistry.prototype, 'getAll')
    registrySpy = vi.spyOn(ToolRegistry.prototype, 'register')
    mcpServer = new MCPServer('test-server', '1.0.0')
    mockFetchSummaryTableTool = new MockFetchSummaryTableTool()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('connect', () => {
    it('should call the connect method in the MCP Server', () => {
      const mockTransport = new StdioServerTransport()

      mcpServer.connect(mockTransport)
      expect(connectSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('registerTool', () => {
    it('should register tools successfully', () => {
      mcpServer.registerTool(mockFetchSummaryTableTool)

      expect(registrySpy).toHaveBeenCalledOnce()
      expect(registrySpy).toHaveBeenCalledWith(mockFetchSummaryTableTool)
    })

    it('should store registered tools in registry', () => {
      const tool1 = mockFetchSummaryTableTool
      const tool2 = new MockFetchSummaryTableTool()

      mcpServer.registerTool(tool1)
      mcpServer.registerTool(tool2)

      expect(registrySpy).toHaveBeenCalledTimes(2)
      expect(registrySpy).toHaveBeenNthCalledWith(1, tool1)
      expect(registrySpy).toHaveBeenNthCalledWith(2, tool2)
    })
  })

  describe('getTools', () => {
    beforeEach(() => {
      mcpServer.registerTool(mockFetchSummaryTableTool)
    })

    it('should successfully call tool with valid arguments', async () => {
      mcpServer.getTools()
      expect(getAllSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleToolCall', () => {
    beforeEach(() => {
      mcpServer.registerTool(mockFetchSummaryTableTool)
    })

    it('should successfully call tool with valid arguments', async () => {
      const request = {
        params: {
          name: 'fetch-summary-table-mock',
          arguments: {
            message: 'test message',
          },
        },
      }

      const result = await mcpServer.handleToolCall(request)
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
    })

    it('should throw InvalidParams for invalid arguments (ZodError)', async () => {
      const request = {
        params: {
          name: 'fetch-summary-table-mock',
          arguments: {
            invalidField: 'wrong data',
            // Missing required 'message' field
          },
        },
      }

      try {
        await mcpServer.handleToolCall(request)
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(McpError)
        expect(error.code).toBe(ErrorCode.InvalidParams)
        expect(error.message).toContain('Invalid arguments:')
      }
    })

    it('should re-throw non-ZodError errors', async () => {
      const errorTool = new ErrorThrowingTool()
      mcpServer.registerTool(errorTool)

      const request = {
        params: {
          name: 'error-tool',
          arguments: {
            message: 'test', // Valid arguments, but tool will throw
          },
        },
      }

      try {
        await mcpServer.handleToolCall(request)
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        // Should be the original error, not wrapped in McpError
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Tool execution failed')
        expect(error).not.toBeInstanceOf(McpError)
      }
    })

    it('should throw MethodNotFound for unknown tool', async () => {
      const request = {
        params: {
          name: 'unknown-tool',
          arguments: {},
        },
      }

      try {
        await mcpServer.handleToolCall(request)
        expect.fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(McpError)
        expect(error.code).toBe(ErrorCode.MethodNotFound)
        expect(error.message).toBe(
          'MCP error -32601: Unknown tool: unknown-tool',
        )
      }
    })
  })
})
