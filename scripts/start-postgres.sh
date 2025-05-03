#!/bin/bash

# Start PostgreSQL container with pgvector extension
docker run --name staycrest-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=staycrest \
  -p 5432:5432 \
  -d pgvector/pgvector:pg15
  
echo "PostgreSQL container started with pgvector extension"
echo "Connection string: postgresql://postgres:postgres@localhost:5432/staycrest"

# Wait for PostgreSQL to start
echo "Waiting for PostgreSQL to start..."
sleep 5

# Create logs directory
mkdir -p logs

# Run database initialization
echo "Initializing database..."
node server/database/init_db.js 