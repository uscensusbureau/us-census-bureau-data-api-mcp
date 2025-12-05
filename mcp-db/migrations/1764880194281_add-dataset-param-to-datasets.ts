import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('datasets', {
    dataset_param: {
      type: 'varchar(100)',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: true,
    },
  })

  pgm.addConstraint(
    'datasets',
    'datasets_dataset_id_unique',
    'UNIQUE(dataset_id)',
  )
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('datasets', ['dataset_param', 'description'])
  pgm.dropConstraint('datasets', 'datasets_dataset_id_unique')
}
