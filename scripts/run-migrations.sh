#!/bin/bash
# =============================================================================
# TalentGeenie Database Migration Script
# Run migrations against an existing PostgreSQL database
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
MIGRATIONS_DIR="${MIGRATIONS_DIR:-./supabase/migrations}"
CUSTOM_MIGRATIONS_DIR="${CUSTOM_MIGRATIONS_DIR:-./migrations}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DRY_RUN="${DRY_RUN:-false}"

# Help message
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Run database migrations for TalentGeenie"
    echo ""
    echo "Options:"
    echo "  -h, --host        Database host (default: localhost)"
    echo "  -p, --port        Database port (default: 5432)"
    echo "  -d, --database    Database name (default: postgres)"
    echo "  -U, --user        Database user (default: postgres)"
    echo "  -W, --password    Database password"
    echo "  -m, --migrations  Migrations directory (default: ./supabase/migrations)"
    echo "  --dry-run         Show what would be executed without running"
    echo "  --help            Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, MIGRATIONS_DIR"
    echo ""
    echo "Example:"
    echo "  $0 -h db.example.com -d talentgeenie -U admin -W secretpass"
    echo "  DATABASE_URL=postgres://user:pass@host:5432/db $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            DB_HOST="$2"
            shift 2
            ;;
        -p|--port)
            DB_PORT="$2"
            shift 2
            ;;
        -d|--database)
            DB_NAME="$2"
            shift 2
            ;;
        -U|--user)
            DB_USER="$2"
            shift 2
            ;;
        -W|--password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        -m|--migrations)
            MIGRATIONS_DIR="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Parse DATABASE_URL if provided
if [ -n "$DATABASE_URL" ]; then
    # Extract components from DATABASE_URL
    # Format: postgres://user:password@host:port/database
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
fi

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN} TalentGeenie Database Migration${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "Host:       ${YELLOW}$DB_HOST${NC}"
echo -e "Port:       ${YELLOW}$DB_PORT${NC}"
echo -e "Database:   ${YELLOW}$DB_NAME${NC}"
echo -e "User:       ${YELLOW}$DB_USER${NC}"
echo -e "Migrations: ${YELLOW}$MIGRATIONS_DIR${NC}"
echo -e "Custom:     ${YELLOW}$CUSTOM_MIGRATIONS_DIR${NC}"
echo -e "Dry Run:    ${YELLOW}$DRY_RUN${NC}"
echo ""

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}Error: Migrations directory not found: $MIGRATIONS_DIR${NC}"
    exit 1
fi

# Count migration files (include optional custom patches)
MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql "$CUSTOM_MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -eq 0 ]; then
    echo -e "${RED}Error: No SQL migration files found in $MIGRATIONS_DIR or $CUSTOM_MIGRATIONS_DIR${NC}"
    exit 1
fi

echo -e "Found ${GREEN}$MIGRATION_COUNT${NC} migration files"
echo ""

# Create migration tracking table if it doesn't exist
TRACKING_SQL="
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(64)
);
"

# Function to calculate file checksum
get_checksum() {
    if command -v sha256sum &> /dev/null; then
        sha256sum "$1" | cut -d' ' -f1
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$1" | cut -d' ' -f1
    else
        echo "no-checksum"
    fi
}

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Build psql command
PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1"

# Test database connection
echo -e "Testing database connection..."
if ! $PSQL_CMD -c "SELECT 1" &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to database${NC}"
    echo "Please check your connection settings"
    exit 1
fi
echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
    echo ""
fi

# Create tracking table
if [ "$DRY_RUN" = false ]; then
    $PSQL_CMD -c "$TRACKING_SQL" &> /dev/null
fi

# Get list of already applied migrations
APPLIED_MIGRATIONS=$($PSQL_CMD -t -c "SELECT version FROM schema_migrations" 2>/dev/null || echo "")

# Process migrations in order
APPLIED=0
SKIPPED=0
FAILED=0

for migration_file in $(ls -1 "$MIGRATIONS_DIR"/*.sql "$CUSTOM_MIGRATIONS_DIR"/*.sql 2>/dev/null | awk -F/ '{print $NF "\t" $0}' | sort | cut -f2); do
    filename=$(basename "$migration_file")
    version="${filename%.sql}"
    checksum=$(get_checksum "$migration_file")
    
    # Check if migration was already applied
    if echo "$APPLIED_MIGRATIONS" | grep -q "$version"; then
        echo -e "${YELLOW}⊘ Skipping (already applied):${NC} $filename"
        ((SKIPPED++))
        continue
    fi
    
    echo -e "${GREEN}▶ Applying:${NC} $filename"
    
    # Preflight: avoid CREATE OR REPLACE return-type conflicts for get_user_roles
    # (applies to functions migration file)
    if [ "$filename" = "20251227000005_functions.sql" ]; then
        echo -e "  ${YELLOW}Preflight:${NC} dropping public.get_user_roles(uuid) to avoid return type conflict"
        $PSQL_CMD -c "DROP FUNCTION IF EXISTS public.get_user_roles(uuid);" &> /tmp/migration_output.txt || true
    fi
    
    if [ "$DRY_RUN" = true ]; then
        echo "  Would execute: $migration_file"
        ((APPLIED++))
        continue
    fi
    
    # Run the migration
    if $PSQL_CMD -f "$migration_file" &> /tmp/migration_output.txt; then
        # Record successful migration
        $PSQL_CMD -c "INSERT INTO schema_migrations (version, checksum) VALUES ('$version', '$checksum')" &> /dev/null
        echo -e "  ${GREEN}✓ Success${NC}"
        ((APPLIED++))
    else
        echo -e "  ${RED}✗ Failed${NC}"
        cat /tmp/migration_output.txt
        ((FAILED++))
        
        # Ask user if they want to continue
        if [ -t 0 ]; then
            read -p "Continue with remaining migrations? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                break
            fi
        else
            # Non-interactive mode, stop on first failure
            break
        fi
    fi
done

echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN} Migration Summary${NC}"
echo -e "${GREEN}=======================================${NC}"
echo -e "Applied: ${GREEN}$APPLIED${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Migration complete!${NC}"