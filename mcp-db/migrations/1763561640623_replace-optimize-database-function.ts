import { MigrationBuilder } from 'node-pg-migrate'

export const optimizeDatabaseSql = `
  CREATE OR REPLACE FUNCTION optimize_database()
  RETURNS TEXT AS $$
  DECLARE
    result_message TEXT;
  BEGIN
    -- Analyze all tables to update statistics
    ANALYZE geographies;
    ANALYZE geography_years;
    ANALYZE census_data_cache;
    
    -- Vacuum to reclaim space
    VACUUM geographies;
    VACUUM geography_years;
    VACUUM census_data_cache;
    
    result_message := 'Database optimization completed at ' || NOW()::TEXT;
    
    RETURN result_message;
  END;
  $$ LANGUAGE plpgsql;
`

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(optimizeDatabaseSql)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP FUNCTION IF EXISTS optimize_database()')
  // Dropping here as the old function targets the outdated `places` table
}
