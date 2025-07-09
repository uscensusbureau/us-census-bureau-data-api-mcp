exports.up = (pgm) => {
  // Indexes for places table
  pgm.sql("CREATE INDEX idx_places_name ON places USING gin(to_tsvector('english', name))"); // eslint-disable-line quotes
  pgm.sql("CREATE INDEX idx_places_full_name ON places USING gin(to_tsvector('english', full_name))"); // eslint-disable-line quotes
  pgm.createIndex('places', 'state_code');
  pgm.createIndex('places', ['state_code', 'county_code']);
  pgm.createIndex('places', 'place_type');
  pgm.createIndex('places', 'fips_code');
  pgm.createIndex('places', 'census_geoid');
  pgm.createIndex('places', ['geography_code', 'place_type']);
  pgm.createIndex('places', 'parent_place_id');
  pgm.createIndex('places', ['latitude', 'longitude']);
  pgm.sql('CREATE INDEX idx_places_population ON places (population DESC) WHERE population IS NOT NULL');
  pgm.createIndex('places', 'year');
  pgm.sql('CREATE INDEX idx_places_active ON places (is_active) WHERE is_active = true');
  pgm.createIndex('places', ['place_type', 'state_code', 'county_code']);
  pgm.sql('CREATE INDEX idx_places_predecessor_geoid ON places (predecessor_geoid) WHERE predecessor_geoid IS NOT NULL');
  pgm.sql('CREATE INDEX idx_places_successor_geoid ON places (successor_geoid) WHERE successor_geoid IS NOT NULL');

  // Indexes for census_data_cache table
  pgm.createIndex('census_data_cache', 'request_hash');
  pgm.createIndex('census_data_cache', ['dataset_code', 'year']);
  pgm.createIndex('census_data_cache', 'expires_at');
  pgm.createIndex('census_data_cache', 'last_accessed');
  pgm.sql('CREATE INDEX idx_census_data_cache_geography ON census_data_cache USING gin(geography_spec)');
};

exports.down = (pgm) => {
  // Drop indexes (they'll be dropped automatically when tables are dropped)
  pgm.sql('DROP INDEX IF EXISTS idx_places_name');
  pgm.sql('DROP INDEX IF EXISTS idx_places_full_name');
  pgm.sql('DROP INDEX IF EXISTS idx_places_population');
  pgm.sql('DROP INDEX IF EXISTS idx_places_active');
  pgm.sql('DROP INDEX IF EXISTS idx_places_predecessor_geoid');
  pgm.sql('DROP INDEX IF EXISTS idx_places_successor_geoid');
};