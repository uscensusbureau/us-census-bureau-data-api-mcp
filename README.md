# MCP Server for the Census Bureau API
[![License: CC0-1.0](https://img.shields.io/badge/License-CC0%201.0-lightgrey.svg)](https://github.com/uscensusbureau/mcp-server-census-api/blob/main/LICENSE)
[![MCP Project Build](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/build.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/build.yml)
[![MCP Server - Tests](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/test.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/test.yml)
[![MCP Database - Tests](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/test-db.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/test-db.yml)
[![MCP Server - Lint](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/lint.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/lint.yml)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server for interacting with the Census Bureau API. This project is built in the [MCP Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Requirements
* A valid Census Bureau [API key](https://api.census.gov/data/key_signup.html)
* Docker (i.e. Docker Desktop)
* Node 18+

## Using the MCP Server

After saving the project locally and installing the requirements above, configure your LLM Client to leverage the Census API MCP Server via your LLM Client’s configuration file. The syntax for the configuration file may vary by LLM. Here is an example configuration file that includes the appropriate scripts for launching the server:

```
{
  "mcpServers": {
    "mcp-census-api": {
      "command": "bash",
      "args": [
        "/Path/To/Server/mcp-server-census-api/scripts/mcp-connect.sh"
      ],
      "env": {
        "CENSUS_API_KEY": "YOUR_CENSUS_API_KEY"
      }
    }
  }
}
```

Note that the `CENSUS_API_KEY` variable is required. This defines the `env` variable in the Client and passes it to the MCP server via the `mcp-connect` script.

Be sure to update the path to the `mcp-server-census-api` in `args` and update the `CENSUS_API_KEY` to a valid API key.

## Development

Run `docker compose --profile dev up` from the root of the project to build the containers.

By default, all logging functions are disabled in the `mcp-server` to prevent `json` validation errors when interacting with the MCP server through MCP clients. To enable logging for development purposes, set `DEBUG_LOGS=true` when interacting with the server directly using the examples below, e.g. `echo '{CALL_ARGUMENTS}' docker exec -e DEBUG_LOGS=true -i mcp-server node dist/index.js`. 

### Testing

This project uses [Vitest](https://vitest.dev/) to test the MCP Server and MCP Database.

#### MCP Server Testing

Prior to running the MCP Server tests, a valid Census Bureau [API key](https://api.census.gov/data/key_signup.html) is required. This key should be defined in the `.env` file of the `mcp-server` directory. The `sample.env` offers an example of how this `.env` file should look.

To run tests, navigate to the `mcp-server/` directory and run `npm run test`. To run ESLint, run `npm run lint` from the same directory.

#### MCP Database Testing

A `.env` file needs to be created in the `mcp-db/` directory with a valid `DATABASE_URL` variable defined. The `sample.env` in the same directory includes the default value.

To run tests, navigate to the `mcp-db/` directoruy and run `npm run test:db`.

## MCP Server Architecture

* `docker-compose` - Organizes the project into different containers.
* `mcp-server` - Source code for the MCP Server.
* `mcp-server/index.ts` - Starts the MCP Server and registers tools.
* `mcp-server/server.ts` - Defines the `McpServer` class that handles calls to the server, e.g. how `tools/list` and `tools/calls` respond to requests
* `mcp-server/tools/` - Includes tool definitions and shared classes, e.g. `BaseTool` and `ToolRegistry`, to reduce repetition and exposes the tools list to the server
* `mcp-server/schema/` - Houses each tool’s schema and is used to validate schemas in tests

## Available Methods

The MCP server exposes two methods: `tools/list` and `tools/call`.

## Listing Tools

To list available tools, use the `tools/list` method with no arguments. `tools/list` is a standard method that is often called by LLMs when the client is initialized.

#### How to Run via CLI
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | docker exec -i mcp-server node dist/index.js
```

## Available Tools
This section covers tools that can be called.

### Describe Dataset
The `describe-dataset` tool is used for fetching metadata about a given dataset in the Census Bureau’s API. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Optional) - The vintage of the dataset, e.g. `1987`

#### How to Run via CLI
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe-dataset","arguments":{"dataset":"acs/acs1","year":2022}}}' \
| docker exec -i mcp-server node dist/index.js
```

### Fetch Dataset Geography
The `fetch-dataset-geography` tool is used for fetching available geography levels for filtering a given dataset. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Optional) - The vintage of the dataset, e.g. `1987`

#### How to Run via CLI
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch-dataset-geography","arguments":{"dataset":"acs/acs1","year":2022}}}' \
| docker exec -i mcp-server node dist/index.js
```

### Fetch Dataset Variables
The `fetch-dataset-variables` tool is used for fetching variables for filtering a given dataset. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Group (Optional) - Filter variables by a specific group for this dataset, e.g. `'S0101'`
* Year (Optional) - The vintage of the dataset, e.g. `1987`

#### How to Run via CLI
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch-dataset-variables","arguments":{"dataset":"acs/acs1","year":2022}}}' \
| docker exec -i mcp-server node dist/index.js
```

### Fetch Summary Table
The `fetch-summary-table` tool is used for fetching a summary table from the Census Bureau’s API. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Required) - The vintage of the dataset, e.g. `1987`
* Get (Required) - An object that is required that accepts 2 optional arguments:
	* Variables (optional) - An array of variables for filtering responses by attributes and rows, e.g. `'NAME'`, `'B01001_001E'`
	* Group (optional) - A string that returns a larger collecton of variables, e.g. `S0101`
* For (Optional) - A string that testricts geography to various levels and is required in most datasets
* In (Optional) - A string that restricts geography to smaller areas than state level
* UCGID (Optional) - A string that restricts geography by Uniform Census Geography Identifier (UCGID), e.g. `0400000US41`
* Predicates (Optional) - Filter options for the dataset, e.g. `'for': 'state*'`
* Descriptive (Optional) - Adds variable labels to API response (default: `false`), e.g. `true`

#### How to Run via CLI
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch-summary-table","arguments":{"dataset":"acs/acs1","year":2022, "get": { "variables":["NAME","B01001_001E"] },"for":"state:01,13"}}}' \
| docker exec -i mcp-server node dist/index.js
```

## Resources
For more information about the parameters above and all available predicates, review the Census Bureau’s [API documentation](https://www.census.gov/data/developers/guidance/api-user-guide.Core_Concepts.html#list-tab-559651575).