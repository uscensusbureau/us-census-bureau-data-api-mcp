exports.up = (pgm) => {
  // Enable UUID generation for request IDs
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Enable full-text search capabilities
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm');
};

exports.down = (pgm) => {};