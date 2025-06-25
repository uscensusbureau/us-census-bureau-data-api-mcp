CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate a SHA-256 hash for cache keys
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