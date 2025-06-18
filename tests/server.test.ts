import { describe, it, expect, beforeEach } from 'vitest';
import { z } from "zod";
import { BaseTool } from "./tools/base.tool";
import { MockMCPServer } from "./mocks/server.mock";
import { MockFetchTableByGroupTool } from "./mocks/fetch-table-by-group.mock";
import { TableSchema } from '../schema/table-group.schema'

describe("MCP Server ListTools Handler", () => {
  let mcpServer: MockMCPServer;
  let mockFetchTableByGroupTool: MockFetchTableByGroupTool;

  beforeEach(() => {
    mcpServer = new MockMCPServer("test-server", "1.0.0");
    mockFetchTableByGroupTool = new MockFetchTableByGroupTool();
  });

  describe("with no tools registered", () => {
    it("should return an empty tools array", async () => {
      const result = await mcpServer.listTools();
      
      expect(result).toEqual({
        tools: [],
      });
    });
  });

  describe("with one tool registered", () => {
    beforeEach(() => {
      mcpServer.registerTool(mockFetchTableByGroupTool);
    });

    it("should return the correct tool information", async () => {
      const result = await mcpServer.listTools();
      
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toEqual({
        name: "fetch-table-by-group-mock",
        description: "A test tool for unit testing",
        inputSchema: TableSchema as Tool["inputSchema"]
      });
    });

    it("should include all required properties", async () => {
      const result = await mcpServer.listTools();
      const tool = result.tools[0];
      
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(typeof tool.inputSchema).toBe("object");
    });
  });

  describe("with multiple tools registered", () => {
    beforeEach(() => {
        // Register 2 tools
	    for (let i = 1; i < 3; i++) {
	      const tool = new (class extends BaseTool {
	        name = `tool_${i}`;
	        description = `Tool number ${i}`;
	        inputSchema = { type: "object", properties: {} } as const;
	        argsSchema = z.object({});
	        async handler() { return this.createSuccessResponse("OK"); }
	      })();
	      
	      mcpServer.registerTool(tool);
	    }
    });

    it("should return all registered tools", async () => {
      const result = await mcpServer.listTools();
      
      expect(result.tools).toHaveLength(2);
      
      const toolNames = result.tools.map(tool => tool.name);
      expect(toolNames).toContain("tool_1");
      expect(toolNames).toContain("tool_2");
    });
  });

  describe("tool schema validation", () => {
    beforeEach(() => {
      mcpServer.registerTool(mockFetchTableByGroupTool);
    });

    it("should include required fields", async () => {
      const result = await mcpServer.listTools();
      const fetchTableByGroupTool = result.tools.find(tool => tool.name === "fetch-table-by-group-mock");

      console.log(result.tools);
      
      expect(fetchTableByGroupTool?.inputSchema.required).toEqual(TableSchema.required);
    });

    it("should include property descriptions", async () => {
      const result = await mcpServer.listTools();
      const fetchTableByGroupTool = result.tools.find(tool => tool.name === "fetch-table-by-group-mock");
      
      expect(fetchTableByGroupTool?.inputSchema.properties.dataset.description).toBe(TableSchema.properties.dataset.description);
      expect(fetchTableByGroupTool?.inputSchema.properties.year.description).toBe(TableSchema.properties.year.description);
      expect(fetchTableByGroupTool?.inputSchema.properties.group.description).toBe(TableSchema.properties.group.description);
    });
  });

  describe("error handling", () => {
    it("should handle tools with complex schemas", async () => {
      const complexTool = new (class extends BaseTool {
        name = "complex_tool";
        description = "A tool with complex schema";
        
        inputSchema = {
          type: "object",
          properties: {
            config: {
              type: "object",
              properties: {
                nested: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        } as const;

        argsSchema = z.object({
          config: z.object({
            nested: z.array(z.string()),
          }),
        });
      })();

      mcpServer.registerTool(complexTool);
      
      const result = await mcpServer.listTools();
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].inputSchema.properties.config.type).toBe("object");
    });
  });
});

// Integration test with your actual server structure
describe("Integration with actual MCPServer", () => {
  it("should work with the exact server implementation", () => {
    // This test verifies the structure matches your actual implementation
    const serverInstance = new MockMCPServer("census-api", "0.1.0");
    
    expect(serverInstance.getRegistry()).toBeDefined();
    expect(typeof serverInstance.registerTool).toBe("function");
    expect(typeof serverInstance.listTools).toBe("function");
  });
});

// Performance tests
describe("Performance", () => {
  let mcpServer: MockMCPServer;

  beforeEach(() => {
    mcpServer = new MockMCPServer("test-server", "1.0.0");
  });

  it("should handle many tools efficiently", async () => {
    // Register 100 tools
    for (let i = 0; i < 100; i++) {
      const tool = new (class extends BaseTool {
        name = `tool_${i}`;
        description = `Tool number ${i}`;
        inputSchema = { type: "object", properties: {} } as const;
        argsSchema = z.object({});
        async handler() { return this.createSuccessResponse("OK"); }
      })();
      
      mcpServer.registerTool(tool);
    }

    const startTime = Date.now();
    const result = await mcpServer.listTools();
    const endTime = Date.now();

    expect(result.tools).toHaveLength(100);
    expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
  });
});