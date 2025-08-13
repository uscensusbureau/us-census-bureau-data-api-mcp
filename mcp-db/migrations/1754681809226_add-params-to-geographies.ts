import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('geographies', {
    for_param: { type: 'varchar(25)', null: false }, // Store for query arguments
    in_param: 'varchar(25)', // Store in query arguments
    summary_level_code: 'varchar(3)', // Adds Summary Level Codes for mapping to summary_levels during import
  })

  pgm.renameColumn('summary_levels', 'summary_level', 'code') // Improved naming convention
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('geographies', {
    for_param: { type: 'varchar(25)', null: false },
    in_param: 'varchar(25)',
    summary_level_code: 'varchar(3)',
  })

  pgm.renameColumn('summary_levels', 'code', 'summary_level')
}
