# Census API Model Context Protocol Server
A model context protocol (MCP) server for interacting with the Census Bureau API. This library uses stdio for connections to the server.

## Requirements
* A valid Census Bureau [API key](https://api.census.gov/data/key_signup.html)
* Docker
* Node 16+

## Available Tools

### Fetch Dataset
A tool for fetching a dataset from the API. Accepts the following parameters:
* Year (Required) - The vintage of the dataset, e.g. 1987.
* Dataset (Required) - The identifier of the dataset, e.g. "acs/acs1"
* Variables (Required) - The required variables for returning a valid response, e.g. "NAME", "B01001_001E"
* For (Optional) - Restricts geography to various levels and is required in most datasets
* In (Optional) - Restricts geography to smaller areas than state level
* Predicates (Optional) - Filter options for the dataset, e.g. "for": "state*"
* Output Format (Optional) - Specificies CSV or JSON output

#### Example
```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fetch-dataset","arguments":{"dataset":"acs/acs1","year":2022,"variables":["NAME","B01001_001E"],"for":"state:01,13"}}}' \
| docker run --rm -i -e CENSUS_API_KEY=YOUR_API_KEY census-api
```
For more information, the API’s Core Concepts are covered in the [documentation](https://www.census.gov/data/developers/guidance/api-user-guide.Core_Concepts.html#list-tab-559651575).
