import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('geographies', { place_code: 'char(5)' })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('geographies', ['place_code'])
}
