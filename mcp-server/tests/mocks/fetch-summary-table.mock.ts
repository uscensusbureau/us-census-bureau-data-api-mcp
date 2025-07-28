import { Tool } from "@modelcontextprotocol/sdk/types";
import { BaseTool } from "../../src/tools/base.tool";
import { z } from "zod";

export class MockFetchSummaryTableTool extends BaseTool<{ message: string }> {
  name = "fetch-summary-table-mock" as const;
  description = "A test tool for unit testing";
  
  inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Test message"
      }
    },
    required: ["message"]
  } as const;

  get argsSchema() {
    return z.object({
      message: z.string(),
    });
  }

  async handler(args: { message: string }) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Test response: ${args.message}`,
        },
      ],
    };
  }
}