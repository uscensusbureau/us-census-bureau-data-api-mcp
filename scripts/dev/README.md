# Development Helper Scripts

**Note: These scripts are for development and testing purposes only.** They are not the intended primary interface for interacting with the MCP server. For production use, connect your AI assistant client to the MCP server as described in the main [README.md](../../README.md).

The Model Context Protocol (MCP) is designed for client-server interactions through MCP clients (like Claude Desktop, IDEs with MCP support, etc.). These bash helper scripts are provided to facilitate development, debugging, and testing workflows.

## Contents
* [Available Scripts](#available-scripts)


## Available Scripts

* `census-mcp.sh` - Unified interface to all Census MCP tools
* `list-tools.sh` - List available MCP tools
* `list-prompts.sh` - List available MCP prompts
* `list-datasets.sh` - List available Census datasets
* `fetch-dataset-geography.sh` - Fetch geography levels for a dataset
* `fetch-aggregate-data.sh` - Fetch aggregate Census data
* `resolve-geography-fips.sh` - Resolve geography names to FIPS codes
* `get-population-data.sh` - Get population data for a geography


## Helper Scripts Usage

All helper scripts require the `CENSUS_API_KEY` environment variable to be set:

```bash
export CENSUS_API_KEY='your_api_key_here'
```

### Main Helper Script

The `census-mcp.sh` script provides a unified interface to all Census MCP tools:

```bash
# Use the main helper script
./census-mcp.sh <command> [arguments...]

# Examples:
./census-mcp.sh list-tools
./census-mcp.sh list-datasets
./census-mcp.sh fetch-dataset-geography acs/acs1 2022
./census-mcp.sh fetch-data acs/acs1 2022 'NAME,B01001_001E' 'state:01,13'
./census-mcp.sh resolve-fips 'Philadelphia, Pennsylvania'
./census-mcp.sh get-population-data 'San Francisco, CA'

# JSON output (suitable for piping to tools like jq)
./census-mcp.sh list-datasets --json | jq '.result'
```

### Individual Helper Scripts

You can also use individual scripts directly:

```bash
# List tools and prompts
./list-tools.sh
./list-prompts.sh

# Work with datasets
./list-datasets.sh
./fetch-dataset-geography.sh acs/acs1 2022

# Fetch data and resolve geography
./fetch-aggregate-data.sh acs/acs1 2022 'NAME,B01001_001E' 'state:01,13'
./resolve-geography-fips.sh 'Philadelphia, Pennsylvania'
./get-population-data.sh 'San Francisco, CA'

# JSON output examples (pipe to jq for processing)
./list-datasets.sh --json | jq '.result.content[0].text | fromjson | keys'
./resolve-geography-fips.sh 'Philadelphia' --json | jq '.result.content[0].text'
./get-population-data.sh 'California' --json | jq '.result.content[0].text'
```

### Script Features

All helper scripts:
- Automatically handle the `CENSUS_API_KEY` environment variable
- Start Docker services if needed
- Provide usage help with `-h` or `--help`
- Include input validation and error handling
- Support `--json` flag for clean JSON output suitable for piping to tools like `jq`

## CLI Examples

The following sections show both raw CLI commands (for understanding the underlying MCP protocol) and helper script examples for each tool and prompt.

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

# Using unified wrapper  
./scripts/census-mcp.sh list-tools

# JSON output for processing (count tools)
./scripts/list-tools.sh --json | jq '.result.tools | length'

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

# Using unified wrapper
./scripts/census-mcp.sh list-prompts

# JSON output for processing (extract prompt name)
./scripts/list-prompts.sh --json | jq '.result.prompts[0].name'
```

## Available Tools
This section covers tools that can be called.

### List Datasets
The `list-datasets` tool returns a data catalog containing a subset of metadata for all datasets available through the Census Bureau's API. The tool includes guidance for LLMs on dataset selection, prioritizing exact year matches and specific datasets over general ones. It requires no arguments.

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

# Using unified wrapper
./scripts/census-mcp.sh list-datasets

# JSON output for processing (count datasets)
./scripts/list-datasets.sh --json | jq '.result.content[0].text | fromjson | length'

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

# Using unified wrapper
./scripts/census-mcp.sh fetch-dataset-geography acs/acs5 2023

# JSON output for processing (count geography levels)
./scripts/fetch-dataset-geography.sh acs/acs5 2023 --json | jq '.result.content[0].text | fromjson | length'
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

# With descriptive labels enabled
./scripts/fetch-aggregate-data.sh acs/acs5 2023 'NAME,B01001_001E' 'state:01' --descriptive

# Using unified wrapper
./scripts/census-mcp.sh fetch-data acs/acs5 2023 'NAME,B01001_001E' 'state:01'

# JSON output for processing
./scripts/fetch-aggregate-data.sh acs/acs5 2023 'NAME,B01001_001E' 'state:01' --json | jq '.result.content[0].text'
```

### Resolve Geography FIPS Tool
The `resolve-geography-fips` tool provides potential matches for Census Bureau geographies. For each result, it returns geography information, correct FIPS codes for the `for` and `in` parameters, and available years (vintages).

* Geography Name (Required) - The name of the geography to search, e.g. Philadelphia
* Summary Level (Optional) - The summary level to search. Accepts name or summary level code, e.g. Place, 160

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
./scripts/census-mcp.sh get-population-data 'San Francisco, CA'
```

## Additional Information
For more information about the parameters above and all available predicates, review the Census Bureau’s [API documentation](https://www.census.gov/data/developers/guidance/api-user-guide.Core_Concepts.html#list-tab-559651575).