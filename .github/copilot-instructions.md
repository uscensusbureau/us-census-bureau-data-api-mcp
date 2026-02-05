<Goals>
- Provide expert-level review of the repository's structure, technology stack, and critical patterns, with a focus on Model Context Protocol (MCP) best practices
- Highlight any non-obvious dependencies or architectural decisions that may impact code changes
- Ensure best practices are followed in terms of code organization, validation, and error handling
- Ensure architectural consistency across the codebase, especially in how MCP tools are implemented and how Census API interactions are handled
</Goals>

<HighLevelDetails>
This repository is a Model Context Protocol (MCP) server that provides AI-ready U.S. Census Bureau data.

**Technology Stack:**
- Language: TypeScript (Node.js runtime)
- API: U.S. Census Bureau API
- Database: PostgreSQL (for caching dataset metadata)
- Validation: Zod schemas
- Testing: Vitest
- Build: TypeScript compiler (tsc)
- Package Manager: npm
- Containerization: Docker & Docker Compose

**Repository Size:** Medium-sized TypeScript project with:
- MCP server application (mcp-server/)
- Database ETL service (mcp-db/)
- Multi-profile Docker Compose setup (dev/test/prod)
- Comprehensive test suite with unit and integration tests

**Project Purpose:** To enable use of official Census Bureau statistics with AI assistants, leveraging the Model Context Protocol to provide token-optimized data that reduces hallucinations.
</HighLevelDetails>

<BuildInstructions>
**Prerequisites:**
- Docker and Docker Compose installed
- Node.js 18+ (for local development outside Docker)

**Local Development Setup:**

The project uses Docker Compose with multiple profiles (dev, test, prod).

**Start Development Environment:**
```bash
docker compose --profile dev up
```
This starts:
- PostgreSQL database on port 5433
- Runs migrations automatically
- Leaves the dev container running for interactive commands

**Run Tests in Development:**
```bash
docker compose --profile dev exec census-mcp-db-dev-init npm run test
```

**Run Linter in Development:**
```bash
docker compose --profile dev exec census-mcp-db-dev-init npm run lint
```

**Run Tests (Standalone):**
```bash
docker compose --profile test up census-mcp-db-test-init
```
Starts test database and runs the test suite, then exits.

**Production Deployment:**
```bash
docker compose --profile prod up
```
Starts production services with MCP server on standard PostgreSQL port 5432.

**Validation:**
All validation (build, lint, tests) is handled by CI/GitHub Actions on pull requests.

**Important Notes:**
- The project is containerized - all services run in Docker
- Development uses port 5433, test uses 5434, prod uses 5432
- Database migrations run automatically on container startup
- The MCP server runs as a containerized service, not standalone
- Focus on writing correct code - let CI handle validation
- If modifying database schema, migrations will auto-run on next startup
</BuildInstructions>

<ProjectLayout>
**Directory Structure:**
```
/
├── mcp-db/                       # Database ETL service (CRITICAL - runs first)
│   ├── src/
│   │   ├── seeds                 # Orchestrates seeding process
│   │   │   ├── configs           # Configs for seeding different data types
│   │   │   ├── scripts           # Generic seeding utilities
│   │   │   │   ├── seed-runner   # Orchestrates seeding process
│   │   │   │   └── seed-database # Executes ETL pipeline
│   ├── migrations/               # Database schema migrations
│   ├── tests/                    # Test suite (mirrors src/)
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── eslint.config.js
├── mcp-server/                  # Main MCP server application
│   ├── src/
│   │   ├── tools/               # MCP tool implementations
│   │   │   ├── base.tool.ts
│   │   │   ├── fetch-aggregate-data.tool.ts
│   │   │   ├── fetch-dataset-geography.tool.ts
│   │   │   ├── list-datasets.tool.ts
│   │   │   └── resolve-geography-fips.tool.ts
│   │   ├── types/               # TypeScript definitions
│   │   ├── schema/              # Zod validation schemas
│   │   ├── prompts/             # MCP prompts
│   │   ├── services/            # Database service
│   │   ├── index.js             # Entry point
│   │   └── server.js
│   ├── tests/                   # Test suite (mirrors src/)
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── eslint.config.js
├── docker-compose.yml           # Multi-profile orchestration
```

