# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

US Census Bureau Data API MCP - A Model Context Protocol server that connects AI assistants with Census Bureau data. Built with TypeScript, PostgreSQL, and Docker.

## Key Architecture

### MCP Server Pattern
- **Entry point**: `mcp-server/src/index.ts` - Registers all tools and prompts
- **Server class**: `mcp-server/src/server.ts` - MCPServer handles protocol requests
- **Tool pattern**: All tools extend `BaseTool<T>` abstract class with Zod validation
- **Registry pattern**: `ToolRegistry` and `PromptRegistry` manage instances
- **Service layer**: Database and API interactions through services in `mcp-server/src/services/`

### Database Architecture
- PostgreSQL 16 with custom functions for geographic search
- Migrations in `mcp-db/migrations/` using node-pg-migrate
- Seeding scripts in `mcp-db/src/seeds/` cache Census data locally
- Connection through `mcp-db/src/helpers/database.ts`

### Docker Multi-Profile Setup
- `dev` profile: Development with hot-reload
- `prod` profile: Production-optimized
- `test` profile: Isolated testing environment

## Common Development Commands

### Building and Running
```bash
# Development environment
docker compose --profile dev up

# Production build and seed
docker compose --profile prod up --build -d
docker compose --profile prod run --rm census-mcp-db-init sh -c "npm run migrate:up && npm run seed"

# Build TypeScript (in mcp-server/)
npm run build

# Watch mode for development (in mcp-server/)
npm run watch
```

### Testing
```bash
# Run all tests (in mcp-server/ or mcp-db/)
npm test

# Run with coverage (in mcp-server/)
npm run test:coverage

# Run specific test file
npm test -- path/to/test.spec.ts
```

### Database Operations
```bash
# Create new migration (in mcp-db/)
npm run migrate:create -- migration-name

# Run migrations (in mcp-db/)
npm run migrate:up

# Rollback migrations (in mcp-db/)
npm run migrate:down

# Seed database (in mcp-db/)
npm run seed
```

### Code Quality
```bash
# Lint code (in mcp-server/)
npm run lint

# Format code (in mcp-server/)
npm run format

# Check formatting (in mcp-server/)
npm run format:check
```

## Testing Approach

- **Framework**: Vitest with 85% coverage requirements
- **Unit tests**: Run in parallel, test individual components
- **Integration tests**: Run sequentially, test full workflows with API
- **Database tests**: 30-second timeout, use test database
- **Test files**: `*.spec.ts` for unit, `*.integration.spec.ts` for integration

## Adding New Features

### Adding a New Tool
1. Create new class in `mcp-server/src/tools/` extending `BaseTool<T>`
2. Define Zod schema for validation in constructor
3. Implement `execute()` method with business logic
4. Register in `mcp-server/src/index.ts` ToolRegistry
5. Add tests in `mcp-server/tests/tools/`

### Adding a New Prompt
1. Create new class in `mcp-server/src/prompts/` extending `BasePrompt`
2. Implement required methods
3. Register in `mcp-server/src/index.ts` PromptRegistry
4. Add tests in `mcp-server/tests/prompts/`

### Database Schema Changes
1. Create migration: `npm run migrate:create -- descriptive-name`
2. Implement up/down functions in generated file
3. Update seed scripts if needed in `mcp-db/src/seeds/`
4. Run migration: `npm run migrate:up`

## Environment Requirements

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 16 (handled by Docker)
- Census API key in `CENSUS_API_KEY` environment variable

## CI/CD Pipeline

GitHub Actions workflows:
- `build.yml`: Tests NPM and Docker builds
- `lint.yml`: Runs ESLint checks
- `test.yml`: Runs MCP server tests
- `test-db.yml`: Runs database tests

All workflows must pass for PR merge.