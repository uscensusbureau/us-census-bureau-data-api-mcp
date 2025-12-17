import { MigrationBuilder } from 'node-pg-migrate'

export const importYearsSQL = `
    UPDATE years
    SET import_geographies = true
    WHERE year = ANY (ARRAY[2020, 2023]);
`

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('years', {
    import_geographies: {
      type: 'boolean',
      default: false,
      notNull: true
    },
  })
  pgm.sql(importYearsSQL)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('years', ['import_geographies'])
}
