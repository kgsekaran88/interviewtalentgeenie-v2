# Migration Execution Order

For **fresh database deployments**, migrations should run in this order.

## Correct Sequence (New Baseline - 2024-12-27)

All migrations are now in `supabase/migrations/` folder with proper timestamps:

1. **`20251227000001_enums_extensions.sql`** - Extensions and app_role enum
2. **`20251227000002_helper_functions.sql`** - Utility functions
3. **`20251227000003_tables.sql`** - All database tables
4. **`20251227000004_type_alignment_patches.sql`** - Type alignment patches
5. **`20251227000005_functions.sql`** - All database functions (109 functions)
6. **`20251227000006_rls_policies.sql`** - All RLS policies (330 policies)
7. **`20251227000007_triggers.sql`** - All triggers
8. **`20251227000008_storage.sql`** - Storage buckets and policies
9. **`20251227000009_auth_trigger.sql`** - Auth-related triggers
10. **`20251227000010_indexes.sql`** - Performance indexes

## Manual DB Push Instructions

If you're using `supabase db push` or running SQL files directly:

```bash
# Run all migrations in order
psql -f supabase/migrations/20251227000001_enums_extensions.sql
psql -f supabase/migrations/20251227000002_helper_functions.sql
psql -f supabase/migrations/20251227000003_tables.sql
psql -f supabase/migrations/20251227000004_type_alignment_patches.sql
psql -f supabase/migrations/20251227000005_functions.sql
psql -f supabase/migrations/20251227000006_rls_policies.sql
psql -f supabase/migrations/20251227000007_triggers.sql
psql -f supabase/migrations/20251227000008_storage.sql
psql -f supabase/migrations/20251227000009_auth_trigger.sql
psql -f supabase/migrations/20251227000010_indexes.sql
```

## Docker/Kubernetes (Automated)

The migration runner automatically runs all `*.sql` files in `supabase/migrations/` in sorted order.

```bash
# Using Docker
docker-compose -f docker-compose.migration.yml up

# Using the migration script directly
./scripts/run-migrations.sh -h db.example.com -d talentgeenie -U admin -W secretpass
```

## Helm/Kubernetes Deployment

```bash
# Build migration image
docker build -f Dockerfile.migration -t your-registry/talentgeenie-migrate:latest .
docker push your-registry/talentgeenie-migrate:latest

# Deploy with Helm
helm upgrade --install talentgeenie ./helm/talentgeenie \
  --set migration.enabled=true \
  --set migration.image.repository=your-registry/talentgeenie-migrate \
  --set migration.image.tag=latest
```

## For Existing Databases

All migrations are idempotent (use `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`), so re-running them is safe.

To mark migrations as already applied (for existing databases):

```bash
# Using Supabase CLI
supabase migration repair 20251227000001 --status applied
supabase migration repair 20251227000002 --status applied
# ... repeat for all migrations
```

## Key Dependencies

| Migration | Depends On |
|-----------|------------|
| `03_tables.sql` | `01_enums_extensions.sql`, `02_helper_functions.sql` |
| `05_functions.sql` | `03_tables.sql` |
| `06_rls_policies.sql` | `03_tables.sql`, `05_functions.sql` |
| `07_triggers.sql` | `03_tables.sql`, `05_functions.sql` |
| `08_storage.sql` | `05_functions.sql` (for role checks) |
| `10_indexes.sql` | `03_tables.sql` |

## Preflight Notes

The migration scripts automatically handle:
- Dropping `get_user_roles(uuid)` before `20251227000005_functions.sql` to avoid return type conflicts
- All migrations use `IF NOT EXISTS` and `CREATE OR REPLACE` for idempotency
