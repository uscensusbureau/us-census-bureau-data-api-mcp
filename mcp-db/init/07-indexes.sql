-- Indexes for places table
CREATE INDEX idx_places_name ON places USING gin(to_tsvector('english', name));
CREATE INDEX idx_places_full_name ON places USING gin(to_tsvector('english', full_name));
CREATE INDEX idx_places_state_code ON places (state_code);
CREATE INDEX idx_places_county_code ON places (state_code, county_code);
CREATE INDEX idx_places_place_type ON places (place_type);
CREATE INDEX idx_places_fips_code ON places (fips_code);
CREATE INDEX idx_places_census_geoid ON places (census_geoid);
CREATE INDEX idx_places_geography_code ON places (geography_code, place_type);
CREATE INDEX idx_places_parent ON places (parent_place_id);
CREATE INDEX idx_places_location ON places (latitude, longitude);
CREATE INDEX idx_places_population ON places (population DESC) WHERE population IS NOT NULL;
CREATE INDEX idx_places_year ON places (year);
CREATE INDEX idx_places_active ON places (is_active) WHERE is_active = true;
CREATE INDEX idx_places_hierarchy ON places (place_type, state_code, county_code);
CREATE INDEX idx_places_predecessor_geoid ON places (predecessor_geoid) WHERE predecessor_geoid IS NOT NULL;
CREATE INDEX idx_places_successor_geoid ON places (successor_geoid) WHERE successor_geoid IS NOT NULL;

-- Indexes for census_data_cache table
CREATE INDEX idx_census_data_cache_hash ON census_data_cache (request_hash);
CREATE INDEX idx_census_data_cache_dataset_year ON census_data_cache (dataset_code, year);
CREATE INDEX idx_census_data_cache_expires ON census_data_cache (expires_at);
CREATE INDEX idx_census_data_cache_accessed ON census_data_cache (last_accessed);
CREATE INDEX idx_census_data_cache_geography ON census_data_cache USING gin(geography_spec);

-- Indexes for place_aliases table
CREATE INDEX idx_place_aliases_name ON place_aliases USING gin(to_tsvector('english', alias_name));
CREATE INDEX idx_place_aliases_place_id ON place_aliases (place_id);
CREATE INDEX idx_place_aliases_type ON place_aliases (alias_type);

-- Indexes for geography_relationships table
CREATE INDEX idx_geography_relationships_parent ON geography_relationships (parent_place_id);
CREATE INDEX idx_geography_relationships_child ON geography_relationships (child_place_id);
CREATE INDEX idx_geography_relationships_type ON geography_relationships (relationship_type);