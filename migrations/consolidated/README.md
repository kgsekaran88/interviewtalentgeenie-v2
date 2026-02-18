# Consolidated Migrations (DEPRECATED)

⚠️ **This folder is deprecated.** All migrations have been moved to `supabase/migrations/`.

## New Location

The production baseline migrations are now in:

```
supabase/migrations/
├── 20251227000001_enums_extensions.sql
├── 20251227000002_helper_functions.sql
├── 20251227000003_tables.sql
├── 20251227000004_type_alignment_patches.sql
├── 20251227000005_functions.sql
├── 20251227000006_rls_policies.sql
├── 20251227000007_triggers.sql
├── 20251227000008_storage.sql
├── 20251227000009_auth_trigger.sql
└── 20251227000010_indexes.sql
```

## Documentation

See `docs/MIGRATION_EXECUTION_ORDER.md` for the complete execution guide.

## Why This Change?

- **Supabase CLI compatibility**: The Supabase CLI expects migrations in `supabase/migrations/`
- **Docker/Kubernetes**: The migration runner scripts look for files in `supabase/migrations/`
- **Proper timestamps**: All files now have proper migration timestamps for ordering
