import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('geographies', { zip_code_tabulation_area: 'char(5)' })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('geographies', ['zip_code_tabulation_area'])
}
