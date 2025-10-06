#!/bin/bash

# Census MCP Helper - Main wrapper script for all Census MCP tools
# This script provides a unified interface to all Census MCP tools and commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to show usage
show_usage() {
    echo "Census MCP Helper - Unified interface for Census Bureau Data API MCP tools"
    echo ""
    echo "Usage: $0 <command> [arguments...] [--json]"
    echo ""
    echo "Available commands:"
    echo "  list-tools              List available MCP tools"
    echo "  list-prompts            List available MCP prompts" 
    echo "  list-datasets           List available Census datasets"
    echo "  fetch-dataset-geography <dataset> [year]"
    echo "                          Fetch geography levels for a dataset"
    echo "  fetch-aggregate-data <dataset> <year> <variables> [for] [in] [ucgid] [--descriptive] [--predicates key:value]"
    echo "                          Fetch aggregate Census data"
    echo "  resolve-geography-fips <geography> [summary_level]"
    echo "                          Resolve geography name to FIPS codes"
    echo "  get-population-data <geography>"
    echo "                          Get population data for a geography"
    echo ""
    echo "Global Options:"
    echo "  --json                  Output only JSON (suitable for piping to jq)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment Setup:"
    echo "  Set CENSUS_API_KEY environment variable before running:"
    echo "    export CENSUS_API_KEY='your_api_key_here'"
    echo "    $0 <command> [arguments...]"
    echo ""
    echo "  Or provide it inline:"
    echo "    CENSUS_API_KEY='your_api_key' $0 <command> [arguments...]"
    echo ""
    echo "Examples:"
    echo "  $0 list-tools"
    echo "  $0 list-datasets --json | jq '.result'"
    echo "  $0 fetch-dataset-geography acs/acs1 2022"
    echo "  $0 fetch-aggregate-data acs/acs1 2022 'NAME,B01001_001E' 'state:01,13' --descriptive"
    echo "  $0 resolve-geography-fips 'Philadelphia, Pennsylvania'"
    echo "  $0 get-population-data 'San Francisco, CA'"
}

# Check if CENSUS_API_KEY is provided
if [ -z "$CENSUS_API_KEY" ]; then
    echo "Error: CENSUS_API_KEY environment variable is required" >&2
    echo "" >&2
    show_usage >&2
    exit 1
fi

# Parse arguments to extract --json flag and command
JSON_FLAG=""
COMMAND=""
COMMAND_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_FLAG="--json"
            shift
            ;;
        -h|--help|help)
            show_usage
            exit 0
            ;;
        *)
            if [ -z "$COMMAND" ]; then
                COMMAND="$1"
            else
                COMMAND_ARGS+=("$1")
            fi
            shift
            ;;
    esac
done

# Check for command argument
if [ -z "$COMMAND" ]; then
    echo "Error: Command argument is required" >&2
    echo "" >&2
    show_usage >&2
    exit 1
fi

# Route to appropriate script
case "$COMMAND" in
    "list-tools")
        exec "$SCRIPT_DIR/list-tools.sh" "${COMMAND_ARGS[@]}" $JSON_FLAG
        ;;
    "list-prompts")
        exec "$SCRIPT_DIR/list-prompts.sh" "${COMMAND_ARGS[@]}" $JSON_FLAG
        ;;
    "list-datasets")
        exec "$SCRIPT_DIR/list-datasets.sh" "${COMMAND_ARGS[@]}" $JSON_FLAG
        ;;
    "fetch-dataset-geography")
        exec "$SCRIPT_DIR/fetch-dataset-geography.sh" "${COMMAND_ARGS[@]}" $JSON_FLAG
        ;;
    "fetch-aggregate-data")
        exec "$SCRIPT_DIR/fetch-aggregate-data.sh" "${COMMAND_ARGS[@]}" $JSON_FLAG
        ;;
    "resolve-geography-fips")
        exec "$SCRIPT_DIR/resolve-geography-fips.sh" "${COMMAND_ARGS[@]}" $JSON_FLAG
        ;;
    "get-population-data")
        exec "$SCRIPT_DIR/get-population-data.sh" "${COMMAND_ARGS[@]}" $JSON_FLAG
        ;;
    *)
        echo "Error: Unknown command '$COMMAND'" >&2
        echo "" >&2
        show_usage >&2
        exit 1
        ;;
esac