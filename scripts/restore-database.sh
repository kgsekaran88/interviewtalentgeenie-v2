#!/bin/bash
# Database Restore Script for InterviewAI
# WARNING: This will overwrite existing data. Use with caution!

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${VITE_SUPABASE_URL}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Check required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}Error: Required environment variables not set${NC}"
    echo "Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# Check if backup path provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: No backup path provided${NC}"
    echo "Usage: ./restore-database.sh <backup_directory>"
    echo "Example: ./restore-database.sh ./backups/database/20250109_120000"
    exit 1
fi

BACKUP_DIR=$1

# Verify backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Error: Backup directory not found: $BACKUP_DIR${NC}"
    exit 1
fi

# Verify manifest exists
if [ ! -f "$BACKUP_DIR/manifest.json" ]; then
    echo -e "${RED}Error: Invalid backup - manifest.json not found${NC}"
    exit 1
fi

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                    ⚠️  WARNING  ⚠️                         ║${NC}"
echo -e "${RED}║                                                            ║${NC}"
echo -e "${RED}║  This will OVERWRITE all data in your database!          ║${NC}"
echo -e "${RED}║  Make sure you have a current backup before proceeding.   ║${NC}"
echo -e "${RED}║                                                            ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Backup Location: $BACKUP_DIR"
echo ""
read -p "Are you sure you want to restore from this backup? (type 'YES' to continue): " -r
echo

if [ "$REPLY" != "YES" ]; then
    echo -e "${YELLOW}Restore cancelled.${NC}"
    exit 0
fi

echo -e "${GREEN}=== InterviewAI Database Restore ===${NC}"
echo "Backup: $BACKUP_DIR"
echo ""

# Function to restore a table
restore_table() {
    local table_name=$1
    local backup_file="$BACKUP_DIR/${table_name}.json"
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${YELLOW}⚠ Skipping $table_name (backup file not found)${NC}"
        return
    fi
    
    echo -e "${YELLOW}Restoring table: $table_name...${NC}"
    
    # Read the JSON array and insert each record
    local record_count=$(jq '. | length' "$backup_file")
    
    if [ "$record_count" -eq 0 ]; then
        echo -e "${YELLOW}⚠ No records to restore for $table_name${NC}"
        return
    fi
    
    # Clear existing data (optional - comment out if you want to merge)
    echo "  Clearing existing data..."
    curl -s -X DELETE \
        "${SUPABASE_URL}/rest/v1/${table_name}?id=neq.00000000-0000-0000-0000-000000000000" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        > /dev/null
    
    # Insert backed up data
    echo "  Inserting $record_count records..."
    curl -s -X POST \
        "${SUPABASE_URL}/rest/v1/${table_name}" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d @"$backup_file" \
        > /dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Restored $table_name ($record_count records)${NC}"
    else
        echo -e "${RED}✗ Failed to restore $table_name${NC}"
    fi
}

# Restore tables in dependency order
echo "Restoring tables..."
echo ""

# Core tables first
restore_table "profiles"
restore_table "user_roles"
restore_table "organizations"
restore_table "organization_subscriptions"

# Interview tables
restore_table "interviews"
restore_table "questions"
restore_table "interview_attempts"
restore_table "attempt_questions"

# Proctoring tables
restore_table "proctoring_sessions"
restore_table "proctoring_events"

# Learning tables
restore_table "learning_assessments"
restore_table "learning_assessment_questions"
restore_table "learning_assessment_attempts"
restore_table "learning_plans"
restore_table "skill_assessments"

# Audit table
restore_table "audit_logs"

echo ""
echo -e "${GREEN}=== Restore Complete ===${NC}"
echo ""
echo -e "${YELLOW}Important: Verify your data after restoration${NC}"
echo ""
echo "Run these verification queries:"
echo "  SELECT COUNT(*) FROM interviews;"
echo "  SELECT COUNT(*) FROM interview_attempts;"
echo "  SELECT COUNT(*) FROM profiles;"
echo ""

exit 0
