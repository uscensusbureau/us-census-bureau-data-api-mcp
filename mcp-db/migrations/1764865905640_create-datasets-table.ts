import { MigrationBuilder } from 'node-pg-migrate'

export const datasetsArgs = {
  id: { type: 'bigserial', primaryKey: true },
  name: { type: 'varchar(255)', notNull: true },
  dataset_id: { type: 'varchar(255)', notNull: true },
  year_id: {
    type: 'bigint',
    references: 'years(id)',
    onDelete: 'CASCADE',
  },
  created_at: {
    type: 'timestamp with time zone',
    default: 'POSTGRES_FUNCTION(NOW())',
  },
  updated_at: {
    type: 'timestamp with time zone',
    default: 'POSTGRES_FUNCTION(NOW())',
  },
} as const

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('datasets', {
    ...datasetsArgs,
    created_at: {
      ...datasetsArgs.created_at,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      ...datasetsArgs.updated_at,
      default: pgm.func('NOW()'),
    },
  })

  pgm.createIndex('datasets', 'dataset_id')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('datasets')
}
