import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Tool interface for consistent tool structure
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"];
  argsSchema: z.ZodSchema<any>;
  handler: (args: any) => Promise<{ content: TextContent[] }>;
}

// Abstract base class for tools
export abstract class BaseTool implements MCPTool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: Tool["inputSchema"];
  abstract argsSchema: z.ZodSchema<any>;
  abstract handler(args: any): Promise<{ content: TextContent[] }>;

  // Helper method for error responses
  protected createErrorResponse(message: string): { content: TextContent[] } {
    return {
      content: [
        {
          type: "text",
          text: message,
        },
      ],
    };
  }

  // Helper method for success responses
  protected createSuccessResponse(text: string): { content: TextContent[] } {
    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  }
}

// Tool registry to manage all tools
export class ToolRegistry {
  private tools = new Map<string, MCPTool>();

  register(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  getAll(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  get(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}