#!/bin/bash
set -e

echo "=== Initializing BackendBhai Databases ==="

# Create databases if they do not exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE devtools' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'devtools')\gexec
    SELECT 'CREATE DATABASE ecommerce' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce')\gexec
    GRANT ALL PRIVILEGES ON DATABASE devtools TO "$POSTGRES_USER";
    GRANT ALL PRIVILEGES ON DATABASE ecommerce TO "$POSTGRES_USER";
EOSQL

echo "Applying devtools migrations..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "devtools" -f /docker-entrypoint-initdb.d/devtools/001_initial.sql

echo "Applying ecommerce migrations and seed data..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "ecommerce" -f /docker-entrypoint-initdb.d/ecommerce/001_initial.sql

echo "=== Database initialization complete ==="
