import { Tool } from "@modelcontextprotocol/sdk/types";
import { z } from 'zod';

import { BaseTool } from "../../src/tools/base.tool";

export class ErrorThrowingTool extends BaseTool<{ message: string }> {
  name = "error-tool" as const;
  description = "A tool that throws errors";
  
  inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      message: { type: "string", description: "Test message" }
    },
    required: ["message"]
  } as const;

  get argsSchema() {
    return z.object({
      message: z.string(),
    });
  }

  async handler() {
    throw new Error("Tool execution failed");
  }
}