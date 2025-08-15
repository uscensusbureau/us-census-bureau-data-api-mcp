import { MigrationBuilder } from 'node-pg-migrate'

// Export these for testing
export const yearsArgs = {
  id: { type: 'bigserial', primaryKey: true },
  year: {
    type: 'integer',
    notNull: true,
    unique: true,
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

export const geoYearsArgs = {
  id: { type: 'bigserial', primaryKey: true },
  geography_id: {
    type: 'bigint',
    notNull: true,
    references: 'geographies(id)',
    onDelete: 'CASCADE',
  },
  year_id: {
    type: 'bigint',
    notNull: true,
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
  pgm.createTable('years', {
    ...yearsArgs,
    created_at: {
      ...yearsArgs.created_at,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      ...yearsArgs.updated_at,
      default: pgm.func('NOW()'),
    },
  })

  pgm.createTable('geography_years', {
    ...geoYearsArgs,
    created_at: {
      ...geoYearsArgs.created_at,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      ...geoYearsArgs.updated_at,
      default: pgm.func('NOW()'),
    },
  })

  pgm.addConstraint(
    'geography_years',
    'geography_years_unique',
    'UNIQUE(geography_id, year_id)',
  )

  pgm.createIndex('geography_years', 'geography_id')
  pgm.createIndex('geography_years', 'year_id')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('geography_years')
  pgm.dropTable('years')
}
