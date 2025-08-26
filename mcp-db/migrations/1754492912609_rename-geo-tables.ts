import { MigrationBuilder } from 'node-pg-migrate'

export const placesTrigger = `
  CREATE TRIGGER update_places_updated_at 
    BEFORE UPDATE ON places 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
`

export const geographiesTrigger = `
	CREATE TRIGGER update_geographies_updated_at 
    BEFORE UPDATE ON geographies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
`

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Drop Trigger for Places
  pgm.sql('DROP TRIGGER IF EXISTS update_places_updated_at ON places')

  // Drop Indexes
  pgm.dropIndex('geography_levels', 'parent_geography_level_id')
  pgm.dropIndex('places', 'geography_level_id')
  pgm.dropIndex('places', 'state_code')
  pgm.dropIndex('places', ['state_code', 'county_code'])
  pgm.dropIndex('places', 'fips_code')
  pgm.dropIndex('places', 'census_geoid')
  pgm.dropIndex('places', 'parent_place_id')
  pgm.dropIndex('places', ['latitude', 'longitude'])
  pgm.dropIndex('places', 'year')
  pgm.sql('DROP INDEX IF EXISTS idx_places_name')
  pgm.sql('DROP INDEX IF EXISTS idx_places_full_name')
  pgm.sql('DROP INDEX IF EXISTS idx_places_population')
  pgm.sql('DROP INDEX IF EXISTS idx_places_active')
  pgm.sql('DROP INDEX IF EXISTS idx_places_predecessor_geoid')
  pgm.sql('DROP INDEX IF EXISTS idx_places_successor_geoid')

  // Drop Constraints
  pgm.dropConstraint(
    'places',
    'places_geography_level_year_geography_code_unique',
  )
  pgm.dropConstraint('places', 'places_census_geoid_year_unique')

  // Rename geography_code to ucgid_code
  pgm.renameColumn('places', 'geography_code', 'ucgid_code')
  pgm.renameColumn('places', 'parent_place_id', 'parent_geography_id')

  // Rename Tables
  pgm.renameTable('places', 'geographies')
  pgm.renameTable('geography_levels', 'summary_levels')

  // Rename Relational Columns
  pgm.renameColumn('geographies', 'geography_level_id', 'summary_level_id')
  pgm.renameColumn(
    'summary_levels',
    'parent_geography_level_id',
    'parent_summary_level_id',
  )

  // Create New Indexes for Renamed Columns
  pgm.createIndex('summary_levels', 'parent_summary_level_id')
  pgm.createIndex('geographies', 'summary_level_id')
  pgm.sql(
    "CREATE INDEX idx_geographies_name ON geographies USING gin(to_tsvector('english', name))",
  )
  pgm.sql(
    "CREATE INDEX idx_geographies_full_name ON geographies USING gin(to_tsvector('english', full_name))",
  )
  pgm.createIndex('geographies', 'state_code')
  pgm.createIndex('geographies', ['state_code', 'county_code'])
  pgm.createIndex('geographies', 'fips_code')
  pgm.createIndex('geographies', 'ucgid_code')
  pgm.createIndex('geographies', 'parent_geography_id')
  pgm.createIndex('geographies', ['latitude', 'longitude'])
  pgm.sql(
    'CREATE INDEX idx_geographies_population ON geographies (population DESC) WHERE population IS NOT NULL',
  )
  pgm.createIndex('geographies', 'year')
  pgm.sql(
    'CREATE INDEX idx_geographies_active ON geographies (is_active) WHERE is_active = true',
  )
  pgm.sql(
    'CREATE INDEX idx_geographies_predecessor_geoid ON geographies (predecessor_geoid) WHERE predecessor_geoid IS NOT NULL',
  )
  pgm.sql(
    'CREATE INDEX idx_geographies_successor_geoid ON geographies (successor_geoid) WHERE successor_geoid IS NOT NULL',
  )

  // Create New Constraint
  pgm.addConstraint(
    'geographies',
    'geographies_fips_code_year_unique',
    'UNIQUE(fips_code, year)',
  )

  // Create New Trigger for Geographies
  pgm.sql(geographiesTrigger)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop Trigger for Geographies
  pgm.sql('DROP TRIGGER IF EXISTS update_geographies_updated_at ON geographies')

  // Drop New Indexes for Renamed Columns
  pgm.dropIndex('summary_levels', 'parent_summary_level_id')
  pgm.dropIndex('geographies', 'summary_level_id')
  pgm.dropIndex('geographies', 'state_code')
  pgm.dropIndex('geographies', ['state_code', 'county_code'])
  pgm.dropIndex('geographies', 'fips_code')
  pgm.dropIndex('geographies', 'ucgid_code')
  pgm.dropIndex('geographies', 'parent_geography_id')
  pgm.dropIndex('geographies', ['latitude', 'longitude'])
  pgm.dropIndex('geographies', 'year')
  pgm.sql('DROP INDEX IF EXISTS idx_geographies_name')
  pgm.sql('DROP INDEX IF EXISTS idx_geographies_full_name')
  pgm.sql('DROP INDEX IF EXISTS idx_geographies_population')
  pgm.sql('DROP INDEX IF EXISTS idx_geographies_active')
  pgm.sql('DROP INDEX IF EXISTS idx_geographies_predecessor_geoid')
  pgm.sql('DROP INDEX IF EXISTS idx_geographies_successor_geoid')

  // Drop New Constraint
  pgm.dropConstraint('geographies', 'geographies_fips_code_year_unique')

  // Rename Relational Columns to Original Names
  pgm.renameColumn('geographies', 'summary_level_id', 'geography_level_id')
  pgm.renameColumn(
    'summary_levels',
    'parent_summary_level_id',
    'parent_geography_level_id',
  )

  // Rename Tables to Original Names
  pgm.renameTable('geographies', 'places')
  pgm.renameTable('summary_levels', 'geography_levels')

  // Rename Geo Code Column
  pgm.renameColumn('places', 'ucgid_code', 'geography_code')
  pgm.renameColumn('places', 'parent_geography_id', 'parent_place_id')

  // Add Old Indexes
  pgm.createIndex('geography_levels', 'parent_geography_level_id')
  pgm.createIndex('places', 'geography_level_id')
  pgm.sql(
    "CREATE INDEX idx_places_name ON places USING gin(to_tsvector('english', name))",
  )
  pgm.sql(
    "CREATE INDEX idx_places_full_name ON places USING gin(to_tsvector('english', full_name))",
  )
  pgm.createIndex('places', 'state_code')
  pgm.createIndex('places', ['state_code', 'county_code'])
  pgm.createIndex('places', 'fips_code')
  pgm.createIndex('places', 'census_geoid')
  pgm.createIndex('places', 'parent_place_id')
  pgm.createIndex('places', ['latitude', 'longitude'])
  pgm.sql(
    'CREATE INDEX idx_places_population ON places (population DESC) WHERE population IS NOT NULL',
  )
  pgm.createIndex('places', 'year')
  pgm.sql(
    'CREATE INDEX idx_places_active ON places (is_active) WHERE is_active = true',
  )
  pgm.sql(
    'CREATE INDEX idx_places_predecessor_geoid ON places (predecessor_geoid) WHERE predecessor_geoid IS NOT NULL',
  )
  pgm.sql(
    'CREATE INDEX idx_places_successor_geoid ON places (successor_geoid) WHERE successor_geoid IS NOT NULL',
  )

  // Add Old Constraints
  pgm.addConstraint(
    'places',
    'places_geography_level_year_geography_code_unique',
    {
      unique: ['geography_level_id', 'year', 'geography_code'],
    },
  )
  pgm.addConstraint(
    'places',
    'places_census_geoid_year_unique',
    'UNIQUE(census_geoid, year)',
  )

  // Add Old Places Trigger
  pgm.sql(placesTrigger)
}
