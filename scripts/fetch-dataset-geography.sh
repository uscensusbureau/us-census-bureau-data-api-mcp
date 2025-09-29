#!/bin/bash

# Fetch Dataset Geography Helper Script
# This script wraps the fetch-dataset-geography tool

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

#!/bin/bash

# Fetch Dataset Geography Helper Script
# This script wraps the fetch-dataset-geography tool

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
            echo "Usage: $0 <dataset> [year] [--json]"
            echo ""
            echo "Arguments:"
            echo "  dataset   (Required) Dataset identifier, e.g., 'acs/acs1'"
            echo "  year      (Optional) Dataset vintage, e.g., 2022"
            echo ""
            echo "Options:"
            echo "  --json    Output only JSON (suitable for piping to jq)"
            echo "  -h, --help Show this help message"
            echo ""
            echo "Examples:"
            echo "  CENSUS_API_KEY=your_key $0 acs/acs1"
            echo "  CENSUS_API_KEY=your_key $0 acs/acs1 2022"
            echo "  CENSUS_API_KEY=your_key $0 acs/acs1 2022 --json | jq '.result'"
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
    echo "Usage: CENSUS_API_KEY=your_key $0 <dataset> [year] [--json]" >&2
    exit 1
fi

# Check for required arguments
if [ $# -lt 1 ]; then
    echo "Error: Dataset argument is required" >&2
    echo "Usage: $0 <dataset> [year] [--json]" >&2
    exit 1
fi

DATASET="$1"
YEAR="$2"

# Build JSON payload
if [ -n "$YEAR" ]; then
    JSON_PAYLOAD="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"fetch-dataset-geography\",\"arguments\":{\"dataset\":\"$DATASET\",\"year\":$YEAR}}}"
else
    JSON_PAYLOAD="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"fetch-dataset-geography\",\"arguments\":{\"dataset\":\"$DATASET\"}}}"
fi

# Change to project directory
cd "$PROJECT_DIR"

# Ensure services are running
docker compose --profile prod up -d >/dev/null 2>&1
sleep 3

if [ "$JSON_ONLY" = false ]; then
    echo "Fetching geography levels for dataset: $DATASET$([ -n "$YEAR" ] && echo " (year: $YEAR)")"
fi

echo "$JSON_PAYLOAD" | \
docker exec -i -e CENSUS_API_KEY="$CENSUS_API_KEY" mcp-server node dist/index.js