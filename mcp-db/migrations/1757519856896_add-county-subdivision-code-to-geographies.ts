import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('geographies', { county_subdivision_code: 'char(5)' })
  pgm.alterColumn('geographies', 'for_param', { type: 'varchar(100)' })
  pgm.alterColumn('geographies', 'in_param', { type: 'varchar(100)' })
  pgm.alterColumn('geographies', 'ucgid_code', { type: 'varchar(25)' })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('geographies', ['county_subdivision_code'])
  pgm.alterColumn('geographies', 'for_param', { type: 'varchar(25)' })
  pgm.alterColumn('geographies', 'in_param', { type: 'varchar(25)' })
  pgm.alterColumn('geographies', 'ucgid_code', { type: 'varchar(20)' })
}
