#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Try to use existing container first
if docker exec mcp-server test -f /app/dist/index.js 2>/dev/null; then
    # Container exists and is ready, use it
    exec docker exec -i -e CENSUS_API_KEY="$CENSUS_API_KEY" mcp-server node dist/index.js
else
    # Container doesn't exist or isn't ready, start services and create new container
    docker-compose up -d >/dev/null 2>&1
    sleep 3  # Give services time to start
    exec docker-compose run --rm -T -e CENSUS_API_KEY="$CENSUS_API_KEY" mcp-server node dist/index.js
fi