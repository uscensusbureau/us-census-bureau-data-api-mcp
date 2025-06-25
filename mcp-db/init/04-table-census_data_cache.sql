CREATE TABLE census_data_cache (
    id BIGSERIAL PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of the request parameters
    dataset_code VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    variables TEXT[], -- Array of requested variables
    geography_spec JSONB NOT NULL, -- Geography specification (for/in parameters)
    response_data JSONB NOT NULL, -- Cached API response
    row_count INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);