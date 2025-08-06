import { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Trigger to automatically update the updated_at column for places
  pgm.sql(`
    CREATE TRIGGER update_places_updated_at 
        BEFORE UPDATE ON places 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
  `)

  // Function and trigger to update last_accessed timestamp when cache is read
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_cache_accessed()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Only update if the last_accessed is more than 1 hour old to avoid too many updates
        IF OLD.last_accessed < NOW() - INTERVAL '1 hour' THEN
            NEW.last_accessed = NOW();
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  pgm.sql(`
    CREATE TRIGGER update_census_data_cache_accessed
        BEFORE UPDATE OF response_data ON census_data_cache
        FOR EACH ROW 
        EXECUTE FUNCTION update_cache_accessed();
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(
    'DROP TRIGGER IF EXISTS update_census_data_cache_accessed ON census_data_cache',
  )
  pgm.sql('DROP TRIGGER IF EXISTS update_places_updated_at ON places')
  pgm.sql('DROP FUNCTION IF EXISTS update_cache_accessed()')
}
