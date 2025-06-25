CREATE TABLE geography_relationships (
    id BIGSERIAL PRIMARY KEY,
    parent_place_id BIGINT REFERENCES places(id) ON DELETE CASCADE,
    child_place_id BIGINT REFERENCES places(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- 'contains', 'part_of', 'adjacent_to'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(parent_place_id, child_place_id, relationship_type)
);