const enableDebugLogs = process.env.DEBUG_LOGS === 'true';

if(!enableDebugLogs) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
}

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MCPServer } from "./server.js";

import { DescribeDatasetTool } from "./tools/describe-dataset.tool.js";
import { FetchDatasetGeographyTool } from "./tools/fetch-dataset-geography.tool.js";
import { FetchDatasetVariablesTool } from "./tools/fetch-dataset-variables.tool.js";
import { FetchTableByGroupTool } from "./tools/fetch-table-by-group.tool.js";

// MCP Server Setup
async function main() {
  const mcpServer = new MCPServer("census-api", "0.1.0");

  // Register tools here
  mcpServer.registerTool(new DescribeDatasetTool());
  mcpServer.registerTool(new FetchDatasetGeographyTool());
  mcpServer.registerTool(new FetchDatasetVariablesTool());
  mcpServer.registerTool(new FetchTableByGroupTool());

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log("MCP server started");
}

main().catch(console.error);