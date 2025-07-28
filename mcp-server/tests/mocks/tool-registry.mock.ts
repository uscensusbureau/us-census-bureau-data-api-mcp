import { z } from "zod";

import { MCPTool } from "../../src/tools/base.tool";
import { StoredMCPTool, ToolContent } from "../../src/types/base.types";

export class MockToolRegistry {
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