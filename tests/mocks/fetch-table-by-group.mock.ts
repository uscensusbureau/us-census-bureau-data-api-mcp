import { Tool } from "@modelcontextprotocol/sdk/types";
import { TableSchema } from '../../schema/table-group.schema'
import { BaseTool } from "../../tools/base.tool";
import { z } from "zod";

export class MockFetchTableByGroupTool extends BaseTool {
  name = "fetch-table-by-group-mock";
  description = "A test tool for unit testing";
  
  inputSchema: Tool["inputSchema"] = TableSchema as Tool["inputSchema"];

  argsSchema = z.object({
    message: z.string(),
  });

  async handler(args: z.infer<typeof this.argsSchema>) {
    return this.createSuccessResponse(`Test response: ${args.message}`);
  }
}