#!/bin/bash
# Backup Verification Script for InterviewAI
# Verifies backup integrity and completeness

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${1:-./backups/database}"

echo -e "${BLUE}=== InterviewAI Backup Verification ===${NC}"
echo "Backup Directory: $BACKUP_DIR"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Error: Backup directory not found: $BACKUP_DIR${NC}"
    exit 1
fi

# Find all backup directories
BACKUPS=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "2*" | sort -r)
BACKUP_COUNT=$(echo "$BACKUPS" | wc -l)

echo -e "${GREEN}Found $BACKUP_COUNT backup(s)${NC}"
echo ""

# Verify each backup
for backup in $BACKUPS; do
    backup_name=$(basename "$backup")
    echo -e "${YELLOW}Verifying backup: $backup_name${NC}"
    
    # Check for manifest
    if [ -f "$backup/manifest.json" ]; then
        echo -e "${GREEN}  ✓ Manifest found${NC}"
        
        # Extract backup date
        backup_date=$(jq -r '.backup_date' "$backup/manifest.json")
        backup_type=$(jq -r '.backup_type' "$backup/manifest.json")
        echo "    Date: $backup_date"
        echo "    Type: $backup_type"
    else
        echo -e "${RED}  ✗ Manifest missing${NC}"
    fi
    
    # Check for table backups
    local table_count=0
    local missing_tables=()
    
    for table in profiles user_roles interviews questions interview_attempts proctoring_sessions; do
        if [ -f "$backup/${table}.json" ]; then
            local records=$(jq '. | length' "$backup/${table}.json" 2>/dev/null || echo "0")
            ((table_count++))
            echo -e "${GREEN}  ✓ $table ($records records)${NC}"
        else
            missing_tables+=("$table")
            echo -e "${RED}  ✗ $table (missing)${NC}"
        fi
    done
    
    # Calculate backup size
    if [ -d "$backup" ]; then
        backup_size=$(du -sh "$backup" | cut -f1)
        echo "  Size: $backup_size"
    fi
    
    # Check for compressed archive
    if [ -f "$BACKUP_DIR/${backup_name}.tar.gz" ]; then
        archive_size=$(du -h "$BACKUP_DIR/${backup_name}.tar.gz" | cut -f1)
        echo -e "${GREEN}  ✓ Archive: ${backup_name}.tar.gz ($archive_size)${NC}"
    else
        echo -e "${YELLOW}  ⚠ No compressed archive found${NC}"
    fi
    
    # Calculate backup age
    if [ -f "$backup/manifest.json" ]; then
        backup_timestamp=$(date -d "$backup_date" +%s 2>/dev/null || echo "0")
        current_timestamp=$(date +%s)
        age_seconds=$((current_timestamp - backup_timestamp))
        age_hours=$((age_seconds / 3600))
        age_days=$((age_hours / 24))
        
        echo "  Age: $age_days days, $((age_hours % 24)) hours"
        
        if [ $age_hours -gt 24 ]; then
            echo -e "${YELLOW}  ⚠ Backup is older than 24 hours${NC}"
        fi
    fi
    
    echo ""
done

# Check backup freshness
echo -e "${BLUE}=== Backup Health Summary ===${NC}"
echo ""

LATEST_BACKUP=$(echo "$BACKUPS" | head -1)
if [ -n "$LATEST_BACKUP" ]; then
    latest_name=$(basename "$LATEST_BACKUP")
    echo "Latest Backup: $latest_name"
    
    if [ -f "$LATEST_BACKUP/manifest.json" ]; then
        latest_date=$(jq -r '.backup_date' "$LATEST_BACKUP/manifest.json")
        latest_timestamp=$(date -d "${latest_date:0:8} ${latest_date:9:2}:${latest_date:11:2}:${latest_date:13:2}" +%s 2>/dev/null || echo "0")
        current_timestamp=$(date +%s)
        hours_since=$((($current_timestamp - $latest_timestamp) / 3600))
        
        if [ $hours_since -lt 25 ]; then
            echo -e "${GREEN}✓ Backup is fresh (${hours_since} hours old)${NC}"
        else
            echo -e "${RED}✗ Backup is stale (${hours_since} hours old)${NC}"
            echo -e "${YELLOW}  Recommendation: Run backup-database.sh${NC}"
        fi
    fi
fi

# Storage summary
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo "Total Backup Storage: $TOTAL_SIZE"

# Recommendations
echo ""
echo -e "${BLUE}=== Recommendations ===${NC}"
echo ""

if [ $BACKUP_COUNT -lt 7 ]; then
    echo -e "${YELLOW}⚠ Less than 7 backups found. Consider running daily backups.${NC}"
fi

if [ $BACKUP_COUNT -gt 30 ]; then
    echo -e "${YELLOW}⚠ More than 30 backups found. Consider cleaning up old backups.${NC}"
fi

echo -e "${GREEN}✓ Schedule regular backups using cron:${NC}"
echo "  0 2 * * * /path/to/scripts/backup-database.sh"
echo ""
echo -e "${GREEN}✓ Test restoration monthly:${NC}"
echo "  ./scripts/restore-database.sh ./backups/database/YYYYMMDD_HHMMSS"
echo ""

exit 0
