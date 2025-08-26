import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('geographies', {
    region_code: { type: 'char(1)' },
    division_code: { type: 'char(1)' },
  })

  pgm.alterColumn('geographies', 'county_code', { type: 'char(3)' })

  pgm.createIndex('geographies', 'region_code')
  pgm.createIndex('geographies', 'division_code')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('geographies', {
    region_code: { type: 'char(1)' },
    division_code: { type: 'char(1)' },
  })

  pgm.alterColumn('geographies', 'county_code', { type: 'varchar(3)' })
}
