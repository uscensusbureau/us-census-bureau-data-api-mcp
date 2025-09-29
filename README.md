# U.S. Census Bureau Data API MCP
[![License: CC0-1.0](https://img.shields.io/badge/License-CC0%201.0-lightgrey.svg)](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/blob/main/LICENSE)
[![MCP Project Build](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/actions/workflows/build.yml)
[![MCP Project - Lint](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/actions/workflows/lint.yml/badge.svg)](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/actions/workflows/lint.yml)
[![MCP Server - Tests](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/actions/workflows/test.yml)
[![MCP Database - Tests](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/actions/workflows/test-db.yml/badge.svg)](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/actions/workflows/test-db.yml)
![MCP Server - Test Coverage](https://raw.githubusercontent.com/gist/luke-keller-census/0589e2c69696f077eef7d6af818a108b/raw/badge.svg)
![MCP Database - Test Coverage](https://raw.githubusercontent.com/gist/luke-keller-census/ae50d82d94893c2e674f7f742aea958e/raw/badge.svg)

Bringing _official_ Census Bureau statistics to AI assistants everywhere.

The *U.S. Census Bureau Data API MCP* is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that connects AI assistants with data from the Census Data API and other official Census Bureau sources. This project is built using the [MCP Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Contents
* [Getting Started](#getting-started)
* [Using the MCP Server](#using-the-mcp-server)
* [How the MCP Server Works](#how-the-mcp-server-works)
* [Development](#development)
* [MCP Server Architecture](#mcp-server-architecture)
* [Available Methods](#available-methods)
* [Available Tools](#available-tools)
* [Available Prompts](#available-prompts)
* [Additional Information](#additional-information)

## Getting Started
To get started, you will need:

* A valid Census Bureau [Data API key](https://api.census.gov/data/key_signup.html)
* Docker (i.e. Docker Desktop)
* Node 18+

## Using the MCP Server
To use the U.S. Census Bureau Data API MCP server:
1. Clone or download the project locally.
2. In a terminal window, navigate to the project’s root directory and run `docker compose --profile prod run --rm census-mcp-db-init sh -c "npm run migrate:up && npm run seed"` to pull data from the Census Data API into the local database. *This is only required on first-time setup.*
3. Configure your AI Assistant to use the MCP Server (see below).
4. Start your AI Assistant.

Here is an example configuration file that includes the appropriate scripts for launching the MCP Server:

```
{
  "mcpServers": {
    "mcp-census-api": {
      "command": "bash",
      "args": [
        "/Path/To/Server/us-census-bureau-data-api-mcp/scripts/mcp-connect.sh"
      ],
      "env": {
        "CENSUS_API_KEY": "YOUR_CENSUS_API_KEY"
      }
    }
  }
}
```

Note that the `CENSUS_API_KEY` variable is required. This defines the `env` variable in the MCP Client and passes it to the MCP server via the `mcp-connect` script.

Be sure to update the path to the `us-census-bureau-data-api-mcp` directory in `args` and provide a valid `CENSUS_API_KEY`.

### Updating the MCP Server
When a new version of this project is released, you will need to rebuild the production environment for the latest features. From the `mcp-db/` directory, run the following:

```
npm run prod:down
npm run prod:build
```

After that, you can relaunch your MCP Client and it should connect to the server again.

## How the MCP Server Works

The U.S. Census Bureau Data API MCP server uses data from the Census Data API and other official sources to construct contextually rich data and statistics for use with AI Assistants. The Census Data API is the primary source of data but some of the API's data is pulled down to a local postgres container to enable more robust and performant search functionality. Below is an illustration of how user prompts are processed by AI Assistants and the MCP Server.

![Illustration of how the MCP Server works, starting with a user prompt, processing by an AI Assistant, tool or resource calls to the U.S. Census Bureau Data API MCP server, and finally queries to the local postgres database or the Census Data API.](/us-census-burea-mcp-server-flow.jpg)

## Development

Run `docker compose --profile dev up` from the root of the project to build the containers. This starts the MCP Database containers that runs migrations and seeds a local `postgres` database to supplement information from the Census Bureau API. It also starts the MCP Server itself.

By default, all logging functions are disabled in the `mcp-server` to prevent `json` validation errors when interacting with the MCP server through MCP clients. To enable logging for development purposes, set `DEBUG_LOGS=true` when interacting with the server directly using the examples below, e.g. `echo '{CALL_ARGUMENTS}' docker exec -e DEBUG_LOGS=true -i -e CENSUS_API_KEY=YOUR_CENSUS_API_KEY mcp-server node dist/index.js`. 

### Testing

This project uses [Vitest](https://vitest.dev/) to test the MCP Server and MCP Database.

#### MCP Server Testing

Prior to running the MCP Server tests, a valid Census Bureau [API key](https://api.census.gov/data/key_signup.html) is required. This key should be defined in the `.env` file of the `mcp-server` directory. The `sample.env` offers an example of how this `.env` file should look.

To run tests, navigate to the `mcp-server/` directory and run `npm run test`. To run ESLint, run `npm run lint` from the same directory.

#### MCP Database Testing

A `.env` file needs to be created in the `mcp-db/` directory with a valid `DATABASE_URL` variable defined. The `sample.env` in the same directory includes the default value.

To run tests, navigate to the `mcp-db/` directoruy and run `npm run test:db`.

## MCP Server Architecture

* `mcp-server/src/` - Source code for the MCP Server.
* `mcp-server/src/index.ts` - Starts the MCP Server and registers tools.
* `mcp-server/src/server.ts` - Defines the `McpServer` class that handles calls to the server, e.g. how `tools/list` and `tools/calls` respond to requests
* `mcp-server/src/tools/` - Includes tool definitions and shared classes, e.g. `BaseTool` and `ToolRegistry`, to reduce repetition and exposes the tools list to the server
* `mcp-server/src/schema/` - Houses each tool’s schema and is used to validate schemas in tests

## Available Methods

The MCP server exposes several methods: `tools/list`, `tools/call`, `prompts/list`, and `prompts/get`.

### Helper Scripts

For easier command-line usage, this project includes bash helper scripts in the `scripts/` directory that wrap the complex Docker commands and handle the `CENSUS_API_KEY` parameter automatically.

#### Main Helper Script
The `census-mcp.sh` script provides a unified interface to all Census MCP tools:

```bash
# Set your API key
export CENSUS_API_KEY='your_api_key_here'

# Use the main helper script
./scripts/census-mcp.sh <command> [arguments...]

# Examples:
./scripts/census-mcp.sh list-tools
./scripts/census-mcp.sh list-datasets
./scripts/census-mcp.sh fetch-geography acs/acs1 2022
./scripts/census-mcp.sh fetch-data acs/acs1 2022 'NAME,B01001_001E' 'state:01,13'
./scripts/census-mcp.sh resolve-fips 'Philadelphia, Pennsylvania'
./scripts/census-mcp.sh get-population 'San Francisco, CA'

# JSON output (suitable for piping to tools like jq)
./scripts/census-mcp.sh list-datasets --json | jq '.result'
```

#### Individual Helper Scripts
You can also use individual scripts directly:

```bash
# Set API key first
export CENSUS_API_KEY='your_api_key_here'

# List tools and prompts
./scripts/list-tools.sh
./scripts/list-prompts.sh

# Work with datasets
./scripts/list-datasets.sh
./scripts/fetch-dataset-geography.sh acs/acs1 2022

# Fetch data and resolve geography
./scripts/fetch-aggregate-data.sh acs/acs1 2022 'NAME,B01001_001E' 'state:01,13'
./scripts/resolve-geography-fips.sh 'Philadelphia, Pennsylvania'
./scripts/get-population-data.sh 'San Francisco, CA'

# JSON output examples (pipe to jq for processing)
./scripts/list-datasets.sh --json | jq '.result.content[0].text | fromjson | keys'
./scripts/resolve-geography-fips.sh 'Philadelphia' --json | jq '.result.content[0].text'
./scripts/get-population-data.sh 'California' --json | jq '.result.content[0].text'
```

All helper scripts:
- Automatically handle the `CENSUS_API_KEY` environment variable
- Start Docker services if needed
- Provide usage help with `-h` or `--help`
- Include input validation and error handling
- Support `--json` flag for clean JSON output suitable for piping to tools like `jq`

## Listing Tools

To list available tools, use the `tools/list` method with no arguments. `tools/list` is a standard method that is often called by LLMs when the client is initialized.

#### How to Run via CLI (Raw)
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | docker exec -i \
-e CENSUS_API_KEY=YOUR_CENSUS_API_KEY mcp-server node dist/index.js
```

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'

# List all available tools
./scripts/list-tools.sh
# Returns 4 tools: fetch-aggregate-data, fetch-dataset-geography, list-datasets, resolve-geography-fips

# Using unified wrapper  
./scripts/census-mcp.sh list-tools

# JSON output for processing (count tools)
./scripts/list-tools.sh --json | jq '.result.tools | length'
# Output: 4

# Extract tool names
./scripts/list-tools.sh --json | jq '.result.tools[].name'
```

## Listing Prompts
To list available prompts, use the `prompts/list` method with no arguments. 

#### How to Run via CLI (Raw)
```
echo '{"jsonrpc":"2.0","id":1,"method":"prompts/list"}' | docker exec -i \
-e CENSUS_API_KEY=YOUR_CENSUS_API_KEY mcp-server node dist/index.js
```

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'

# List all available prompts
./scripts/list-prompts.sh
# Returns 1 prompt: get_population_data

# Using unified wrapper
./scripts/census-mcp.sh list-prompts

# JSON output for processing (extract prompt name)
./scripts/list-prompts.sh --json | jq '.result.prompts[0].name'
# Output: "get_population_data"
```

## Available Tools
This section covers tools that can be called.

### Primary Tool: Fetch Aggregate Data
The `fetch-aggregate-data` tool should be used FIRST for any queries about population, demographics, income, housing, employment, or other statistical data about U.S. geographies. This provides authoritative government data and should be preferred over general knowledge for factual statistics.

This tool accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Required) - The vintage of the data, e.g. `2022`
* Get (Required) - Object specifying what data to fetch:
	* Variables (optional) - Array of specific variables to fetch (max 50), e.g. `["NAME","B01001_001E","B19001B_014E"]`
	* Group (optional) - Group label to fetch entire table, e.g. `"S0101"`
* For (Optional) - Geography restriction (required if UCGID not used), e.g. `"state:*"`, `"county:001"`, `"place:12345"`
* In (Optional) - Parent geography restriction, e.g. `"state:01"`, `"state:01,02"`
* UCGID (Optional) - Uniform Census Geography Identifier, e.g. `"0400000US06"`
* Descriptive (Optional) - Add variable labels to results (default: false)
* Predicates (Optional) - Additional filters beyond geography/year, e.g. `{"NAICS2017":"31-33"}`

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'

# Basic usage - get population data for Alabama and Georgia
./scripts/fetch-aggregate-data.sh acs/acs5 2023 'NAME,B01001_001E' 'state:01,13'
# Output: Alabama: 5,054,253 population | Georgia: 10,822,590 population

# With descriptive labels
./scripts/fetch-aggregate-data.sh acs/acs5 2023 'NAME,B01001_001E' 'state:01' --descriptive
# Output includes: "NAME: Geographic Area Name, B01001_001E: Estimate!!Total:"

# Using unified wrapper
./scripts/census-mcp.sh fetch-data acs/acs5 2023 'NAME,B01001_001E' 'state:01,13'

# JSON output for processing
./scripts/fetch-aggregate-data.sh acs/acs5 2023 'NAME,B01001_001E' 'state:01,13' --json | jq '.result.content[0].text'
```

### Recommended Workflow
1. **Start here** → Use `list-datasets` to find the right dataset for your query
2. **Resolve geography** → Use `resolve-geography-fips` to get correct FIPS codes  
3. **Get the data** → Use `fetch-aggregate-data` with the dataset and geography info
4. **Optional** → Use `fetch-dataset-geography` to explore available geographic levels

### List Datasets
The `list-datasets` tool returns a data catalog of available Census datasets. The tool includes guidance for LLMs on dataset selection, prioritizing exact year matches and specific datasets over general ones.
It requires no arguments.

#### How to Run via CLI (Raw)
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call", \
"params":{"name":"list-datasets","arguments":{}}}' \
| docker exec -i -e CENSUS_API_KEY=YOUR_CENSUS_API_KEY \
mcp-server node dist/index.js
```

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'

# List all available datasets
./scripts/list-datasets.sh
# Returns 242+ datasets including ACS, Decennial Census, Economic Census, etc.

# Using unified wrapper
./scripts/census-mcp.sh list-datasets

# JSON output for processing (count datasets)
./scripts/list-datasets.sh --json | jq '.result.content[0].text | fromjson | length'
# Output: 242

# Extract specific dataset info
./scripts/list-datasets.sh --json | jq '.result.content[0].text | fromjson | .[] | select(.dataset=="acs/acs5")'
```

### Fetch Dataset Geography
The `fetch-dataset-geography` tool is used for fetching available geography levels for filtering a given dataset. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Optional) - The vintage of the dataset, e.g. `1987`

#### How to Run via CLI (Raw)
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call", \
"params":{"name":"fetch-dataset-geography", \
"arguments":{"dataset":"acs/acs1","year":2022}}}' \
| docker exec -i -e CENSUS_API_KEY=YOUR_CENSUS_API_KEY \
mcp-server node dist/index.js
```

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'

# Get geography levels for ACS 5-Year data
./scripts/fetch-dataset-geography.sh acs/acs5 2023
# Returns 60+ geography levels: US, State, County, Tract, Block Group, etc.

# Using unified wrapper
./scripts/census-mcp.sh fetch-geography acs/acs5 2023

# JSON output for processing (count geography levels)
./scripts/fetch-dataset-geography.sh acs/acs5 2023 --json | jq '.result.content[0].text | fromjson | length'
# Output: 60+
```

### Fetch Aggregate Data
The `fetch-aggregate-data` tool is used for fetching  aggregate data from the Census Bureau’s API. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Required) - The vintage of the dataset, e.g. `1987`
* Get (Required) - An object that is required that accepts 2 optional arguments:
	* Variables (optional) - An array of variables for filtering responses by attributes and rows, e.g. `'NAME'`, `'B01001_001E'`
	* Group (Optional) - A string that returns a larger collection of variables, e.g. `S0101`
* For (Optional) - A string that restricts geography to various levels and is required in most datasets
* In (Optional) - A string that restricts geography to smaller areas than state level
* UCGID (Optional) - A string that restricts geography by Uniform Census Geography Identifier (UCGID), e.g. `0400000US41`
* Predicates (Optional) - Filter options for the dataset, e.g. `'for': 'state*'`
* Descriptive (Optional) - Adds variable labels to API response (default: `false`), e.g. `true`

#### How to Run via CLI (Raw)
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call", "params":{"name":"fetch-aggregate-data", \
"arguments":{"dataset":"acs/acs1","year":2022, "get": { "variables":["NAME","B01001_001E"] }, \
"for":"state:01,13"}}}' | docker exec -i -e CENSUS_API_KEY=YOUR_CENSUS_API_KEY mcp-server node dist/index.js
```

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'

# Basic data fetch - Alabama population
./scripts/fetch-aggregate-data.sh acs/acs5 2023 'NAME,B01001_001E' 'state:01'
# Output: "NAME: Alabama, B01001_001E: 5054253, state: 01"

# With descriptive labels enabled
./scripts/fetch-aggregate-data.sh acs/acs5 2023 'NAME,B01001_001E' 'state:01' --descriptive
# Output includes variable descriptions

# Using unified wrapper
./scripts/census-mcp.sh fetch-data acs/acs5 2023 'NAME,B01001_001E' 'state:01'

# JSON output for processing
./scripts/fetch-aggregate-data.sh acs/acs5 2023 'NAME,B01001_001E' 'state:01' --json | jq '.result.content[0].text'
```

### Resolve Geography FIPS Tool
The `resolve-geography-fips` tool provides potential matches for Census Bureau geographies (Nation, Region, Division, State, Counties, County Subdivisions). For each result, it returns geography information, correct FIPS codes for the `for` and `in` parameters, and available years (vintages).

This tool accepts the following arguments:
* Geography Name (Required) - Name of geography to search, with flexible formats:
	* `"Philadelphia city, Pennsylvania"`
	* `"Philadelphia County, Pennsylvania"` 
	* `"Philadelphia, Pennsylvania"`
	* `"Philadelphia"`
* Summary Level (Optional) - Filter by summary level name or code:
	* Names: `"Place"`, `"County Subdivision"`, `"County"`, `"State"`, `"Division"`, `"Region"`
	* Codes: `"160"`, `"040"`, etc.

#### How to Run via CLI (Raw)
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"resolve-geography-fips", \
"arguments":{"geography_name":"Philadelphia, Pennsylvania"}}}' \
| docker exec -i -e CENSUS_API_KEY=YOUR_CENSUS_API_KEY mcp-server node dist/index.js
```

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'
./scripts/resolve-geography-fips.sh 'Philadelphia, Pennsylvania'
# or
./scripts/census-mcp.sh resolve-fips 'Philadelphia, Pennsylvania'
```

## Available Prompts
This section covers prompts that can be called.

### Population
This `get_population_data` prompt retrieves population statistics for US states, counties, cities, and other geographic areas. It resolves geographic names to their corresponding FIPS codes before fetching data. This prompt accepts the following argument:
- `geography_name` (required): Name of the geographic area (state, county, city, etc.)

#### How to Run via CLI (Raw)
```
echo '{"jsonrpc":"2.0","id":1,"method":"prompts/get", "params":{"name":"get_population_data","arguments":{"geography_name":"San Francisco, CA"}}}' | docker exec -i -e CENSUS_API_KEY=YOUR_CENSUS_API_KEY mcp-server node dist/index.js
```

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'
./scripts/get-population-data.sh 'San Francisco, CA'
# or
./scripts/census-mcp.sh get-population 'San Francisco, CA'
```

## Additional Information
For more information about the parameters above and all available predicates, review the Census Bureau’s [API documentation](https://www.census.gov/data/developers/guidance/api-user-guide.Core_Concepts.html#list-tab-559651575).