# Complete Schema Export & Import Guide

This guide walks you through exporting your complete database schema from Lovable Cloud and importing it to your production Supabase instance.

## Prerequisites

Before starting, ensure you have:
- [ ] PostgreSQL client tools installed (`psql`, `pg_dump`)
- [ ] Access to Lovable Cloud credentials
- [ ] Access to your production Supabase project

### Installing PostgreSQL Tools

**macOS:**
```bash
brew install postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql-client
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

---

## Step 1: Get Your Lovable Cloud Credentials

1. In Lovable, go to **Settings** (gear icon in top right)
2. Click **Connectors** tab
3. Find **Lovable Cloud** section
4. Note down:
   - **Project ID:** `vtztavcqjmirktkjdprm`
   - **Database Password:** (click to reveal and copy)

Your connection string will be:
```
postgresql://postgres.vtztavcqjmirktkjdprm:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

---

## Step 2: Export Schema from Lovable Cloud

### Option A: Full Schema Export (Recommended)

```bash
# Replace [PASSWORD] with your actual database password
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=supabase_functions \
  --exclude-schema=realtime \
  --exclude-schema=vault \
  --exclude-schema=extensions \
  --exclude-schema=graphql \
  --exclude-schema=graphql_public \
  --exclude-schema=pgsodium \
  --exclude-schema=pgsodium_masks \
  --exclude-schema=supabase_migrations \
  "postgresql://postgres.vtztavcqjmirktkjdprm:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" \
  > lovable_cloud_full_schema.sql
```

### Option B: Export Specific Components

**Tables and Columns Only:**
```bash
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --section=pre-data \
  --exclude-schema=auth \
  --exclude-schema=storage \
  "postgresql://postgres.vtztavcqjmirktkjdprm:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" \
  > lovable_cloud_tables.sql
```

**Functions and Triggers:**
```bash
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --section=post-data \
  "postgresql://postgres.vtztavcqjmirktkjdprm:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" \
  > lovable_cloud_functions.sql
```

---

## Step 3: Get Your Production Supabase Credentials

1. Go to your **Production Supabase Dashboard** (https://supabase.com/dashboard)
2. Select your production project
3. Go to **Settings** → **Database**
4. Find **Connection string** section
5. Select **URI** format
6. Copy the connection string (replace `[YOUR-PASSWORD]` with your database password)

Your production connection string will look like:
```
postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

---

## Step 4: Prepare the Export File

Before importing, review and edit the export file:

1. **Open the file:**
   ```bash
   nano lovable_cloud_full_schema.sql
   # or use any text editor
   ```

2. **Remove problematic statements** (if any):
   - Remove any `ALTER DATABASE` statements
   - Remove any references to `auth.users` foreign keys (Supabase manages this)
   - Remove any `CREATE EXTENSION` statements (extensions should be enabled via dashboard)

3. **Check for conflicts:**
   - If your production already has some tables, you may need to use `DROP TABLE IF EXISTS` or handle conflicts

---

## Step 5: Import to Production

### Option A: Direct Import (Fresh Database)

```bash
# Replace with your production connection string
psql "postgresql://postgres.[PROD_PROJECT_ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
  < lovable_cloud_full_schema.sql
```

### Option B: Import via SQL Editor (Safer)

1. Go to your **Production Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Open the exported `.sql` file in a text editor
4. Copy sections and run them in order:
   - First: ENUM types
   - Second: Tables (in dependency order)
   - Third: Functions
   - Fourth: Triggers
   - Fifth: RLS Policies
   - Sixth: Indexes

### Option C: Chunk Import (Large Files)

For very large exports, split into chunks:

```bash
# Split the file into 1000-line chunks
split -l 1000 lovable_cloud_full_schema.sql schema_part_

# Import each chunk
for file in schema_part_*; do
  echo "Importing $file..."
  psql "postgresql://postgres.[PROD_PROJECT_ID]:[PASSWORD]@..." < "$file"
done
```

---

## Step 6: Export and Import Storage Buckets

Storage buckets need separate handling:

### Export Bucket Configuration
```sql
-- Run this in Lovable Cloud SQL (via Supabase dashboard)
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets;
```

### Create Buckets in Production
```sql
-- Run this in Production SQL Editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('certificates', 'certificates', true, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('consent-documents', 'consent-documents', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('documentation', 'documentation', false, 10485760, ARRAY['application/pdf']),
  ('proctoring-recordings', 'proctoring-recordings', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
```

---

## Step 7: Verify the Import

Run these verification queries in your production database:

### Check Tables
```sql
SELECT tablename, schemaname 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Check RLS Status
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Check Functions
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### Check Storage Buckets
```sql
SELECT id, name, public FROM storage.buckets;
```

---

## Troubleshooting

### Error: "relation already exists"
The table already exists in production. Either:
- Drop the existing table first: `DROP TABLE IF EXISTS table_name CASCADE;`
- Or skip that table in your import

### Error: "type app_role does not exist"
ENUM types must be created before tables that use them. Create the enum first:
```sql
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM (
      'admin', 'hr', 'interviewer', 'contributor', 'candidate', 'guest',
      'platform_admin', 'partner_admin', 'hr_recruiter', 'ta_creator',
      'billing_contact', 'tech_spoc'
    );
  END IF;
END $$;
```

### Error: "permission denied for schema auth"
You cannot modify the `auth` schema directly. Remove any references to `auth.users` from your export file.

### Error: "function auth.uid() does not exist"
This function is built into Supabase. If you see this error during import, it means you're running outside Supabase context. This should work fine when run in the Supabase SQL Editor.

---

## Quick Reference: Connection Strings

| Environment | Connection String |
|-------------|-------------------|
| Lovable Cloud (Dev) | `postgresql://postgres.vtztavcqjmirktkjdprm:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` |
| Production | `postgresql://postgres.[YOUR_PROD_ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres` |

---

## Next Steps

After successful import:
1. [ ] Verify all tables exist with correct columns
2. [ ] Verify RLS policies are enabled and working
3. [ ] Test authentication flows
4. [ ] Test CRUD operations for key tables
5. [ ] Deploy edge functions to production
6. [ ] Configure environment variables in production
