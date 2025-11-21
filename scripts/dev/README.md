# Development Helper Scripts

**Note: These scripts are for development and testing purposes only.** They are not the intended primary interface for interacting with the MCP server. For production use, connect your AI assistant client to the MCP server as described in the main [README.md](../../README.md).

The Model Context Protocol (MCP) is designed for client-server interactions through MCP clients (like Claude Desktop, IDEs with MCP support, etc.). These bash helper scripts are provided to facilitate development, debugging, and testing workflows.

## Contents
* [Available Scripts](#available-scripts)
* [Helper Scripts Usage](#helper-scripts-usage)
  * [Main Helper Script](#main-helper-script)
  * [Individual Helper Scripts](#individual-helper-scripts)
  * [Script Features](#script-features)
* [CLI Examples](#cli-examples)
* [Listing Tools](#listing-tools)
* [Listing Prompts](#listing-prompts)
* [Available Tools](#available-tools)
  * [List Datasets](#list-datasets)
  * [Fetch Dataset Geography](#fetch-dataset-geography)
  * [Fetch Aggregate Data](#fetch-aggregate-data)
  * [Resolve Geography FIPS Tool](#resolve-geography-fips-tool)
* [Available Prompts](#available-prompts)
  * [Population](#population)
* [Additional Information](#additional-information)

## Available Scripts

* `census-mcp.sh` - Unified interface to all Census MCP tools
* `list-tools.sh` - List available MCP tools
* `list-prompts.sh` - List available MCP prompts
* `list-datasets.sh` - List available Census datasets
* `fetch-dataset-geography.sh` - Fetch geography levels for a dataset
* `fetch-aggregate-data.sh` - Fetch aggregate Census data
* `resolve-geography-fips.sh` - Resolve geography names to FIPS codes
* `get-population-data.sh` - Get population data prompt for a geography


## Helper Scripts Usage

All helper scripts require the `CENSUS_API_KEY` environment variable to be set:

```bash
export CENSUS_API_KEY='your_api_key_here'
```

### Main Helper Script

The `census-mcp.sh` script provides a unified interface to all Census MCP tools:

```bash
# Usage
./census-mcp.sh <command> [arguments...] [--json]

# Available commands:
#   list-tools              List available MCP tools
#   list-prompts            List available MCP prompts
#   list-datasets           List available Census datasets
#   fetch-dataset-geography <dataset> [year]
#                           Fetch geography levels for a dataset
#   fetch-aggregate-data    <dataset> <year> <variables> [for] [in] [ucgid] [predicates] [--descriptive]
#                           Fetch aggregate Census data
#   resolve-geography-fips  <geography_name> [summary_level]
#                           Resolve geography name to FIPS codes
#   get-population-data     <geography_name>
#                           Get population data prompt
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
* Dataset (Required) - The identifier of the dataset, e.g. `'cbp'`
* Year (Optional) - The vintage of the dataset, e.g. `2022`

#### How to Run via CLI (Raw)
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call", \
"params":{"name":"fetch-dataset-geography", \
"arguments":{"dataset":"cbp","year":2022}}}' \
| docker exec -i -e CENSUS_API_KEY=YOUR_CENSUS_API_KEY \
mcp-server node dist/index.js
```

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'

# Get geography levels for CBP data
./scripts/fetch-dataset-geography.sh cbp 2022

# Using unified wrapper
./scripts/census-mcp.sh fetch-dataset-geography cbp 2022

# Using unified wrapper with JSON output
./scripts/census-mcp.sh fetch-dataset-geography cbp 2022 --json | jq -r '.result.content[0].text' | tail -n +3 | jq 'length'

# JSON output for processing (count geography levels)
./scripts/fetch-dataset-geography.sh cbp 2022 --json | jq -r '.result.content[0].text' | tail -n +3 | jq 'length'

# Extract specific geography query example
./scripts/fetch-dataset-geography.sh cbp 2022 --json | jq -r '.result.content[0].text' | tail -n +3 | jq '.[] | select(.name == "state") | .queryExample'
```

### Fetch Aggregate Data
The `fetch-aggregate-data` tool is used for fetching  aggregate data from the Census Bureau’s API. It accepts the following arguments:
* Dataset (Required) - The identifier of the dataset, e.g. `'acs/acs1'`
* Year (Required) - The vintage of the dataset, e.g. `2022`
* Get (Required) - Data to retrieve - specify either:
	* Variables (optional) - Comma-separated variables, e.g. `'NAME,B01001_001E'`
	* Group (Optional) - Variable group identifier, e.g. `'S0101'`
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

# Using variables (comma-separated) - requires geography for ACS
./scripts/fetch-aggregate-data.sh acs/acs1 2022 'NAME,B01001_001E' 'state:01'
./scripts/fetch-aggregate-data.sh acs/acs1 2022 'NAME,B01001_001E' 'state:01,13'

# Using a group (single identifier) - example with CBP dataset  
./scripts/fetch-aggregate-data.sh cbp 2022 'NAME,EMP' 'state:01'
./scripts/fetch-aggregate-data.sh cbp 2022 'NAME,EMP' 'state:*'

# With descriptive labels enabled
./scripts/fetch-aggregate-data.sh acs/acs1 2022 'NAME,B01001_001E' 'state:01' --descriptive

# With predicates
./scripts/fetch-aggregate-data.sh acs/acs1 2022 'NAME,B01001_001E' --predicates 'NAICS2017:31-33'

# Using unified wrapper
./scripts/census-mcp.sh fetch-aggregate-data acs/acs1 2022 'NAME,B01001_001E' 'state:01'

# JSON output for processing
./scripts/fetch-aggregate-data.sh acs/acs1 2022 'NAME,B01001_001E' 'state:01' --json | jq '.result.content[0].text'
```

### Resolve Geography FIPS Tool
The `resolve-geography-fips` tool provides potential matches for Census Bureau geographies. For each result, it returns geography information, correct FIPS codes for the `for` and `in` parameters, and available years (vintages).

* Geography Name (Required) - Name of the geography to search, e.g., 'Philadelphia'
* Summary Level (Optional) - Summary level to search, e.g., 'Place' or '160'

#### How to Run via CLI (Raw)
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"resolve-geography-fips", \
"arguments":{"geography_name":"Philadelphia, Pennsylvania"}}}' \
| docker exec -i -e CENSUS_API_KEY=YOUR_CENSUS_API_KEY mcp-server node dist/index.js
```

#### How to Run via Helper Script
```bash
export CENSUS_API_KEY='your_api_key'

# Basic geography search
./scripts/resolve-geography-fips.sh 'Philadelphia, Pennsylvania'

# With summary level filter
./scripts/resolve-geography-fips.sh 'Philadelphia' 'Place'
./scripts/resolve-geography-fips.sh 'Cook County' '050'

# Using unified wrapper
./scripts/census-mcp.sh resolve-geography-fips 'Philadelphia, Pennsylvania'

# JSON output for processing  
./scripts/resolve-geography-fips.sh 'Cook County' '050' --json | jq -r '.result.content[0].text' | tail -n +3 | jq '.[0].for_param'
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

# Basic usage
./scripts/get-population-data.sh 'San Francisco, CA'
./scripts/get-population-data.sh 'California'

# Using unified wrapper
./scripts/census-mcp.sh get-population-data 'San Francisco, CA'

# JSON output for processing
./scripts/get-population-data.sh 'Cook County, Illinois' --json | jq '.result.description'
```

## Additional Information
For more information about the parameters above and all available predicates, review the Census Bureau’s [API documentation](https://www.census.gov/data/developers/guidance/api-user-guide.Core_Concepts.html#list-tab-559651575).