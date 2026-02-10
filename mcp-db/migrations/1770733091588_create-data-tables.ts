import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate'

export const dataTableArgs = (pgm: MigrationBuilder): ColumnDefinitions => ({
  id: { type: 'bigserial', primaryKey: true },
  data_table_id: { type: 'varchar(10)', notNull: true, unique: true },
  label: { type: 'text', notNull: true },
  created_at: {
    type: 'timestamp',
    notNull: true,
    default: pgm.func('current_timestamp'),
  },
  updated_at: {
    type: 'timestamp',
    notNull: true,
    default: pgm.func('current_timestamp'),
  },
})

export const dataTableDatasetArgs = (
  pgm: MigrationBuilder,
): ColumnDefinitions => ({
  id: { type: 'bigserial', primaryKey: true },
  dataset_id: {
    type: 'bigint',
    notNull: true,
    references: 'datasets(id)',
    onDelete: 'CASCADE',
  },
  data_table_id: {
    type: 'bigint',
    notNull: true,
    references: 'data_tables(id)',
    onDelete: 'CASCADE',
  },
  created_at: {
    type: 'timestamp',
    notNull: true,
    default: pgm.func('current_timestamp'),
  },
  updated_at: {
    type: 'timestamp',
    notNull: true,
    default: pgm.func('current_timestamp'),
  },
})

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('data_tables', dataTableArgs(pgm))
  pgm.createTable('data_table_datasets', dataTableDatasetArgs(pgm))

  pgm.createIndex('data_table_datasets', 'data_table_id')

  pgm.addConstraint('data_table_datasets', 'data_table_datasets_unique', {
    unique: ['dataset_id', 'data_table_id'],
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('data_table_datasets')
  pgm.dropTable('data_tables')
}
