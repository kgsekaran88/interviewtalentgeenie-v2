#!/bin/bash
# Database Backup Script for InterviewAI
# This script creates manual backups of critical database tables

set -e

# Configuration
PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-self-hosted}"
SUPABASE_URL="${VITE_SUPABASE_URL}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/database/$DATE"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}Error: Required environment variables not set${NC}"
    echo "Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}=== InterviewAI Database Backup ===${NC}"
echo "Backup Location: $BACKUP_DIR"
echo "Timestamp: $DATE"
echo ""

# Function to backup a table
backup_table() {
    local table_name=$1
    local select_query=${2:-"*"}
    
    echo -e "${YELLOW}Backing up table: $table_name...${NC}"
    
    curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/${table_name}?select=${select_query}" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        > "$BACKUP_DIR/${table_name}.json"
    
    if [ $? -eq 0 ]; then
        local count=$(jq '. | length' "$BACKUP_DIR/${table_name}.json" 2>/dev/null || echo "unknown")
        echo -e "${GREEN}✓ Backed up $table_name ($count records)${NC}"
    else
        echo -e "${RED}✗ Failed to backup $table_name${NC}"
    fi
}

# Backup critical tables
echo "Backing up critical tables..."
echo ""

backup_table "profiles" "id,email,full_name,role,created_at"
backup_table "user_roles" "*"
backup_table "interviews" "*"
backup_table "questions" "*"
backup_table "interview_attempts" "*"
backup_table "attempt_questions" "*"
backup_table "proctoring_sessions" "id,interview_attempt_id,recording_url,status,created_at,updated_at"
backup_table "proctoring_events" "*"
backup_table "learning_assessments" "*"
backup_table "learning_assessment_questions" "*"
backup_table "learning_assessment_attempts" "*"
backup_table "learning_plans" "*"
backup_table "skill_assessments" "*"
backup_table "audit_logs" "*"
backup_table "organizations" "*"
backup_table "organization_subscriptions" "*"

# Backup storage bucket metadata
echo ""
echo -e "${YELLOW}Backing up storage metadata...${NC}"

curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/objects?select=*" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    > "$BACKUP_DIR/storage_objects.json"

echo -e "${GREEN}✓ Storage metadata backed up${NC}"

# Create backup manifest
echo ""
echo -e "${YELLOW}Creating backup manifest...${NC}"

cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "backup_date": "$DATE",
  "project_id": "$PROJECT_ID",
  "backup_type": "manual",
  "tables": [
    "profiles",
    "user_roles",
    "interviews",
    "questions",
    "interview_attempts",
    "attempt_questions",
    "proctoring_sessions",
    "proctoring_events",
    "learning_assessments",
    "learning_assessment_questions",
    "learning_assessment_attempts",
    "learning_plans",
    "skill_assessments",
    "audit_logs",
    "organizations",
    "organization_subscriptions"
  ],
  "storage_buckets": [
    "documentation",
    "proctoring-recordings"
  ]
}
EOF

echo -e "${GREEN}✓ Manifest created${NC}"

# Create compressed archive
echo ""
echo -e "${YELLOW}Creating compressed archive...${NC}"

cd ./backups/database
tar -czf "${DATE}.tar.gz" "$DATE"
ARCHIVE_SIZE=$(du -h "${DATE}.tar.gz" | cut -f1)

echo -e "${GREEN}✓ Archive created: ${DATE}.tar.gz ($ARCHIVE_SIZE)${NC}"

# Cleanup old backups (keep last 30 days)
echo ""
echo -e "${YELLOW}Cleaning up old backups...${NC}"

find ./backups/database -name "*.tar.gz" -type f -mtime +30 -delete 2>/dev/null || true
find ./backups/database -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true

echo -e "${GREEN}✓ Old backups cleaned up${NC}"

# Summary
echo ""
echo -e "${GREEN}=== Backup Complete ===${NC}"
echo "Location: $BACKUP_DIR"
echo "Archive: ${DATE}.tar.gz"
echo "Size: $ARCHIVE_SIZE"
echo ""
echo -e "${YELLOW}Important: Store this backup in a secure, off-site location${NC}"
echo ""

# Optional: Upload to cloud storage
# Uncomment and configure for your cloud provider
# echo "Uploading to cloud storage..."
# aws s3 cp "${DATE}.tar.gz" s3://your-backup-bucket/interviewai/
# echo "✓ Uploaded to S3"

exit 0
