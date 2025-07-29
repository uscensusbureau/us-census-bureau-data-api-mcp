import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MCPServer } from '../src/server';

vi.mock("../src/tools/describe-dataset.tool.js", () => ({
  DescribeDatasetTool: vi.fn().mockImplementation(() => ({ name: 'describe-dataset-tool' }))
}));

vi.mock("../src/tools/fetch-dataset-geography.tool.js", () => ({
  FetchDatasetGeographyTool: vi.fn().mockImplementation(() => ({ name: 'fetch-dataset-geography-tool' }))
}));

vi.mock("../src/tools/fetch-dataset-variables.tool.js", () => ({
  FetchDatasetVariablesTool: vi.fn().mockImplementation(() => ({ name: 'fetch-dataset-variables-tool' }))
}));

vi.mock("../src/tools/fetch-summary-table.tool.js", () => ({
  FetchSummaryTableTool: vi.fn().mockImplementation(() => ({ name: 'fetch-summary-table-tool' }))
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({}))
}));


describe("main", () => {
	let serverSpy: ReturnType<typeof vi.spyOn>;
	let connectSpy: ReturnType<typeof vi.spyOn>;


	beforeEach(() => {
    serverSpy = vi.spyOn(MCPServer.prototype, 'registerTool');
    connectSpy = vi.spyOn(MCPServer.prototype, 'connect');

  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    vi.resetModules();
  });

	it("should register tools and connect to the MCP Server", async () => {
		const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    
    await vi.importActual('../src/index.ts');

		expect(serverSpy).toHaveBeenCalledTimes(4);

		expect(serverSpy).toHaveBeenCalledWith({ name: 'describe-dataset-tool' });
    expect(serverSpy).toHaveBeenCalledWith({ name: 'fetch-dataset-geography-tool' });
    expect(serverSpy).toHaveBeenCalledWith({ name: 'fetch-dataset-variables-tool' });
    expect(serverSpy).toHaveBeenCalledWith({ name: 'fetch-summary-table-tool' });

    expect(StdioServerTransport).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it("should handle errors in main function", async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Make one of the operations throw an error
    connectSpy.mockRejectedValueOnce(new Error('Connection failed'));
    
    await vi.importActual('../src/index.ts');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
  });
});