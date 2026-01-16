import { MigrationBuilder } from 'node-pg-migrate'

export const topicsTableArgs = (pgm: MigrationBuilder) => ({
  id: { type: 'bigserial', primaryKey: true },
  name: { type: 'varchar(255)', notNull: true },
  topic_string: { type: 'varchar(255)', notNull: true, unique: true },
  parent_topic_string: { type: 'varchar(255)' },
  description: { type: 'text', notNull: true },
  parent_topic_id: {
    type: 'bigint',
    references: 'topics(id)',
    onDelete: 'SET NULL' as const,
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
  pgm.createTable('topics', topicsTableArgs(pgm))
  pgm.createIndex('topics', 'parent_topic_id')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('topics', { cascade: true })
}
