import { MigrationBuilder } from 'node-pg-migrate'

export const geographyLevelsArgs = {
  id: { type: 'bigserial', primaryKey: true },

  name: { type: 'varchar(255)', notNull: true, unique: true },
  description: { type: 'text', notNull: false },
  get_variable: { type: 'varchar(20)', notNull: true, unique: true },
  query_name: { type: 'varchar(255)', notNull: true, unique: true },
  on_spine: { type: 'boolean', notNull: true },

  parent_geography_level_id: {
    type: 'bigint',
    references: 'geography_levels(id)',
  },
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create geographic levels table - a table to describe and associate geographic levels
  pgm.createTable('geography_levels', geographyLevelsArgs)

  pgm.addColumns('places', {
    geography_level_id: { type: 'bigint', references: 'geography_levels(id)' },
  })

  pgm.dropColumns('places', ['place_type'])

  pgm.createIndex('geography_levels', 'parent_geography_level_id')
  pgm.createIndex('places', 'geography_level_id')

  pgm.addConstraint(
    'places',
    'places_geography_level_year_geography_code_unique',
    {
      unique: ['geography_level_id', 'year', 'geography_code'],
    },
  )
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('places', ['geography_level_id'])
  pgm.dropTable('geography_levels')

  pgm.addColumns('places', {
    place_type: { type: 'varchar(100)', notNull: true },
  })

  pgm.addConstraint(
    'places',
    'places_geography_code_type_year_unique',
    'UNIQUE(geography_code, place_type, year)',
  )
}
