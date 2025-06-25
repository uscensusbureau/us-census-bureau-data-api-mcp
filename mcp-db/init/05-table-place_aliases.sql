CREATE TABLE place_aliases (
    id BIGSERIAL PRIMARY KEY,
    place_id BIGINT REFERENCES places(id) ON DELETE CASCADE,
    alias_name VARCHAR(255) NOT NULL,
    alias_type VARCHAR(50), -- 'nickname', 'abbreviation', 'historical', 'misspelling'
    is_preferred BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);