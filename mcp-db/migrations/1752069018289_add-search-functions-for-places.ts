import { MigrationBuilder } from 'node-pg-migrate'

export const searchPlacesSql = `
  CREATE OR REPLACE FUNCTION search_places(
      search_term TEXT,
      state_filter CHAR(2) DEFAULT NULL,
      place_types TEXT[] DEFAULT NULL,
      limit_results INTEGER DEFAULT 10
  )
  RETURNS TABLE (
      id BIGINT,
      name VARCHAR(255),
      full_name VARCHAR(500),
      place_type VARCHAR(50),
      state_code CHAR(2),
      county_name VARCHAR(100),
      fips_code VARCHAR(15),
      latitude DECIMAL(10, 7),
      longitude DECIMAL(11, 7),
      population INTEGER,
      rank REAL
  ) AS $$
  BEGIN
      RETURN QUERY
      SELECT 
          p.id,
          p.name,
          p.full_name,
          p.place_type,
          p.state_code,
          p.county_name,
          p.fips_code,
          p.latitude,
          p.longitude,
          p.population,
          ts_rank(to_tsvector('english', p.name || ' ' || COALESCE(p.full_name, '')), 
                  plainto_tsquery('english', search_term)) as rank
      FROM places p
      WHERE 
          to_tsvector('english', p.name || ' ' || COALESCE(p.full_name, '')) @@ plainto_tsquery('english', search_term)
          AND (state_filter IS NULL OR p.state_code = state_filter)
          AND (place_types IS NULL OR p.place_type = ANY(place_types))
      ORDER BY 
          rank DESC,
          p.population DESC NULLS LAST
      LIMIT limit_results;
  END;
  $$ LANGUAGE plpgsql;
`

export const fuzzySearchPlacesSql = `
  CREATE OR REPLACE FUNCTION fuzzy_search_places(
      search_term TEXT,
      similarity_threshold REAL DEFAULT 0.3,
      limit_results INTEGER DEFAULT 10
  )
  RETURNS TABLE (
      id BIGINT,
      name VARCHAR(255),
      full_name VARCHAR(500),
      place_type VARCHAR(50),
      state_code CHAR(2),
      similarity_score REAL
  ) AS $$
  BEGIN
      RETURN QUERY
      SELECT 
          p.id,
          p.name,
          p.full_name,
          p.place_type,
          p.state_code,
          similarity(p.name, search_term) as similarity_score
      FROM places p
      WHERE 
          similarity(p.name, search_term) > similarity_threshold
          OR similarity(COALESCE(p.full_name, ''), search_term) > similarity_threshold
      ORDER BY 
          similarity_score DESC,
          p.population DESC NULLS LAST
      LIMIT limit_results;
  END;
  $$ LANGUAGE plpgsql;
`

export const geoCoordinateSearchSql = `
  CREATE OR REPLACE FUNCTION resolve_geography_by_coordinates(
    input_latitude DECIMAL(10, 7),
    input_longitude DECIMAL(11, 7),
    max_distance_km DECIMAL DEFAULT 50.0
  )
  RETURNS TABLE (
    id BIGINT,
    name VARCHAR(255),
    place_type VARCHAR(50),
    state_code CHAR(2),
    distance_km DECIMAL
  ) AS $$
  BEGIN
    RETURN QUERY
    SELECT 
      p.id,
      p.name,
      p.place_type,
      p.state_code,
      -- Simple distance calculation (for more accuracy, use PostGIS)
      (6371 * acos(
        cos(radians(input_latitude)) * 
        cos(radians(p.latitude)) * 
        cos(radians(p.longitude) - radians(input_longitude)) + 
        sin(radians(input_latitude)) * 
        sin(radians(p.latitude))
      ))::DECIMAL as distance_km
    FROM places p
    WHERE 
      p.latitude IS NOT NULL 
      AND p.longitude IS NOT NULL
      AND (6371 * acos(
        cos(radians(input_latitude)) * 
        cos(radians(p.latitude)) * 
        cos(radians(p.longitude) - radians(input_longitude)) + 
        sin(radians(input_latitude)) * 
        sin(radians(p.latitude))
      )) <= max_distance_km
    ORDER BY distance_km ASC
    LIMIT 10;
  END;
  $$ LANGUAGE plpgsql;
`

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(searchPlacesSql)

  // Function to find places by partial name match (fuzzy search)
  pgm.sql(fuzzySearchPlacesSql)

  // Function to resolve geography by coordinates (reverse geocoding)
  pgm.sql(geoCoordinateSearchSql)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(
    'DROP FUNCTION IF EXISTS resolve_geography_by_coordinates(DECIMAL, DECIMAL, DECIMAL)',
  )
  pgm.sql('DROP FUNCTION IF EXISTS fuzzy_search_places(TEXT, REAL, INTEGER)')
  pgm.sql('DROP FUNCTION IF EXISTS search_places(TEXT, CHAR, TEXT[], INTEGER)')
}
