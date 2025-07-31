import { MigrationBuilder } from 'node-pg-migrate';

export const cleanupExpiredCacheSql = `
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
`;

export const getCacheStatsSql = `
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
`;

export const optimizeDatabaseSql = `
  CREATE OR REPLACE FUNCTION optimize_database()
  RETURNS TEXT AS $$
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
  $$ LANGUAGE plpgsql;
`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Function to clean expired cache entries
  pgm.sql(cleanupExpiredCacheSql);

  // Function to get cache statistics
  pgm.sql(getCacheStatsSql);

  // Function to optimize database tables
  pgm.sql(optimizeDatabaseSql);
};

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP FUNCTION IF EXISTS optimize_database()');
  pgm.sql('DROP FUNCTION IF EXISTS get_cache_stats()');
  pgm.sql('DROP FUNCTION IF EXISTS cleanup_expired_cache()');
};