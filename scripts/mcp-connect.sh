#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR" || exit

# Start production services (won't restart if already running)
docker compose --profile prod up -d >/dev/null 2>&1

# Wait a moment for services to be ready
sleep 3

# Check if the existing container can be used
if docker exec mcp-server test -f /app/dist/index.js 2>/dev/null; then
    # Container exists and is ready, use it
    exec docker exec -i -e CENSUS_API_KEY="$CENSUS_API_KEY" mcp-server node dist/index.js
else
    # Fall back to run command
    exec docker compose --profile prod run --rm -T -e CENSUS_API_KEY="$CENSUS_API_KEY" mcp-server node dist/index.js
fi
