import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Enable UUID generation for request IDs
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

  // Enable full-text search capabilities
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm')
}

export async function down(): Promise<void> {}
