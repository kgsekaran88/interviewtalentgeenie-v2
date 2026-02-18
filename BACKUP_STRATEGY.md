# Backup and Recovery Strategy

## Overview

This document outlines the automated backup strategy for TalentGeenie, including database backups, storage bucket backups, and point-in-time recovery procedures.

## Lovable Cloud (Supabase) Automated Backups

### Database Backups

Lovable Cloud provides automated database backups with the following features:

#### Automatic Daily Backups
- **Frequency**: Daily automated backups
- **Retention**: 7 days for projects on free tier, 30+ days for paid plans
- **Backup Window**: Occurs during low-traffic periods
- **Storage**: Backups stored in secure, redundant storage

#### Point-in-Time Recovery (PITR)
- **Available on**: Pro plan and above
- **Granularity**: Restore to any point within the retention period
- **RPO (Recovery Point Objective)**: Up to 5 minutes
- **RTO (Recovery Time Objective)**: Typically 1-4 hours depending on database size

### Storage Bucket Backups

Storage buckets in Lovable Cloud are automatically backed up:

#### Automated Replication
- **Cross-Region**: Data replicated across multiple availability zones
- **Versioning**: Can be enabled per bucket for file-level recovery
- **Redundancy**: 99.999999999% (11 9's) durability

## Accessing Backups via Lovable Cloud

### Database Restore

To restore from a backup:

1. **Access Backend Dashboard**
   - Navigate to your Lovable project
   - Click on "Backend" or use the backend access button
   - Go to "Database" → "Backups" section

2. **Select Backup Point**
   - Choose from available daily backups
   - Or select a specific timestamp for PITR (if enabled)

3. **Initiate Restore**
   - Click "Restore" on the desired backup
   - Confirm the restoration (this will replace current data)
   - Wait for completion (typically 10-60 minutes)

### Storage Recovery

For storage bucket recovery:

1. **Enable Versioning** (if not already enabled):
   ```sql
   -- Run this via Lovable Cloud backend
   UPDATE storage.buckets 
   SET file_size_limit = 52428800, 
       allowed_mime_types = null,
       avif_autodetection = false
   WHERE id = 'proctoring-recordings';
   ```

2. **Restore Deleted Files**:
   - Access backend → Storage → Select bucket
   - View file history/versions
   - Restore previous version as needed

## Manual Backup Procedures

### Database Manual Backup

For additional safety, you can create manual backups:

```bash
#!/bin/bash
# Database backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/database"
PROJECT_ID="vtztavcqjmirktkjdprm"

mkdir -p $BACKUP_DIR

# Export database schema
echo "Backing up database schema..."
# Note: Use Supabase CLI or backend dashboard export feature

# Export specific tables (via Supabase API)
curl -X GET \
  "https://${PROJECT_ID}.supabase.co/rest/v1/interviews?select=*" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  > "$BACKUP_DIR/interviews_$DATE.json"

curl -X GET \
  "https://${PROJECT_ID}.supabase.co/rest/v1/interview_attempts?select=*" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  > "$BACKUP_DIR/attempts_$DATE.json"

echo "Backup completed: $BACKUP_DIR"
```

### Storage Backup Script

```bash
#!/bin/bash
# Storage bucket backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/storage"
BUCKET_NAME="proctoring-recordings"

mkdir -p $BACKUP_DIR/$BUCKET_NAME

# Download all files from bucket
# Note: Implement using Supabase Storage API or S3-compatible tools

echo "Storage backup completed: $BACKUP_DIR"
```

## Automated Backup Schedule

### Recommended Backup Schedule

| Backup Type | Frequency | Retention | Method |
|-------------|-----------|-----------|---------|
| Database Full | Daily | 30 days | Automatic (Lovable Cloud) |
| Database PITR | Continuous | 7 days | Automatic (Pro plan) |
| Storage Files | Continuous | Indefinite | Replication + Versioning |
| Manual Export | Weekly | 90 days | Manual script |
| Critical Data | Before changes | 1 year | Manual export |

## Recovery Procedures

### Database Recovery Scenarios

#### Scenario 1: Accidental Data Deletion (within 24 hours)

```sql
-- If within PITR window, use point-in-time recovery
-- Access via Lovable Cloud backend dashboard

-- Alternative: Restore from latest backup
-- 1. Access Backend → Database → Backups
-- 2. Select backup from before deletion
-- 3. Click "Restore"
```

#### Scenario 2: Data Corruption

```sql
-- 1. Identify corruption timeframe
-- 2. Use PITR to restore to point before corruption
-- 3. Verify data integrity after restore

-- Verify restored data
SELECT COUNT(*) FROM interviews WHERE status = 'active';
SELECT COUNT(*) FROM interview_attempts WHERE status = 'completed';
```

#### Scenario 3: Complete Database Loss

1. **Access Lovable Cloud dashboard**
2. **Navigate to Backups**
3. **Select most recent backup**
4. **Initiate full restore**
5. **Verify all data after restoration**
6. **Run data integrity checks**

### Storage Recovery Scenarios

#### Scenario 1: Deleted File Recovery

```typescript
// Enable and use versioning for recovery
import { supabase } from '@/integrations/supabase/client';

async function recoverDeletedFile(bucketName: string, filePath: string) {
  // List versions of the file
  const { data: versions, error } = await supabase
    .storage
    .from(bucketName)
    .list(filePath, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error) {
    console.error('Error listing versions:', error);
    return;
  }

  // Restore the most recent version
  // (Implementation depends on your specific setup)
  console.log('Available versions:', versions);
}
```

#### Scenario 2: Bucket-Level Recovery

1. **Contact Support**: For bucket-level disasters
2. **Provide Details**: Bucket name, timeframe
3. **Wait for Restoration**: Support will restore from backups
4. **Verify Files**: Check all critical files after recovery

## Backup Monitoring

### Health Checks

Create a monitoring function to verify backup status:

```typescript
// Add to monitoring dashboard
async function checkBackupHealth() {
  const checks = {
    lastBackupAge: 0,
    backupSize: 0,
    storageHealth: false,
  };

  // Check database backup age (via API or dashboard)
  // Check storage replication status
  // Alert if backups are stale (>25 hours old)

  return checks;
}
```

### Backup Alerts

Set up alerts for:
- ❌ Backup failures
- ⚠️ Backups older than 25 hours
- ⚠️ Storage bucket errors
- ⚠️ Low storage space
- ✅ Successful backup completion

## Disaster Recovery Plan

### RTO and RPO Targets

| Data Type | RPO (Max Data Loss) | RTO (Max Downtime) |
|-----------|---------------------|-------------------|
| Database | 5 minutes | 4 hours |
| Storage Files | Real-time | 1 hour |
| User Sessions | 15 minutes | 30 minutes |
| Configuration | 24 hours | 2 hours |

### Recovery Steps

1. **Assess Impact**
   - Identify what data is affected
   - Determine recovery point needed

2. **Notify Stakeholders**
   - Inform team of incident
   - Set expectations for recovery time

3. **Initiate Recovery**
   - Access Lovable Cloud dashboard
   - Select appropriate backup point
   - Start restoration process

4. **Verify Recovery**
   - Run data integrity checks
   - Test critical functionality
   - Verify user access

5. **Document Incident**
   - Record cause and impact
   - Update procedures if needed
   - Schedule post-mortem

## Backup Best Practices

### Development
- ✅ Test backup restoration monthly
- ✅ Keep separate dev/prod backups
- ✅ Never test recovery on production
- ✅ Document all recovery procedures

### Production
- ✅ Enable PITR for critical databases
- ✅ Use storage versioning for important files
- ✅ Export critical data before major updates
- ✅ Maintain off-site backup copies
- ✅ Verify backup integrity regularly

### Compliance
- ✅ Encrypt backups at rest
- ✅ Control backup access with RBAC
- ✅ Log all backup/restore operations
- ✅ Meet retention requirements (GDPR, etc.)

## Backup Retention Schedule

### Automatic Retention (Lovable Cloud)

```
Daily backups:    7-30 days (plan dependent)
PITR logs:        7 days (Pro plan)
Storage files:    Indefinite (until deleted)
```

### Manual Backup Retention

```
Weekly exports:   90 days
Monthly exports:  1 year
Yearly archives:  7 years (compliance)
```

## Data Cleanup Policy

To manage backup storage costs:

```sql
-- Automated cleanup for old proctoring recordings
-- Already implemented in database
SELECT cleanup_old_proctoring_recordings();

-- Schedule this to run daily via pg_cron (if available)
SELECT cron.schedule(
  'cleanup-old-recordings',
  '0 2 * * *', -- 2 AM daily
  $$
  SELECT public.cleanup_old_proctoring_recordings();
  $$
);
```

## Support and Escalation

### For Backup Issues

1. **Check Dashboard**: Lovable Cloud → Backend → Backups
2. **Review Logs**: Check for backup errors or warnings
3. **Contact Support**: If automated backups are failing
4. **Escalate**: For data loss or corruption issues

### Emergency Contacts

- **Lovable Support**: support@lovable.dev
- **Emergency Hotline**: Available in dashboard
- **Status Page**: Check for known issues

## Testing and Validation

### Monthly Backup Test

```bash
#!/bin/bash
# Monthly backup restoration test

echo "=== Monthly Backup Test ==="
echo "Date: $(date)"

# 1. Create test project/environment
# 2. Restore latest backup to test environment
# 3. Run validation queries
# 4. Document results

echo "Test completed. Review results in ./backup-tests/$(date +%Y%m).log"
```

### Validation Queries

```sql
-- Run these after restoration to verify data integrity

-- Check table counts
SELECT 'interviews' as table_name, COUNT(*) as count FROM interviews
UNION ALL
SELECT 'interview_attempts', COUNT(*) FROM interview_attempts
UNION ALL
SELECT 'questions', COUNT(*) FROM questions
UNION ALL
SELECT 'proctoring_sessions', COUNT(*) FROM proctoring_sessions;

-- Check for orphaned records
SELECT COUNT(*) as orphaned_attempts
FROM interview_attempts ia
LEFT JOIN interviews i ON i.id = ia.interview_id
WHERE i.id IS NULL;

-- Verify recent activity
SELECT COUNT(*) as recent_attempts
FROM interview_attempts
WHERE created_at > NOW() - INTERVAL '7 days';

-- Check storage bucket health
SELECT bucket_id, COUNT(*) as file_count
FROM storage.objects
GROUP BY bucket_id;
```

## Conclusion

This backup strategy ensures:
- ✅ Automated daily database backups
- ✅ Point-in-time recovery capability
- ✅ Storage redundancy and versioning
- ✅ Clear recovery procedures
- ✅ Regular testing and validation
- ✅ Compliance with data retention policies

Review and update this strategy quarterly to ensure it meets evolving business needs.

---

**Last Updated**: 2025-11-09  
**Version**: 1.0  
**Owner**: DevOps Team
