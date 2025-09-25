import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { ToolContent } from '../types/base.types.js'

export interface MCPTool<Args extends object = object> {
  name: string
  description: string
  inputSchema: Tool['inputSchema']
  argsSchema: z.ZodSchema<Args, z.ZodTypeDef, Args>
  handler: (args: Args) => Promise<{ content: ToolContent[] }>
}

interface StoredMCPTool {
  name: string
  description: string
  inputSchema: Tool['inputSchema']
  argsSchema: z.ZodSchema<object, z.ZodTypeDef, object>
  handler: (args: object) => Promise<{ content: ToolContent[] }>
}

export abstract class BaseTool<Args extends object> implements MCPTool<Args> {
  abstract name: string
  abstract description: string
  abstract inputSchema: Tool['inputSchema']
  abstract get argsSchema(): z.ZodType<Args, z.ZodTypeDef, Args>
  protected abstract toolHandler(
    args: Args,
    apiKey?: string,
  ): Promise<{ content: ToolContent[] }>
  abstract readonly requiresApiKey: boolean

  async handler(args: Args): Promise<{ content: ToolContent[] }> {
    try {
      let apiKey: string | undefined

      // Only check for API key if the tool requires it
      if (this.requiresApiKey) {
        apiKey = process.env.CENSUS_API_KEY

        if (!apiKey) {
          return this.createErrorResponse('Error: CENSUS_API_KEY is not set.')
        }
      }

      return await this.toolHandler(args, apiKey)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return this.createErrorResponse(`Unexpected error: ${errorMessage}`)
    }
  }

  protected createErrorResponse(message: string): { content: ToolContent[] } {
    return {
      content: [
        {
          type: 'text' as const,
          text: message,
        },
      ],
    }
  }

  protected createSuccessResponse(text: string): { content: ToolContent[] } {
    return {
      content: [
        {
          type: 'text' as const,
          text,
        },
      ],
    }
  }
}

export class ToolRegistry {
  private tools = new Map<string, StoredMCPTool>()

  register<T extends object>(tool: MCPTool<T>): void {
    // Store as type-erased version
    const storedTool: StoredMCPTool = {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      argsSchema: tool.argsSchema as z.ZodSchema<object, z.ZodTypeDef, object>,
      handler: tool.handler as (
        args: object,
      ) => Promise<{ content: ToolContent[] }>,
    }
    this.tools.set(tool.name, storedTool)
  }

  getAll(): StoredMCPTool[] {
    return Array.from(this.tools.values())
  }

  get(name: string): StoredMCPTool | undefined {
    return this.tools.get(name)
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }
}
