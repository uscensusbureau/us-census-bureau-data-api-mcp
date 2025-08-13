--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 16.9 (Debian 16.9-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: cleanup_expired_cache(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_cache() RETURNS integer
    LANGUAGE plpgsql
    AS $$
  DECLARE
    deleted_count INTEGER;
  BEGIN
    DELETE FROM census_data_cache 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
  END;
  $$;


--
-- Name: fuzzy_search_places(text, real, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fuzzy_search_places(search_term text, similarity_threshold real DEFAULT 0.3, limit_results integer DEFAULT 10) RETURNS TABLE(id bigint, name character varying, full_name character varying, place_type character varying, state_code character, similarity_score real)
    LANGUAGE plpgsql
    AS $$
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
  $$;


--
-- Name: generate_cache_hash(text, integer, text[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_cache_hash(dataset_code text, year integer, variables text[], geography_spec jsonb) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    BEGIN
        RETURN encode(
            digest(
                dataset_code || year::TEXT || array_to_string(variables, ',') || geography_spec::TEXT,
                'sha256'
            ),
            'hex'
        );
    END;
    $$;


--
-- Name: get_cache_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cache_stats() RETURNS TABLE(total_entries bigint, expired_entries bigint, cache_size_mb numeric, most_accessed_dataset character varying, avg_response_size_kb numeric)
    LANGUAGE plpgsql
    AS $$
  BEGIN
    RETURN QUERY
    SELECT 
      COUNT(*) as total_entries,
      COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_entries,
      ROUND(
        SUM(octet_length(response_data::text))::NUMERIC / (1024 * 1024), 
        2
      ) as cache_size_mb,
      (
        SELECT dataset_code 
        FROM census_data_cache 
        GROUP BY dataset_code 
        ORDER BY COUNT(*) DESC 
        LIMIT 1
      ) as most_accessed_dataset,
      ROUND(
        AVG(octet_length(response_data::text))::NUMERIC / 1024, 
        2
      ) as avg_response_size_kb
    FROM census_data_cache;
  END;
  $$;


--
-- Name: optimize_database(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.optimize_database() RETURNS text
    LANGUAGE plpgsql
    AS $$
  DECLARE
    result_message TEXT;
  BEGIN
    -- Analyze all tables to update statistics
    ANALYZE places;
    ANALYZE census_data_cache;
    
    -- Vacuum to reclaim space
    VACUUM places;
    VACUUM census_data_cache;
    
    result_message := 'Database optimization completed at ' || NOW()::TEXT;
    
    RETURN result_message;
  END;
  $$;


--
-- Name: resolve_geography_by_coordinates(numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_geography_by_coordinates(input_latitude numeric, input_longitude numeric, max_distance_km numeric DEFAULT 50.0) RETURNS TABLE(id bigint, name character varying, place_type character varying, state_code character, distance_km numeric)
    LANGUAGE plpgsql
    AS $$
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
  $$;


--
-- Name: search_places(text, character, text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_places(search_term text, state_filter character DEFAULT NULL::bpchar, place_types text[] DEFAULT NULL::text[], limit_results integer DEFAULT 10) RETURNS TABLE(id bigint, name character varying, full_name character varying, place_type character varying, state_code character, county_name character varying, fips_code character varying, latitude numeric, longitude numeric, population integer, rank real)
    LANGUAGE plpgsql
    AS $$
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
  $$;


--
-- Name: update_cache_accessed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cache_accessed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        -- Only update if the last_accessed is more than 1 hour old to avoid too many updates
        IF OLD.last_accessed < NOW() - INTERVAL '1 hour' THEN
            NEW.last_accessed = NOW();
        END IF;
        RETURN NEW;
    END;
    $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: census_data_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.census_data_cache (
    id bigint NOT NULL,
    request_hash character varying(64) NOT NULL,
    dataset_code character varying(50) NOT NULL,
    year integer NOT NULL,
    variables text[],
    geography_spec jsonb NOT NULL,
    response_data jsonb NOT NULL,
    row_count integer,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    last_accessed timestamp with time zone DEFAULT now()
);


--
-- Name: census_data_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.census_data_cache_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: census_data_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.census_data_cache_id_seq OWNED BY public.census_data_cache.id;


--
-- Name: geographies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geographies (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    full_name character varying(500),
    state_code character(2),
    state_name character varying(100),
    county_code character varying(3),
    county_name character varying(100),
    fips_code character varying(15),
    census_geoid character varying(20),
    ucgid_code character varying(20),
    parent_geography_id bigint,
    latitude numeric(10,7),
    longitude numeric(11,7),
    population integer,
    land_area_sqkm numeric(12,4),
    water_area_sqkm numeric(12,4),
    elevation_meters integer,
    year integer DEFAULT 2022,
    is_active boolean DEFAULT true,
    data_source character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    predecessor_geoid character varying(20),
    successor_geoid character varying(20),
    geoid_change_reason character varying(100),
    summary_level_id bigint,
    for_param character varying(25),
    in_param character varying(25),
    summary_level_code character varying(3)
);


--
-- Name: summary_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.summary_levels (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    get_variable character varying(20) NOT NULL,
    query_name character varying(255) NOT NULL,
    on_spine boolean NOT NULL,
    parent_summary_level_id bigint,
    code text,
    parent_summary_level text
);


--
-- Name: geography_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.geography_levels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: geography_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.geography_levels_id_seq OWNED BY public.summary_levels.id;


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: places_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.places_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: places_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.places_id_seq OWNED BY public.geographies.id;


--
-- Name: census_data_cache id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.census_data_cache ALTER COLUMN id SET DEFAULT nextval('public.census_data_cache_id_seq'::regclass);


--
-- Name: geographies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geographies ALTER COLUMN id SET DEFAULT nextval('public.places_id_seq'::regclass);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: summary_levels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.summary_levels ALTER COLUMN id SET DEFAULT nextval('public.geography_levels_id_seq'::regclass);


--
-- Name: census_data_cache census_data_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.census_data_cache
    ADD CONSTRAINT census_data_cache_pkey PRIMARY KEY (id);


--
-- Name: census_data_cache census_data_cache_request_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.census_data_cache
    ADD CONSTRAINT census_data_cache_request_hash_key UNIQUE (request_hash);


--
-- Name: geographies geographies_fips_code_year_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geographies
    ADD CONSTRAINT geographies_fips_code_year_unique UNIQUE (fips_code, year);


--
-- Name: summary_levels geography_levels_get_variable_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.summary_levels
    ADD CONSTRAINT geography_levels_get_variable_key UNIQUE (get_variable);


--
-- Name: summary_levels geography_levels_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.summary_levels
    ADD CONSTRAINT geography_levels_name_key UNIQUE (name);


--
-- Name: summary_levels geography_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.summary_levels
    ADD CONSTRAINT geography_levels_pkey PRIMARY KEY (id);


--
-- Name: summary_levels geography_levels_query_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.summary_levels
    ADD CONSTRAINT geography_levels_query_name_key UNIQUE (query_name);


--
-- Name: summary_levels geography_levels_summary_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.summary_levels
    ADD CONSTRAINT geography_levels_summary_level_key UNIQUE (code);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: geographies places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geographies
    ADD CONSTRAINT places_pkey PRIMARY KEY (id);


--
-- Name: census_data_cache_dataset_code_year_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX census_data_cache_dataset_code_year_index ON public.census_data_cache USING btree (dataset_code, year);


--
-- Name: census_data_cache_expires_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX census_data_cache_expires_at_index ON public.census_data_cache USING btree (expires_at);


--
-- Name: census_data_cache_last_accessed_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX census_data_cache_last_accessed_index ON public.census_data_cache USING btree (last_accessed);


--
-- Name: census_data_cache_request_hash_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX census_data_cache_request_hash_index ON public.census_data_cache USING btree (request_hash);


--
-- Name: geographies_fips_code_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geographies_fips_code_index ON public.geographies USING btree (fips_code);


--
-- Name: geographies_latitude_longitude_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geographies_latitude_longitude_index ON public.geographies USING btree (latitude, longitude);


--
-- Name: geographies_parent_geography_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geographies_parent_geography_id_index ON public.geographies USING btree (parent_geography_id);


--
-- Name: geographies_state_code_county_code_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geographies_state_code_county_code_index ON public.geographies USING btree (state_code, county_code);


--
-- Name: geographies_state_code_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geographies_state_code_index ON public.geographies USING btree (state_code);


--
-- Name: geographies_summary_level_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geographies_summary_level_id_index ON public.geographies USING btree (summary_level_id);


--
-- Name: geographies_ucgid_code_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geographies_ucgid_code_index ON public.geographies USING btree (ucgid_code);


--
-- Name: geographies_year_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geographies_year_index ON public.geographies USING btree (year);


--
-- Name: geography_levels_parent_summary_level_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geography_levels_parent_summary_level_index ON public.summary_levels USING btree (parent_summary_level);


--
-- Name: geography_levels_summary_level_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geography_levels_summary_level_index ON public.summary_levels USING btree (code);


--
-- Name: idx_census_data_cache_geography; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_census_data_cache_geography ON public.census_data_cache USING gin (geography_spec);


--
-- Name: idx_geographies_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geographies_active ON public.geographies USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_geographies_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geographies_full_name ON public.geographies USING gin (to_tsvector('english'::regconfig, (full_name)::text));


--
-- Name: idx_geographies_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geographies_name ON public.geographies USING gin (to_tsvector('english'::regconfig, (name)::text));


--
-- Name: idx_geographies_population; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geographies_population ON public.geographies USING btree (population DESC) WHERE (population IS NOT NULL);


--
-- Name: idx_geographies_predecessor_geoid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geographies_predecessor_geoid ON public.geographies USING btree (predecessor_geoid) WHERE (predecessor_geoid IS NOT NULL);


--
-- Name: idx_geographies_successor_geoid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geographies_successor_geoid ON public.geographies USING btree (successor_geoid) WHERE (successor_geoid IS NOT NULL);


--
-- Name: summary_levels_parent_summary_level_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX summary_levels_parent_summary_level_id_index ON public.summary_levels USING btree (parent_summary_level_id);


--
-- Name: census_data_cache update_census_data_cache_accessed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_census_data_cache_accessed BEFORE UPDATE OF response_data ON public.census_data_cache FOR EACH ROW EXECUTE FUNCTION public.update_cache_accessed();


--
-- Name: geographies update_geographies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_geographies_updated_at BEFORE UPDATE ON public.geographies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: summary_levels geography_levels_parent_geography_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.summary_levels
    ADD CONSTRAINT geography_levels_parent_geography_level_id_fkey FOREIGN KEY (parent_summary_level_id) REFERENCES public.summary_levels(id);


--
-- Name: geographies places_geography_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geographies
    ADD CONSTRAINT places_geography_level_id_fkey FOREIGN KEY (summary_level_id) REFERENCES public.summary_levels(id);


--
-- Name: geographies places_parent_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geographies
    ADD CONSTRAINT places_parent_place_id_fkey FOREIGN KEY (parent_geography_id) REFERENCES public.geographies(id);


--
-- PostgreSQL database dump complete
--

