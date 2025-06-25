import { Tool } from "@modelcontextprotocol/sdk/types";
import { TableSchema } from '../../src/schema/summary-table.schema'
import { BaseTool } from "../../src/tools/base.tool";
import { z } from "zod";

export class MockFetchSummaryTableTool extends BaseTool {
  name = "fetch-summary-table-mock";
  description = "A test tool for unit testing";
  
  inputSchema: Tool["inputSchema"] = TableSchema as Tool["inputSchema"];

  argsSchema = z.object({
    message: z.string(),
  });

  async handler(args: z.infer<typeof this.argsSchema>) {
    return this.createSuccessResponse(`Test response: ${args.message}`);
  }
}