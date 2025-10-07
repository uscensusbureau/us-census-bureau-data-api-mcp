import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js'

// Load environment variables
dotenv.config()

const enableDebugLogs = process.env.DEBUG_LOGS === 'true'

if (!enableDebugLogs) {
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
}

// Import tools and prompts
import { ListDatasetsTool } from './tools/list-datasets.tool.js'
import { FetchDatasetGeographyTool } from './tools/fetch-dataset-geography.tool.js'
import { FetchAggregateDataTool } from './tools/fetch-aggregate-data.tool.js'
import { ResolveGeographyFipsTool } from './tools/resolve-geography-fips.tool.js'
import { PopulationPrompt } from './prompts/population.prompt.js'

// Create Express app
const app = express()
app.use(express.json())
app.use(cors({
  origin: '*' // Allow all origins for Claude.ai
}))

// Create MCP server with proper configuration
const mcpServer = new MCPServer(
  {
    name: 'census-api-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      prompts: {}
    }
  }
)

// Create tool instances
const listDatasetsTool = new ListDatasetsTool()
const fetchGeographyTool = new FetchDatasetGeographyTool()
const fetchAggregateDataTool = new FetchAggregateDataTool()
const resolveFipsTool = new ResolveGeographyFipsTool()

// Register tools with MCP server
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: listDatasetsTool.name,
      description: listDatasetsTool.description,
      inputSchema: listDatasetsTool.inputSchema
    },
    {
      name: fetchGeographyTool.name,
      description: fetchGeographyTool.description,
      inputSchema: fetchGeographyTool.inputSchema
    },
    {
      name: fetchAggregateDataTool.name,
      description: fetchAggregateDataTool.description,
      inputSchema: fetchAggregateDataTool.inputSchema
    },
    {
      name: resolveFipsTool.name,
      description: resolveFipsTool.description,
      inputSchema: resolveFipsTool.inputSchema
    }
  ]
}))

// Handle tool calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case listDatasetsTool.name:
      return await listDatasetsTool.handler(args || {})
    case fetchGeographyTool.name:
      return await fetchGeographyTool.handler(args as any || {})
    case fetchAggregateDataTool.name:
      return await fetchAggregateDataTool.handler(args as any || {})
    case resolveFipsTool.name:
      return await resolveFipsTool.handler(args as any || {})
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
})

// Create prompt instance
const populationPrompt = new PopulationPrompt()

// Register prompts with MCP server
mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: populationPrompt.name,
      description: populationPrompt.description,
      arguments: populationPrompt.arguments
    }
  ]
}))

// Handle prompt requests
mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === populationPrompt.name) {
    const promptArgs = {
      geography_name: (args as any)?.geography_name || ''
    }
    const result = await populationPrompt.handler(promptArgs)

    if (result.messages && result.messages.length > 0) {
      return result
    }

    return {
      messages: [{
        role: 'assistant',
        content: {
          type: 'text',
          text: 'Unable to retrieve population data'
        }
      }]
    }
  }

  throw new Error(`Unknown prompt: ${name}`)
})

// Create transport with proper configuration for stateless mode
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless mode for Claude.ai
  enableJsonResponse: false // Use SSE for streaming
})

// Connect the server to transport
mcpServer.connect(transport)

// Handle MCP requests
app.all('/mcp', async (req, res) => {
  await transport.handleRequest(req, res, req.body)
})

// Add health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'census-mcp',
    transport: 'streamable-http',
    version: '1.0.0'
  })
})

// Add info endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'US Census Bureau Data API MCP Server',
    description: 'MCP server providing access to US Census data',
    version: '1.0.0',
    endpoints: {
      mcp: '/mcp',
      health: '/health'
    },
    tools: [
      'list-datasets',
      'fetch-dataset-geography',
      'fetch-aggregate-data',
      'resolve-geography-fips'
    ],
    prompts: [
      'get_population_data'
    ]
  })
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.error(`Census MCP Streamable HTTP Server started on port ${PORT}`)
  console.error(`MCP endpoint: http://localhost:${PORT}/mcp`)
  console.error(`Health check: http://localhost:${PORT}/health`)
})

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})