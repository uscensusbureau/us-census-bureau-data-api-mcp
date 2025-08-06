import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { MCPTool, ToolRegistry } from './tools/base.tool.js'

export class MCPServer {
  private server: Server
  private registry = new ToolRegistry()

  constructor(name: string, version: string) {
    this.server = new Server({ name, version }, { capabilities: { tools: {} } })
    this.setupHandlers()
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await this.getTools()
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handleToolCall(request)
    })
  }

  async getTools() {
    return {
      tools: this.registry.getAll().map((tool) => ({
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
    const tool = this.registry.get(toolName)

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
    this.registry.register(tool)
  }

  async connect(transport: StdioServerTransport) {
    await this.server.connect(transport)
  }
}
