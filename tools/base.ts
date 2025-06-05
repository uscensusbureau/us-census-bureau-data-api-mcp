import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { ToolContent } from '../types/base.types.js';

// Tool interface for consistent tool structure
export interface MCPTool<Args extends object = object> {
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"];
  argsSchema: z.ZodSchema<Args, z.ZodTypeDef, Args>;
  handler: (args: Args) => Promise<{ content: ToolContent[] }>;
}

// Type-erased version for storage in registry
interface StoredMCPTool {
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"];
  argsSchema: z.ZodSchema<object, z.ZodTypeDef, object>;
  handler: (args: object) => Promise<{ content: ToolContent[] }>;
}

// Abstract base class for tools
export abstract class BaseTool<Args extends object> implements MCPTool<Args> {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: Tool["inputSchema"];
  abstract get argsSchema(): z.ZodType<Args, z.ZodTypeDef, Args>;
  abstract handler(args: Args): Promise<{ content: ToolContent[] }>;

  // Helper method for error responses
  protected createErrorResponse(message: string): { content: ToolContent[] } {
    return {
      content: [
        {
          type: "text" as const,
          text: message,
        },
      ],
    };
  }

  // Helper method for success responses
  protected createSuccessResponse(text: string): { content: ToolContent[] } {
    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  }
}

// Tool registry to manage all tools
export class ToolRegistry {
  private tools = new Map<string, StoredMCPTool>();

  register<T extends object>(tool: MCPTool<T>): void {
    // Store as type-erased version
    const storedTool: StoredMCPTool = {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      argsSchema: tool.argsSchema as z.ZodSchema<object, z.ZodTypeDef, object>,
      handler: tool.handler as (args: object) => Promise<{ content: ToolContent[] }>
    };
    this.tools.set(tool.name, storedTool);
  }

  getAll(): StoredMCPTool[] {
    return Array.from(this.tools.values());
  }

  get(name: string): StoredMCPTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
 