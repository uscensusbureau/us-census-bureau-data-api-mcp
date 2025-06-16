# MCP Server for the Census Bureau API
[![License: CC0-1.0](https://img.shields.io/badge/License-CC0%201.0-lightgrey.svg)](https://github.com/uscensusbureau/mcp-server-census-api/blob/main/LICENSE)
[![Build](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/build.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/build.yml)
[![Test](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/test.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/test.yml)
[![ESLint Check](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/lint.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/lint.yml)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server for interacting with the Census Bureau API. This project is built in the [MCP Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Requirements
* A valid Census Bureau [API key](https://api.census.gov/data/key_signup.html)
* Docker (e.g. Docker Desktop)
* Node 16+

## Setup

Run `npm install` to install the project’s dependencies.

Then run `npm run build` to build the project.

With Docker desktop running, run `npm run docker-build` to build the project in Docker.

## Development

By default, all logging functions are disabled to prevent `json` validation errors when interacting with the MCP server through MCP clients. To enable logging for development purposes, set `DEBUG_LOGS=true` when running the server in Docker, e.g. `-e DEBUG_LOGS=true`. 

### Testing

This project uses [Vitest](https://vitest.dev/) to test the functionality of the server.

Prior to running tests, a valid Census Bureau [API key](https://api.census.gov/data/key_signup.html) is required. This key should be defined in the `.env` file of the root directory of the project. The `sample.env` offers an example of how this `.env` file should look.

To run tests, run `npm run test`. To run ESLint, run `npm run lint`.

## Key Concepts

* `index.ts` - Starts the MCP Server and registers tools.
* `server.ts` - Defines the `McpServer` class that handles calls to the server, e.g. how `tools/list` and `tools/calls` respond to requests
* `tools/` - Includes tool definitions and shared classes, e.g. `BaseTool` and `ToolRegistry`, to reduce repetition and exposes the tools list to the server
* `schema/` - Houses each tool’s schema and is used to validate schemas in tests

## Available Methods

The MCP server exposes two methods: `tools/list` and `tools/call`.

## Listing Tools

To list available tools, use the `tools/list` method with no arguments. `tools/list` is a standard method that is often called by LLMs when the client is initialized.

### Example
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
| docker run --rm -i census-api
```

## Available Tools
This section covers tools that can be called.

### Describe Dataset
The `describe-dataset` tool is used for fetching metadata about a given dataset in the Census Bureau’s API. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Optional) - The vintage of the dataset, e.g. `1987`

#### Example
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe-dataset","arguments":{"dataset":"acs/acs1","year":2022}}}' \
| docker run --rm -i -e CENSUS_API_KEY=YOUR_API_KEY census-api
```

### Fetch Dataset Geography
The `fetch-dataset-geography` tool is used for fetching available geography levels for filtering a given dataset. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Optional) - The vintage of the dataset, e.g. `1987`

#### Example
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch-dataset-geography","arguments":{"dataset":"acs/acs1","year":2022}}}' \
| docker run --rm -i -e CENSUS_API_KEY=YOUR_API_KEY census-api
```

### Fetch Dataset Variables
The `fetch-dataset-variables` tool is used for fetching variables for filtering a given dataset. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Group (Optional) - Filter variables by a specific group for this dataset, e.g. `'S0101'`
* Year (Optional) - The vintage of the dataset, e.g. `1987`

#### Example
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch-dataset-variables","arguments":{"dataset":"acs/acs1","year":2022}}}' \
| docker run --rm -i -e CENSUS_API_KEY=YOUR_API_KEY census-api
```

### Fetch Summary Table
The `fetch-summary-table` tool is used for fetching a summary table from the Census Bureau’s API. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Variables (Required) - The required variables for returning a valid response, e.g. `'NAME'`, `'B01001_001E'`
* Year (Optional) - The vintage of the dataset, e.g. `1987`
* For (Optional) - Restricts geography to various levels and is required in most datasets
* In (Optional) - Restricts geography to smaller areas than state level
* Predicates (Optional) - Filter options for the dataset, e.g. `'for': 'state*'`
* Descriptive (Optional) - Add variable labels to API response (default: `false`), e.g. `true`
* Output Format (Optional) - Specificies CSV or JSON output

#### Example
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch-summary-table","arguments":{"dataset":"acs/acs1","year":2022,"variables":["NAME","B01001_001E"],"for":"state:01,13"}}}' \
| docker run --rm -i -e CENSUS_API_KEY=YOUR_API_KEY census-api
```

## Resources
For more information about the parameters above and all available predicates, review the Census Bureau’s [API documentation](https://www.census.gov/data/developers/guidance/api-user-guide.Core_Concepts.html#list-tab-559651575).