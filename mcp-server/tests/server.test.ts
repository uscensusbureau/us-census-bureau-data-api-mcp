import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest'
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { MCPServer } from '../src/server'
import { ToolRegistry } from '../src/tools/base.tool'
import { PromptRegistry } from '../src/prompts/base.prompt'
import { ErrorThrowingTool, MockFetchSummaryTableTool } from './mocks/tool.mock'
import { MockTestPrompt, ErrorThrowingPrompt } from './mocks/prompt.mock'

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
  let mockTestPrompt: MockTestPrompt
  let connectSpy: ReturnType<typeof vi.spyOn>
  let toolGetAllSpy: ReturnType<typeof vi.spyOn>
  let toolRegistrySpy: ReturnType<typeof vi.spyOn>
  let promptGetAllSpy: ReturnType<typeof vi.spyOn>
  let promptRegistrySpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    connectSpy = vi.spyOn(Server.prototype, 'connect')
    toolGetAllSpy = vi.spyOn(ToolRegistry.prototype, 'getAll')
    toolRegistrySpy = vi.spyOn(ToolRegistry.prototype, 'register')
    promptGetAllSpy = vi.spyOn(PromptRegistry.prototype, 'getAll')
    promptRegistrySpy = vi.spyOn(PromptRegistry.prototype, 'register')
    mcpServer = new MCPServer('test-server', '1.0.0')
    mockFetchSummaryTableTool = new MockFetchSummaryTableTool()
    mockTestPrompt = new MockTestPrompt()
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

  describe('Tool functionality', () => {
    describe('registerTool', () => {
      it('should register tools successfully', () => {
        mcpServer.registerTool(mockFetchSummaryTableTool)

        expect(toolRegistrySpy).toHaveBeenCalledOnce()
        expect(toolRegistrySpy).toHaveBeenCalledWith(mockFetchSummaryTableTool)
      })

      it('should store registered tools in registry', () => {
        const tool1 = mockFetchSummaryTableTool
        const tool2 = new MockFetchSummaryTableTool()

        mcpServer.registerTool(tool1)
        mcpServer.registerTool(tool2)

        expect(toolRegistrySpy).toHaveBeenCalledTimes(2)
        expect(toolRegistrySpy).toHaveBeenNthCalledWith(1, tool1)
        expect(toolRegistrySpy).toHaveBeenNthCalledWith(2, tool2)
      })
    })

    describe('getTools', () => {
      beforeEach(() => {
        mcpServer.registerTool(mockFetchSummaryTableTool)
      })

      it('should successfully call tool registry getAll', () => {
        mcpServer.getTools()
        expect(toolGetAllSpy).toHaveBeenCalledTimes(1)
      })

      it('should return tools in correct format', () => {
        const result = mcpServer.getTools()
        expect(result).toEqual({
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'fetch-summary-table-mock',
              description: expect.any(String),
              inputSchema: expect.any(Object),
            }),
          ]),
        })
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

  describe('Prompt functionality', () => {
    describe('registerPrompt', () => {
      it('should register prompts successfully', () => {
        mcpServer.registerPrompt(mockTestPrompt)

        expect(promptRegistrySpy).toHaveBeenCalledOnce()
        expect(promptRegistrySpy).toHaveBeenCalledWith(mockTestPrompt)
      })

      it('should store registered prompts in registry with different names', () => {
        const prompt1 = mockTestPrompt
        const prompt2 = new ErrorThrowingPrompt()

        mcpServer.registerPrompt(prompt1)
        mcpServer.registerPrompt(prompt2)

        expect(promptRegistrySpy).toHaveBeenCalledTimes(2)
        expect(promptRegistrySpy).toHaveBeenNthCalledWith(1, prompt1)
        expect(promptRegistrySpy).toHaveBeenNthCalledWith(2, prompt2)
      })
    })

    describe('getPrompts', () => {
      beforeEach(() => {
        mcpServer.registerPrompt(mockTestPrompt)
      })

      it('should successfully call prompt registry getAll', () => {
        mcpServer.getPrompts()
        expect(promptGetAllSpy).toHaveBeenCalledTimes(1)
      })

      it('should return prompts in correct format', () => {
        const result = mcpServer.getPrompts()
        expect(result).toEqual({
          prompts: expect.arrayContaining([
            expect.objectContaining({
              name: 'test-prompt-mock',
              description: expect.any(String),
              arguments: expect.any(Array),
            }),
          ]),
        })
      })
    })

    describe('handleGetPrompt', () => {
      beforeEach(() => {
        mcpServer.registerPrompt(mockTestPrompt)
      })

      it('should successfully execute prompt with valid arguments', async () => {
        const request = {
          params: {
            name: 'test-prompt-mock',
            arguments: {
              message: 'test message',
            },
          },
        }

        const result = await mcpServer.handleGetPrompt(request)
        expect(result).toBeDefined()
        expect(result.description).toBeDefined()
        expect(result.messages).toBeDefined()
        expect(Array.isArray(result.messages)).toBe(true)
      })

      it('should execute prompt with no arguments when none provided', async () => {
        const request = {
          params: {
            name: 'test-prompt-mock',
          },
        }

        const result = await mcpServer.handleGetPrompt(request)
        expect(result).toBeDefined()
        expect(result.description).toBeDefined()
        expect(result.messages).toBeDefined()
      })

      it('should execute prompt with empty arguments object', async () => {
        const request = {
          params: {
            name: 'test-prompt-mock',
            arguments: {},
          },
        }

        const result = await mcpServer.handleGetPrompt(request)
        expect(result).toBeDefined()
        expect(result.description).toBeDefined()
        expect(result.messages).toBeDefined()
      })

      it('should throw InvalidParams for invalid arguments (ZodError)', async () => {
        const request = {
          params: {
            name: 'test-prompt-mock',
            arguments: {
              invalidField: 'wrong data',
              message: 123, // Invalid type
            },
          },
        }

        try {
          await mcpServer.handleGetPrompt(request)
          expect.fail('Expected an error to be thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(McpError)
          expect(error.code).toBe(ErrorCode.InvalidParams)
          expect(error.message).toContain('Invalid arguments:')
        }
      })

      it('should re-throw non-ZodError errors', async () => {
        const errorPrompt = new ErrorThrowingPrompt()
        mcpServer.registerPrompt(errorPrompt)

        const request = {
          params: {
            name: 'error-prompt',
            arguments: {
              message: 'test', // Valid arguments, but prompt will throw
            },
          },
        }

        try {
          await mcpServer.handleGetPrompt(request)
          expect.fail('Expected an error to be thrown')
        } catch (error) {
          // Should be the original error, not wrapped in McpError
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toContain('Prompt execution failed')
          expect(error).not.toBeInstanceOf(McpError)
        }
      })

      it('should throw MethodNotFound for unknown prompt', async () => {
        const request = {
          params: {
            name: 'unknown-prompt',
            arguments: {},
          },
        }

        try {
          await mcpServer.handleGetPrompt(request)
          expect.fail('Expected an error to be thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(McpError)
          expect(error.code).toBe(ErrorCode.MethodNotFound)
          expect(error.message).toBe(
            'MCP error -32601: Unknown prompt: unknown-prompt',
          )
        }
      })
    })
  })

  describe('Integration tests', () => {
    it('should handle both tools and prompts in the same server', async () => {
      // Register both
      mcpServer.registerTool(mockFetchSummaryTableTool)
      mcpServer.registerPrompt(mockTestPrompt)

      // Test tools
      const toolsResult = mcpServer.getTools()
      expect(toolsResult.tools).toHaveLength(1)

      // Test prompts
      const promptsResult = mcpServer.getPrompts()
      expect(promptsResult.prompts).toHaveLength(1)

      // Test tool execution
      const toolRequest = {
        params: {
          name: 'fetch-summary-table-mock',
          arguments: { message: 'test' },
        },
      }
      const toolResult = await mcpServer.handleToolCall(toolRequest)
      expect(toolResult).toBeDefined()

      // Test prompt execution
      const promptRequest = {
        params: {
          name: 'test-prompt-mock',
          arguments: { message: 'test' },
        },
      }
      const promptResult = await mcpServer.handleGetPrompt(promptRequest)
      expect(promptResult).toBeDefined()
    })
  })
})
