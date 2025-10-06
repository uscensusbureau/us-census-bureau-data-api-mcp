import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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

// Import the original MCP server
import { MCPServer as CensusMCPServer } from './server.js'

const app = express()
app.use(express.json())
app.use(cors({
  origin: [
    'https://claude.ai',
    'http://localhost:3000',
    'http://localhost:8080'
  ]
}))

// Create MCP server instance
const mcpServer = new CensusMCPServer('census-api', '1.0.0')

// Register tools
mcpServer.registerTool(new ListDatasetsTool())
mcpServer.registerTool(new FetchDatasetGeographyTool())
mcpServer.registerTool(new FetchAggregateDataTool())
mcpServer.registerTool(new ResolveGeographyFipsTool())

// Register prompts
mcpServer.registerPrompt(new PopulationPrompt())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'census-mcp',
    transport: 'http',
    version: '1.0.0'
  })
})

// Info endpoint
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

// MCP endpoint - simplified HTTP handler
app.post('/mcp', async (req, res) => {
  try {
    const { method, params } = req.body

    let result
    switch (method) {
      case 'tools/list':
        result = mcpServer.getTools()
        break

      case 'tools/call':
        const toolCallRequest = CallToolRequestSchema.parse({ method, params })
        result = await mcpServer.handleToolCall({ params: toolCallRequest.params })
        break

      case 'prompts/list':
        result = mcpServer.getPrompts()
        break

      case 'prompts/get':
        const promptGetRequest = GetPromptRequestSchema.parse({ method, params })
        result = await mcpServer.handleGetPrompt({ params: promptGetRequest.params })
        break

      default:
        return res.status(400).json({
          error: `Unknown method: ${method}`
        })
    }

    res.json(result)
  } catch (error) {
    console.error('MCP request error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})

// SSE endpoint for streaming responses
app.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`)

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`)
  }, 30000)

  req.on('close', () => {
    clearInterval(keepAlive)
  })
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.error(`Census MCP HTTP Server started on port ${PORT}`)
  console.error(`HTTP endpoint: http://localhost:${PORT}/mcp`)
  console.error(`SSE endpoint: http://localhost:${PORT}/sse`)
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