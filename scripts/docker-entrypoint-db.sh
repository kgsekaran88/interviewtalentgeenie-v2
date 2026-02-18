#!/bin/bash
# =============================================================================
# Custom Docker entrypoint for PostgreSQL with migration support
# This script runs migrations after PostgreSQL is ready
# =============================================================================

set -e

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    echo "Waiting for PostgreSQL to be ready..."
    until pg_isready -h localhost -U ${POSTGRES_USER:-postgres}; do
        sleep 1
    done
    echo "PostgreSQL is ready!"
}

# Run migrations
run_migrations() {
    echo "Running database migrations..."
    
    MIGRATION_DIR="/docker-entrypoint-migrations.d"
    
    if [ -d "$MIGRATION_DIR" ]; then
        for f in $(ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | sort); do
            filename=$(basename "$f")
            echo "Executing migration: $filename"

            # Preflight: avoid CREATE OR REPLACE return-type conflicts for get_user_roles
            if [ "$filename" = "20251227010001_production_functions.sql" ]; then
                echo "Preflight: dropping public.get_user_roles(uuid) to avoid return type conflict"
                psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-postgres} -c "DROP FUNCTION IF EXISTS public.get_user_roles(uuid);" || true
            fi

            psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-postgres} -f "$f"
        done
        echo "Migrations complete!"
    else
        echo "No migrations directory found at $MIGRATION_DIR"
    fi
}

# Start PostgreSQL in the background
docker-entrypoint.sh postgres &

# Wait and run migrations
wait_for_postgres
run_migrations

# Keep the script running
wait
