-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM census_data_cache 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE (
    total_entries BIGINT,
    expired_entries BIGINT,
    cache_size_mb NUMERIC,
    most_accessed_dataset VARCHAR(50),
    avg_response_size_kb NUMERIC
) AS $$
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
$$ LANGUAGE plpgsql;

-- Function to optimize database tables
CREATE OR REPLACE FUNCTION optimize_database()
RETURNS TEXT AS $$
DECLARE
    result_message TEXT;
BEGIN
    -- Analyze all tables to update statistics
    ANALYZE places;
    ANALYZE census_data_cache;
    ANALYZE place_aliases;
    ANALYZE geography_relationships;
    
    -- Vacuum to reclaim space
    VACUUM places;
    VACUUM census_data_cache;
    
    result_message := 'Database optimization completed at ' || NOW()::TEXT;
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql;