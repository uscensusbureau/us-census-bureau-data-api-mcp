import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { SummaryTableSchema } from '../../schema/summary-table.schema.js'
import { BaseTool } from "../../tools/base.tool.js";
import { z } from "zod";

export class MockFetchSummaryTableTool extends BaseTool {
  name = "fetch-summary-table-mock";
  description = "A test tool for unit testing";
  
  inputSchema: Tool["inputSchema"] = SummaryTableSchema as Tool["inputSchema"];

  argsSchema = z.object({
    message: z.string(),
  });

  async handler(args: z.infer<typeof this.argsSchema>) {
    return this.createSuccessResponse(`Test response: ${args.message}`);
  }
}