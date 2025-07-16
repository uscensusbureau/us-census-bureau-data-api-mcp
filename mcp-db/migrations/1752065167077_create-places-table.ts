import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create places table - unified table for both geographic places and census geographies
  pgm.createTable('places', {
    id: { type: 'bigserial', primaryKey: true },
    
    // Human-readable place information
    name: { type: 'varchar(255)', notNull: true },
    full_name: { type: 'varchar(500)' },
    
    // Geographic hierarchy and classification
    place_type: { type: 'varchar(100)', notNull: true }, // 'state', 'county', 'city', 'tract', 'block-group', etc.
    state_code: { type: 'char(2)' },
    state_name: { type: 'varchar(100)' },
    county_code: { type: 'varchar(3)' },
    county_name: { type: 'varchar(100)' },
    
    // Official census codes and identifiers
    fips_code: { type: 'varchar(15)' }, // Full FIPS code (state+county+place)
    census_geoid: { type: 'varchar(20)' }, // Census Geography ID (e.g., '1600000US4805000')
    geography_code: { type: 'varchar(20)' }, // Census-specific code (e.g., '48' for Texas state)
    
    // Hierarchical relationships
    parent_place_id: { type: 'bigint', references: 'places(id)' }, 
    // Points to parent geography (e.g., county->state->division->region, place->state, block->block groups->tracts, etc.)
    
    // Geographic and demographic data
    latitude: { type: 'decimal(10, 7)' },
    longitude: { type: 'decimal(11, 7)' },
    population: { type: 'integer' },
    land_area_sqkm: { type: 'decimal(12, 4)' },
    water_area_sqkm: { type: 'decimal(12, 4)' },
    elevation_meters: { type: 'integer' },
    
    // Metadata
    year: { type: 'integer', default: 2022 }, // Data vintage year
    is_active: { type: 'boolean', default: true },
    data_source: { type: 'varchar(100)' }, // 'census_api', 'gazetteer', 'manual', etc.
    
    // Timestamps
    created_at: { type: 'timestamp with time zone', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp with time zone', default: pgm.func('NOW()') },
    
    // Change tracking for geographic code changes
    predecessor_geoid: { type: 'varchar(20)' }, // Previous census_geoid if this place's code changed
    successor_geoid: { type: 'varchar(20)' },   // New census_geoid if this place's code changed
    geoid_change_reason: { type: 'varchar(100)' } // 'incorporation', 'merger', 'boundary_change', etc.
  });

  // Add unique constraints to ensure unique combinations
  pgm.addConstraint('places', 'places_census_geoid_year_unique', 'UNIQUE(census_geoid, year)');
  pgm.addConstraint('places', 'places_geography_code_type_year_unique', 'UNIQUE(geography_code, place_type, year)');
};

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('places');
};