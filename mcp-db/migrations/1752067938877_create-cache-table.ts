import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('census_data_cache', {
    id: { type: 'bigserial', primaryKey: true },
    request_hash: { type: 'varchar(64)', notNull: true, unique: true },
    dataset_code: { type: 'varchar(50)', notNull: true },
    year: { type: 'integer', notNull: true },
    variables: { type: 'text[]' },
    geography_spec: { type: 'jsonb', notNull: true },
    response_data: { type: 'jsonb', notNull: true },
    row_count: { type: 'integer' },
    expires_at: { type: 'timestamp with time zone' },
    created_at: {
      type: 'timestamp with time zone',
      default: pgm.func('NOW()'),
    },
    last_accessed: {
      type: 'timestamp with time zone',
      default: pgm.func('NOW()'),
    },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('census_data_cache')
}
