exports.up = (pgm) => {
  // Function to automatically update the updated_at timestamp
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Function to generate a SHA-256 hash for cache keys
  pgm.sql(`
    CREATE OR REPLACE FUNCTION generate_cache_hash(
        dataset_code TEXT,
        year INTEGER,
        variables TEXT[],
        geography_spec JSONB
    )
    RETURNS TEXT AS $$
    BEGIN
        RETURN encode(
            digest(
                dataset_code || year::TEXT || array_to_string(variables, ',') || geography_spec::TEXT,
                'sha256'
            ),
            'hex'
        );
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS generate_cache_hash(TEXT, INTEGER, TEXT[], JSONB)');
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column()');
};