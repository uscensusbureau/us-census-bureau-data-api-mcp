const enableDebugLogs = process.env.DEBUG_LOGS === 'true'

if (!enableDebugLogs) {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
}

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { MCPServer } from './server.js'

import { DescribeDatasetTool } from './tools/describe-dataset.tool.js'
import { FetchDatasetGeographyTool } from './tools/fetch-dataset-geography.tool.js'
import { FetchDatasetVariablesTool } from './tools/fetch-dataset-variables.tool.js'
import { FetchSummaryTableTool } from './tools/fetch-summary-table.tool.js'

// MCP Server Setup
async function main() {
  const mcpServer = new MCPServer('census-api', '0.1.0')

  // Register tools here
  mcpServer.registerTool(new DescribeDatasetTool())
  mcpServer.registerTool(new FetchDatasetGeographyTool())
  mcpServer.registerTool(new FetchDatasetVariablesTool())
  mcpServer.registerTool(new FetchSummaryTableTool())

  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)
}

main().catch(console.error)
