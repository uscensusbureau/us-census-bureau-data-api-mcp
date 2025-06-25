CREATE TABLE places (
    id BIGSERIAL PRIMARY KEY,
    
    -- Human-readable place information
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(500),
    
    -- Geographic hierarchy and classification
    place_type VARCHAR(50) NOT NULL, -- 'state', 'county', 'city', 'tract', 'block-group', etc.
    state_code CHAR(2),
    state_name VARCHAR(100),
    county_code VARCHAR(3),
    county_name VARCHAR(100),
    
    -- Official census codes and identifiers
    fips_code VARCHAR(15), -- Full FIPS code (state+county+place)
    census_geoid VARCHAR(20), -- Census Geography ID (e.g., '1600000US4805000')
    geography_code VARCHAR(20), -- Census-specific code (e.g., '48' for Texas state)
    
    -- Hierarchical relationships
    parent_place_id BIGINT REFERENCES places(id), -- Points to parent geography (city -> county -> state)
    
    -- Geographic and demographic data
    latitude DECIMAL(10, 7),
    longitude DECIMAL(11, 7),
    population INTEGER,
    land_area_sqkm DECIMAL(12, 4),
    water_area_sqkm DECIMAL(12, 4),
    elevation_meters INTEGER,
    
    -- Metadata
    year INTEGER NOT NULL, -- Data vintage year
    timezone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    data_source VARCHAR(100), -- 'census_api', 'gazetteer', 'manual', etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Change tracking for geographic code changes
    predecessor_geoid VARCHAR(20), -- Previous census_geoid if this place's code changed
    successor_geoid VARCHAR(20),   -- New census_geoid if this place's code changed
    geoid_change_reason VARCHAR(100), -- 'incorporation', 'merger', 'boundary_change', etc.
    
    -- Ensure unique combinations
    UNIQUE(census_geoid, year),
    UNIQUE(geography_code, place_type, year)
);