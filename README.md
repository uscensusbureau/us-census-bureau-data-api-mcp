# MCP Server for the Census Bureau API
[![License: CC0-1.0](https://img.shields.io/badge/License-CC0%201.0-lightgrey.svg)](https://github.com/uscensusbureau/mcp-server-census-api/blob/main/LICENSE)
[![Build](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/build.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/build.yml)
[![Test](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/test.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/test.yml)
[![ESLint Check](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/lint.yml/badge.svg)](https://github.com/uscensusbureau/mcp-server-census-api/actions/workflows/lint.yml)

A model context protocol (MCP) server for interacting with the Census Bureau API. This library uses stdio for connections to the server.

## Requirements
* A valid Census Bureau [API key](https://api.census.gov/data/key_signup.html)
* Docker
* Node 16+

## Setup

Run `npm install` to install the project’s dependencies.

Then run `npm run build` to build the project.

With Docker desktop running, run `npm run docker-build` to build the project in Docker.

### Testing

This project uses [Vitest](https://vitest.dev/) to test the functionality of the server.

To run tests, run `npm run test`. To run ESLint, run `npm run lint`.

## Key Concepts

* `index.ts` - Starts the MCP Server and registers tools.
* `server.ts` - Defines the `McpServer` class that handles calls to the server, e.g. how `tools/list` and `tools/calls` respond to requests
* `tools/` - Includes tool definitions and shared classes, e.g. `BaseTool` and `ToolRegistry`, to reduce repetition and exposes the tools list to the server
* `schema/` - Houses each tool’s schema and is used to validate schemas in tests

## Available Methods

The MCP server exposes two methods: `tools/list` and `tools/call`.

## Listing Tools

To list available tools, use the `tools/list` method with no arguments.

### Example
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
| docker run --rm -i census-api
```

## Available Tools
This section covers tools that can be called.

### Describe Dataset
The `describe-dataset` tool is used for fetching metadata about a given dataset in the Census Bureau’s API. It accepts the following arguments:
* Year (Required) - The vintage of the dataset, e.g. 1987
* Dataset (Required) - The identifier of the dataset, e.g. "acs/acs1"
* Type (Optional) - The type of metadata to fetch, e.g. "geography", "variables", "sorts", "groups", "tags", and "examples". Leaving this blank will return generalized metadata about the dataset.

#### Example
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe-dataset","arguments":{"dataset":"acs/acs1","year":2022}}}' \
| docker run --rm -i -e CENSUS_API_KEY=YOUR_API_KEY census-api
```

### Fetch Summary Table
The `fetch-summary-table` tool is used for fetching a summary table from the Census Bureau’s API. It accepts the following arguments:
* Year (Required) - The vintage of the dataset, e.g. 1987
* Dataset (Required) - The identifier of the dataset, e.g. "acs/acs1"
* Variables (Required) - The required variables for returning a valid response, e.g. "NAME", "B01001_001E"
* For (Optional) - Restricts geography to various levels and is required in most datasets
* In (Optional) - Restricts geography to smaller areas than state level
* Predicates (Optional) - Filter options for the dataset, e.g. "for": "state*"
* Descriptive (Optional) - Add variable labels to API response
* Output Format (Optional) - Specificies CSV or JSON output

#### Example
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch-summary-table","arguments":{"dataset":"acs/acs1","year":2022,"variables":["NAME","B01001_001E"],"for":"state:01,13"}}}' \
| docker run --rm -i -e CENSUS_API_KEY=YOUR_API_KEY census-api
```

## Resources
For more information about the parameters above and all available predicates, review the Census Bureau’s [API documentation](https://www.census.gov/data/developers/guidance/api-user-guide.Core_Concepts.html#list-tab-559651575).