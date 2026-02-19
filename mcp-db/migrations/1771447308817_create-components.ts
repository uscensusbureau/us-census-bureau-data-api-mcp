import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate'

export const programsArgs = (pgm: MigrationBuilder): ColumnDefinitions => ({
  id: { type: 'bigserial', primaryKey: true },
  label: { type: 'varchar(75)', notNull: true },
  description: { type: 'text' },
  acronym: { type: 'varchar(15)', notNull: true, unique: true },
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

export const componentsArgs = (pgm: MigrationBuilder): ColumnDefinitions => ({
  id: { type: 'bigserial', primaryKey: true },
  label: { type: 'text', notNull: true },
  component_id: { type: 'varchar(60)', notNull: true, unique: true },
  api_param: { type: 'varchar(60)', notNull: true, unique: true },
  description: { type: 'text', notNull: true },
  program_id: {
    type: 'bigint',
    notNull: true,
    references: 'programs(id)',
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
  pgm.createTable('programs', programsArgs(pgm))
  pgm.createTable('components', componentsArgs(pgm))

  pgm.createIndex('components', 'program_id')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('components')
  pgm.dropTable('programs')
}
