# Fresh Deploy Migrations (DEPRECATED)

⚠️ **This folder is deprecated.** All migrations have been copied to `supabase/migrations/`.

**Last verified against Lovable Cloud: 2024-12-27**

## New Location

The production baseline migrations are now in:

```
supabase/migrations/
├── 20251227000001_enums_extensions.sql   (was 01_enums_extensions.sql)
├── 20251227000002_helper_functions.sql   (was 02_helper_functions.sql)
├── 20251227000003_tables.sql             (was 03_tables.sql)
├── 20251227000004_type_alignment_patches.sql (was 03c_type_alignment_patches.sql)
├── 20251227000005_functions.sql          (was 04_functions.sql)
├── 20251227000006_rls_policies.sql       (was 05_rls_policies.sql)
├── 20251227000007_triggers.sql           (was 05b_triggers.sql)
├── 20251227000008_storage.sql            (was 06_storage.sql)
├── 20251227000009_auth_trigger.sql       (was 07_auth_trigger.sql)
└── 20251227000010_indexes.sql            (was 08_indexes.sql)
```

## Schema Summary (Verified Counts)

| Object Type | Count |
|-------------|-------|
| Tables | 105 |
| Functions | 109 |
| Triggers | 62 |
| RLS Policies | 330 |
| Indexes | 381 |
| Storage Buckets | 4 |

## Documentation

See `docs/MIGRATION_EXECUTION_ORDER.md` for the complete execution guide.

## File Mapping

| Old Name | New Name |
|----------|----------|
| `01_enums_extensions.sql` | `20251227000001_enums_extensions.sql` |
| `02_helper_functions.sql` | `20251227000002_helper_functions.sql` |
| `03_tables.sql` | `20251227000003_tables.sql` |
| `03c_type_alignment_patches.sql` | `20251227000004_type_alignment_patches.sql` |
| `04_functions.sql` | `20251227000005_functions.sql` |
| `05_rls_policies.sql` | `20251227000006_rls_policies.sql` |
| `05b_triggers.sql` | `20251227000007_triggers.sql` |
| `06_storage.sql` | `20251227000008_storage.sql` |
| `07_auth_trigger.sql` | `20251227000009_auth_trigger.sql` |
| `08_indexes.sql` | `20251227000010_indexes.sql` |

## Verification Queries

After running all migrations, verify the deployment:

```sql
-- Check table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 105

-- Check function count  
SELECT COUNT(*) FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public';
-- Expected: 109

-- Check RLS policy count
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Expected: 330

-- Check trigger count
SELECT COUNT(*) FROM pg_trigger t 
JOIN pg_class c ON t.tgrelid = c.oid 
WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal;
-- Expected: 62

-- Check storage buckets
SELECT id, name, public FROM storage.buckets ORDER BY name;
-- Expected: 4 buckets
```
