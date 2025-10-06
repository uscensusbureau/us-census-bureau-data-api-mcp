#!/bin/bash

# Get Population Data Helper Script
# This script wraps the get_population_data prompt to retrieve population statistics

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
JSON_ONLY=false
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_ONLY=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 <geography_name> [--json]"
            echo ""
            echo "Arguments:"
            echo "  geography_name   (Required) Name of the geographic area (state, county, city, etc.)"
            echo ""
            echo "Options:"
            echo "  --json          Output only JSON (suitable for piping to jq)"
            echo "  -h, --help      Show this help message"
            echo ""
            echo "Examples:"
            echo "  CENSUS_API_KEY=your_key $0 'San Francisco, CA'"
            echo "  CENSUS_API_KEY=your_key $0 'California'"
            echo "  CENSUS_API_KEY=your_key $0 'Cook County, Illinois' --json | jq '.result'"
            echo ""
            echo "Environment:"
            echo "  CENSUS_API_KEY must be set"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done

# Restore positional parameters
set -- "${POSITIONAL_ARGS[@]}"

# Check if CENSUS_API_KEY is provided
if [ -z "$CENSUS_API_KEY" ]; then
    echo "Error: CENSUS_API_KEY environment variable is required" >&2
    echo "Usage: CENSUS_API_KEY=your_key $0 <geography_name> [--json]" >&2
    exit 1
fi

# Check for required arguments
if [ $# -lt 1 ]; then
    echo "Error: Geography name argument is required" >&2
    echo "Usage: $0 <geography_name> [--json]" >&2
    exit 1
fi

GEOGRAPHY_NAME="$1"

# Build JSON payload
JSON_PAYLOAD="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"prompts/get\",\"params\":{\"name\":\"get_population_data\",\"arguments\":{\"geography_name\":\"$GEOGRAPHY_NAME\"}}}"

# Change to project directory
cd "$PROJECT_DIR" || exit

# Ensure services are running
docker compose --profile prod up -d >/dev/null 2>&1
sleep 3

if [ "$JSON_ONLY" = false ]; then
    echo "Getting population data for: $GEOGRAPHY_NAME"
    echo ""
fi

echo "$JSON_PAYLOAD" | \
docker exec -i -e CENSUS_API_KEY="$CENSUS_API_KEY" mcp-server node dist/index.js