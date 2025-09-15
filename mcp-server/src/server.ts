import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { MCPPrompt, PromptRegistry } from './prompts/base.prompt.js'
import { MCPTool, ToolRegistry } from './tools/base.tool.js'

export class MCPServer {
  private server: Server
  private toolRegistry = new ToolRegistry()
  private promptRegistry = new PromptRegistry()

  constructor(name: string, version: string) {
    this.server = new Server(
      { name, version },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      },
    )
    this.setupHandlers()
  }

  private setupHandlers() {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await this.getTools()
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handleToolCall(request)
    })

    // Prompt handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return await this.getPrompts()
    })

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      return await this.handleGetPrompt(request)
    })
  }

  getTools() {
    return {
      tools: this.toolRegistry.getAll().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    }
  }

  async handleToolCall(request: {
    params: { name: string; arguments: unknown }
  }) {
    const toolName = request.params.name
    const tool = this.toolRegistry.get(toolName)

    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`)
    }

    try {
      // Validate arguments using the tool's schema
      const validatedArgs = tool.argsSchema.parse(request.params.arguments)
      // Call the tool handler
      return await tool.handler(validatedArgs)
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid arguments: ${err.message}`,
        )
      }
      throw err
    }
  }

  registerTool<T extends object>(tool: MCPTool<T>) {
    this.toolRegistry.register(tool)
  }

  getPrompts() {
    return {
      prompts: this.promptRegistry.getAll().map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      })),
    }
  }

  async handleGetPrompt(request: {
    params: { name: string; arguments?: unknown }
  }) {
    const promptName = request.params.name
    const prompt = this.promptRegistry.get(promptName)

    if (!prompt) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown prompt: ${promptName}`,
      )
    }

    try {
      // Validate arguments using the prompt's schema if arguments are provided
      const args = request.params.arguments || {}
      const validatedArgs = prompt.argsSchema.parse(args)

      // Call the prompt handler
      const result = await prompt.handler(validatedArgs)

      return {
        description: result.description,
        messages: result.messages,
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid arguments: ${err.message}`,
        )
      }
      throw err
    }
  }

  registerPrompt<T extends object>(prompt: MCPPrompt<T>) {
    this.promptRegistry.register(prompt)
  }

  async connect(transport: StdioServerTransport) {
    await this.server.connect(transport)
  }
}
