#!/bin/bash

# Resolve Geography FIPS Helper Script
# This script wraps the resolve-geography-fips tool to search for geographic areas

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
            echo "Usage: $0 <geography_name> [summary_level] [--json]"
            echo ""
            echo "Arguments:"
            echo "  geography_name   (Required) Name of the geography to search, e.g., 'Philadelphia'"
            echo "  summary_level    (Optional) Summary level to search, e.g., 'Place' or '160'"
            echo ""
            echo "Options:"
            echo "  --json          Output only JSON (suitable for piping to jq)"
            echo "  -h, --help      Show this help message"
            echo ""
            echo "Examples:"
            echo "  CENSUS_API_KEY=your_key $0 'Philadelphia, Pennsylvania'"
            echo "  CENSUS_API_KEY=your_key $0 'Philadelphia' 'Place'"
            echo "  CENSUS_API_KEY=your_key $0 'Cook County' '050' --json | jq '.result'"
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
    echo "Usage: CENSUS_API_KEY=your_key $0 <geography_name> [summary_level] [--json]" >&2
    exit 1
fi

# Check for required arguments
if [ $# -lt 1 ]; then
    echo "Error: Geography name argument is required" >&2
    echo "Usage: $0 <geography_name> [summary_level] [--json]" >&2
    exit 1
fi

GEOGRAPHY_NAME="$1"
SUMMARY_LEVEL="$2"

# Build JSON payload
if [ -n "$SUMMARY_LEVEL" ]; then
    JSON_PAYLOAD="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"resolve-geography-fips\",\"arguments\":{\"geography_name\":\"$GEOGRAPHY_NAME\",\"summary_level\":\"$SUMMARY_LEVEL\"}}}"
else
    JSON_PAYLOAD="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"resolve-geography-fips\",\"arguments\":{\"geography_name\":\"$GEOGRAPHY_NAME\"}}}"
fi

# Change to project directory
cd "$PROJECT_DIR" || exit

# Ensure services are running
docker compose --profile prod up -d >/dev/null 2>&1
sleep 3

if [ "$JSON_ONLY" = false ]; then
    echo "Resolving geography FIPS for: $GEOGRAPHY_NAME$([ -n "$SUMMARY_LEVEL" ] && echo " (summary level: $SUMMARY_LEVEL)")"
    echo ""
fi

echo "$JSON_PAYLOAD" | \
docker exec -i -e CENSUS_API_KEY="$CENSUS_API_KEY" mcp-server node dist/index.js