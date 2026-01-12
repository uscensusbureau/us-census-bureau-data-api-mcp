import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  // This migration deletes existing datasets due to a breaking change.
  // The new 'type' column adds a notNull constraint that requires removing these records.
  //
  // After running:
  // Follow Step 2 to reseed datasets with type and temporal coverage:
  // https://github.com/uscensusbureau/us-census-bureau-data-api-mcp?tab=readme-ov-file#using-the-mcp-server

  pgm.sql('DELETE FROM datasets')

  pgm.addColumns('datasets', {
    type: {
      type: 'varchar(30)',
      notNull: true,
      check: "type IN ('aggregate', 'microdata', 'timeseries')",
    },
    temporal_start: {
      type: 'date',
    },
    temporal_end: {
      type: 'date',
    },
  })

  pgm.addConstraint('datasets', 'valid_temporal_range', {
    check:
      'temporal_start IS NULL OR temporal_end IS NULL OR temporal_start <= temporal_end',
  })
  pgm.createIndex('datasets', 'type')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('datasets', 'valid_temporal_range', { ifExists: true })
  pgm.dropColumns('datasets', ['type', 'temporal_start', 'temporal_end'])
}
