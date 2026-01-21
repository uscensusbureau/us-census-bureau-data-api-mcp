import { MigrationBuilder } from 'node-pg-migrate'

export const datasetTopicsArgs = (pgm: MigrationBuilder) => ({
  id: {
    type: 'serial',
    primaryKey: true,
  },
  dataset_id: {
    type: 'bigint',
    references: 'datasets(id)',
    onDelete: 'CASCADE' as const,
    notNull: true,
  },
  topic_id: {
    type: 'bigint',
    references: 'topics(id)',
    onDelete: 'CASCADE' as const,
    notNull: true,
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
  pgm.createTable('dataset_topics', datasetTopicsArgs(pgm))

  pgm.addConstraint(
    'dataset_topics',
    'dataset_topics_unique',
    'UNIQUE(dataset_id, topic_id)',
  )

  pgm.createIndex('dataset_topics', 'dataset_id')
  pgm.createIndex('dataset_topics', 'topic_id')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('dataset_topics')
}
