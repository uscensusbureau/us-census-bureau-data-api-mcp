import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { MCPTool, ToolRegistry } from "../../tools/base.tool.js";

type Tool = {
  name: string,
  description: string,
  inputSchema: Tool["inputSchema"]
}

export class MockMCPServer {
  private server: Server;
  private registry = new ToolRegistry();
  private listToolsHandler: (() => Promise<{ tools: Tool[] }>) | null = null;

  constructor(name: string, version: string) {
    this.server = new Server(
      { name, version },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // Store the handler function so we can call it directly in tests
    this.listToolsHandler = async () => {
      return {
        tools: this.registry.getAll().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    };

    // Set up the actual handler on the server
    this.server.setRequestHandler(ListToolsRequestSchema, this.listToolsHandler);
  }

  registerTool(tool: MCPTool) {
    this.registry.register(tool);
  }

  getRegistry() {
    return this.registry;
  }

  getServer() {
    return this.server;
  }

  // Helper method to simulate a list tools request
  async listTools() {
    if (!this.listToolsHandler) {
      throw new Error("ListToolsRequestSchema handler not initialized");
    }
    
    // Call the handler directly
    return await this.listToolsHandler();
  }
}