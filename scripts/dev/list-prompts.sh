#!/bin/bash

# List Prompts Helper Script
# This script wraps the prompts/list command to list available MCP prompts

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
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Change to project directory
cd "$PROJECT_DIR" || exit

# Ensure services are running
docker compose --profile prod up -d >/dev/null 2>&1
sleep 3

if [ "$JSON_ONLY" = false ]; then
    echo "Listing available MCP prompts..."
fi

echo '{"jsonrpc":"2.0","id":1,"method":"prompts/list"}' | \
docker exec -i mcp-server node dist/index.js