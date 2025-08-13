import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addConstraint(
    'geographies',
    'geographies_ucgid_code_unique',
    'UNIQUE(ucgid_code)',
  )
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint(
    'geographies',
    'geographies_ucgid_code_unique',
    'UNIQUE(ucgid_code)',
  )
}
