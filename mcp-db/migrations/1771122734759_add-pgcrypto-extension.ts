import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP EXTENSION IF EXISTS pgcrypto`)
}
