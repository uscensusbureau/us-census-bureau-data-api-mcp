-- Enable UUID generation for request IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search capabilities
CREATE EXTENSION IF NOT EXISTS pg_trgm;