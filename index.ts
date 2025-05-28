import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Import tool infrastructure
import { MCPTool, ToolRegistry } from "./tools/base.js";

// Import specific tools
import { FetchDatasetTool } from "./tools/fetch-dataset.js";

// MCP Server class
class MCPServer {
  private server: Server;
  private registry = new ToolRegistry();

  constructor(name: string, version: string) {
    this.server = new Server(
      { name, version },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.registry.getAll().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const tool = this.registry.get(toolName);

      if (!tool) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${toolName}`
        );
      }

      try {
        // Validate arguments using the tool's schema
        const validatedArgs = tool.argsSchema.parse(request.params.arguments);
        
        // Call the tool handler
        return await tool.handler(validatedArgs);
      } catch (err) {
        if (err instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments: ${err.message}`
          );
        }
        throw err;
      }
    });
  }

  registerTool(tool: MCPTool) {
    this.registry.register(tool);
  }

  async connect(transport: StdioServerTransport) {
    await this.server.connect(transport);
  }
}

// MCP Server Setup
async function main() {
  const mcpServer = new MCPServer("census-api", "0.1.0");

  // Register tools here
  mcpServer.registerTool(new FetchDatasetTool());

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log("MCP server started");
}

main().catch(console.error);