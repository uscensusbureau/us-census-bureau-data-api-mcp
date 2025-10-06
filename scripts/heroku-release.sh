#!/bin/bash

# Heroku release phase script
# This runs during the release phase after build but before the app starts

set -e

echo "Starting Heroku release phase..."

# Navigate to mcp-db directory
cd mcp-db

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing mcp-db dependencies..."
  npm install
fi

# Run database migrations
echo "Running database migrations..."
npm run migrate:up

# Run seeding based on SEED_MODE environment variable
if [ "$SEED_MODE" = "full" ]; then
  echo "Running full database seed..."
  npm run seed
elif [ "$SEED_MODE" = "lite" ]; then
  echo "Running lite database seed..."
  # You may need to create a lite seed script
  npm run seed || echo "Seed script not critical, continuing..."
else
  echo "Skipping database seeding (SEED_MODE not set)"
fi

echo "Release phase completed successfully!"