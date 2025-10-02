#!/bin/bash

# List Datasets Helper Script
# This script wraps the list-datasets tool to fetch metadata for all available Census datasets

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
JSON_ONLY=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_ONLY=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--json]"
            echo ""
            echo "Options:"
            echo "  --json    Output only JSON (suitable for piping to jq)"
            echo "  -h, --help Show this help message"
            echo ""
            echo "Environment:"
            echo "  CENSUS_API_KEY must be set"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if CENSUS_API_KEY is provided
if [ -z "$CENSUS_API_KEY" ]; then
    echo "Error: CENSUS_API_KEY environment variable is required" >&2
    echo "Usage: CENSUS_API_KEY=your_api_key $0 [--json]" >&2
    echo "   or: export CENSUS_API_KEY=your_api_key && $0 [--json]" >&2
    exit 1
fi

# Change to project directory
cd "$PROJECT_DIR" || exit

# Ensure services are running
docker compose --profile prod up -d >/dev/null 2>&1
sleep 3

if [ "$JSON_ONLY" = false ]; then
    echo "Fetching list of available Census datasets..."
fi

echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list-datasets","arguments":{}}}' | \
docker exec -i -e CENSUS_API_KEY="$CENSUS_API_KEY" mcp-server node dist/index.js