# Safety Rails Implementation

## Overview

This document describes the safety rails implemented to prevent catastrophic data loss, like the IntraEdge incident where the `cleanup-all-except-admins` function wiped all user data.

## What Changed

### 1. Soft Delete (Default for ALL Delete Operations)

All delete operations now use **soft delete** (`SET deleted_at = now()`) instead of hard delete (`DELETE FROM`). Data remains in the database but is hidden from normal queries via RESTRICTIVE RLS policies.

**Tables with `deleted_at` column (13 total):**

| Table | Status |
|-------|--------|
| `organizations` | Already existed ✅ |
| `interviews` | Already existed ✅ |
| `questions` | Already existed ✅ |
| `interview_invitations` | Already existed ✅ |
| `profiles` | **NEW** |
| `organization_members` | **NEW** |
| `user_roles` | **NEW** |
| `interview_attempts` | **NEW** |
| `assessments` | **NEW** |
| `certificates` | **NEW** |
| `learning_assessments` | **NEW** |
| `learning_assessment_attempts` | **NEW** |
| `attempt_questions` | **NEW** |

### 2. RESTRICTIVE RLS Policies

Every table with `deleted_at` has a RESTRICTIVE policy:
```sql
CREATE POLICY exclude_soft_deleted ON <table>
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (deleted_at IS NULL);
```

This means:
- **Normal users** (authenticated role): cannot see soft-deleted records
- **Service role** (edge functions with admin access): bypasses RLS, can see and restore deleted records
- Existing PERMISSIVE policies are NOT modified — the RESTRICTIVE policy ANDs with them

### 3. New Database Functions

| Function | Purpose |
|----------|---------|
| `soft_delete_organization_tx(org_id)` | Soft-deletes org + interviews + attempts + questions + members + roles |
| `soft_delete_interview_tx(interview_id)` | Soft-deletes interview + attempts + questions + invitations |
| `soft_delete_user_tx(user_id, admin_id)` | Soft-deletes user profile + roles + memberships. Handles partner admin elevation. |
| `restore_organization_tx(org_id)` | Restores a soft-deleted organization and all children |
| `restore_interview_tx(interview_id)` | Restores a soft-deleted interview and all children |
| `restore_user_tx(user_id)` | Restores a soft-deleted user profile + roles + memberships |
| `purge_soft_deleted(retention_days)` | Hard-deletes records older than retention period (default 30 days) |
| `list_soft_deleted(entity_type)` | Lists all soft-deleted organizations, interviews, and users |

### 4. Edge Function Changes

| Function | Before | After |
|----------|--------|-------|
| `delete-organization` | Hard DELETE via `delete_organization_tx` | **Soft delete** via `soft_delete_organization_tx`. Requires typed confirmation `"DELETE <org-name>"`. Hard delete only with `force=true`. |
| `delete-interview` | Hard DELETE via `delete_interview_tx` | **Soft delete** via `soft_delete_interview_tx`. Hard delete only with `force=true` + admin. |
| `cleanup-all-except-admins` | **NUCLEAR**: Deleted from 36+ tables | **PERMANENTLY DISABLED**. Returns 403 error. Attempts are logged. |
| `admin-user-management` (delete) | Hard DELETE + auth user deletion | **Soft delete** via `soft_delete_user_tx`. Auth user is banned, not deleted. |
| `admin-user-management` (delete-cascade) | Hard DELETE via `delete_user_cascade_tx` | **Soft delete** via `soft_delete_user_tx`. Auth user is banned. |
| `admin-user-management` (bulk-delete) | **BUG**: Only deleted auth users, leaving orphaned records | **FIXED**: Uses `soft_delete_user_tx` for each user, then bans auth accounts. |
| `restore-deleted` (**NEW**) | N/A | Lists, restores, and purges soft-deleted records |

### 5. Automated Backups

New script: `scripts/pg-backup.sh`

```bash
# Regular backup (with 30-day retention cleanup)
./scripts/pg-backup.sh

# Pre-operation snapshot (no cleanup)
./scripts/pg-backup.sh --snapshot

# Custom retention
./scripts/pg-backup.sh --retention 60
```

Creates:
- `talentgeenie_full.sql.gz` — Full pg_dump (schema + data)
- `schema_only.sql.gz` — Schema reference
- `auth_users.csv` — Auth user export
- `row_counts.txt` — Table row counts
- `manifest.json` — Backup metadata

## Restore Procedures

### Restore a Soft-Deleted Entity (via API)

```bash
# List soft-deleted records
curl -X POST http://localhost:8000/functions/v1/restore-deleted \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}'

# Restore a specific organization
curl -X POST http://localhost:8000/functions/v1/restore-deleted \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "restore", "entityType": "organization", "entityId": "<uuid>"}'

# Restore a user
curl -X POST http://localhost:8000/functions/v1/restore-deleted \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "restore", "entityType": "user", "entityId": "<uuid>"}'
```

### Full Database Restore (from backup)

```bash
gunzip < backups/pg/<timestamp>/talentgeenie_full.sql.gz | \
  docker exec -i talentgeenie-db psql -U supabase_admin -d postgres
```

## Migration File

`migrations/003_soft_delete_safety_rails.sql`

## Old Functions (Preserved)

The original hard-delete database functions are still available for edge cases:
- `delete_organization_tx` — Used only when `force=true`
- `delete_interview_tx` — Used only when `force=true`
- `delete_user_cascade_tx` — Not called by any edge function anymore

Original edge function code is backed up as `.bak` files.