**Configuration Files:**
- `mcp-server/tsconfig.json` - TypeScript strict mode, local development
- `mcp-server/tsconfig.docker.json` - TypeScript config for Docker builds
- `mcp-server/vitest.config.ts` - Test configuration with coverage
- `mcp-server/eslint.config.js` - Linting rules
- `mcp-server/.prettierrc` - Code formatting rules
- `mcp-db/Dockerfile` - Multi-stage build (dev/prod targets) for ETL service
- `mcp-db/tsconfig.json` - TypeScript config for database ETL
- `mcp-db/package.json` - Dependencies for migration and seeding
- `docker-compose.yml` - Multi-profile service orchestration (dev/test/prod)

**Key Architectural Elements:**

1. **MCP Database Service** (`mcp-db/`)
   - **CRITICAL:** Extracts, transforms, and loads (ETL) all Census metadata into PostgreSQL
   - Runs migrations and seeds database on container startup
   - Provides metadata used by all tools EXCEPT `fetch-aggregate-data` tool
   - Tools like `list-datasets`, `resolve-geography-fips`, and `fetch-dataset-geography` query this database
   - Must complete successfully before MCP server can start
   - Multi-stage Dockerfile (dev/prod targets)

2. **MCP Tools** (`mcp-server/src/tools/`)
   - `base.tool.ts` - Abstract base class for all tools
   - Each tool file implements one MCP tool following Model Context Protocol
   - Tools use Zod schemas for validation
   - **Data sources:**
     - `fetch-aggregate-data.tool.ts` - Queries Census API directly
     - All other tools - Query PostgreSQL database populated by mcp-db service

3. **Schemas** (`mcp-server/src/schema/`)
   - Zod validation schemas for all Census API responses
   - `validators.js` - Shared validation utilities
   - Each tool has a corresponding schema file

4. **Prompts** (`mcp-server/src/prompts/`)
   - MCP prompt implementations
   - `base.prompt.js` - Base prompt functionality
   - Example: `population.prompt.js` for population-related queries

5. **Services** (`mcp-server/src/services/`)
   - `database.service.js` - PostgreSQL connection and query handling
   - Used by most tools to retrieve metadata from database

6. **Testing Structure** (`mcp-server/tests/`)
   - Unit tests: `*.test.ts`
   - Integration tests: `*.integration.test.ts`
   - Test helpers in `tests/helpers/`
   - Mocks in `tests/mocks/`

**CI/CD Checks:**
- GitHub Actions workflows (not visible in tree, assumed present)
- Local validation via Docker Compose test profile
- All PRs must pass: build + lint + test suite

**Critical Patterns:**
- **Tool Naming:** All tools extend `base.tool.ts`
- **Schema Validation:** Every tool has a corresponding `.schema.js` file
- **Test Organization:** Tests mirror `src/` structure with unit + integration
- **FIPS Geography Codes:** Handled in `resolve-geography-fips.tool.ts`
- **Database Service:** Centralized in `database.service.js`

**Dependencies Not Obvious from Structure:**
- **mcp-db service MUST run successfully before mcp-server starts** - it populates the metadata database
- Most tools (`list-datasets`, `resolve-geography-fips`, `fetch-dataset-geography`) depend on database populated by mcp-db
- Only `fetch-aggregate-data` queries Census API directly - all other tools query PostgreSQL
- All tools depend on `base.tool.ts`
- Tools use schemas from `schema/` directory for validation
- Database connection managed by `database.service.js`
- Test utilities centralized in `tests/helpers/`

**Important Files:**
- `mcp-server/src/index.js` - MCP server entry point
- `mcp-server/src/server.js` - Server initialization and configuration
- `mcp-server/sample.env` - Required environment variables template
- `mcp-db/src/seeds/configs/*` - Config files for seeding different data types (datasets, geographies, variables)
- `mcp-db/src/seeds/scripts/seed-runner` - Orchestrates database seeding process
- `mcp-db/src/seeds/scripts/seed-database` - Executes ETL pipeline to populate metadata
- `docker-compose.yml` - Service orchestration with dev/test/prod profiles

**Trust These Instructions:**
The information above reflects the actual repository structure. Only search for additional information if these instructions are incomplete or incorrect for your specific task.
</ProjectLayout>