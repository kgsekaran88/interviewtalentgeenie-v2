-- =============================================================================
-- MANUAL PRE-PATCH
-- Run this AFTER baseline migration and BEFORE production_rls_policies.sql
-- =============================================================================

-- 1. Add missing columns to failed_jobs
ALTER TABLE IF EXISTS public.failed_jobs
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE IF EXISTS public.failed_jobs
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.failed_jobs
  ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;

-- 2. Create activity_feed table
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- 3. Fix approval_workflows.entity_id type (TEXT -> UUID)
-- Note: Postgres won't let us alter a column type while any RLS policy depends on it.
-- This block safely drops existing policies on the table (if any), changes the type, and
-- expects you to re-apply the production RLS migration afterwards.
DO $$
DECLARE p RECORD;
BEGIN
  -- Drop all policies on approval_workflows to allow ALTER COLUMN TYPE
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'approval_workflows'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.approval_workflows', p.policyname);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'approval_workflows'
      AND column_name = 'entity_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE public.approval_workflows
      ALTER COLUMN entity_id TYPE uuid
      USING entity_id::uuid;
  END IF;
END;
$$;

-- 4. Fix collaboration_threads.entity_id type (TEXT -> UUID)
DO $$
DECLARE p RECORD;
BEGIN
  -- Drop all policies on collaboration_threads to allow ALTER COLUMN TYPE
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collaboration_threads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.collaboration_threads', p.policyname);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'collaboration_threads'
      AND column_name = 'entity_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE public.collaboration_threads
      ALTER COLUMN entity_id TYPE uuid
      USING entity_id::uuid;
  END IF;
END;
$$;

-- 5. Fix get_user_roles function signature
DROP FUNCTION IF EXISTS public.get_user_roles(UUID);

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- 6. Create has_any_role_with_hierarchy function
CREATE OR REPLACE FUNCTION public.has_any_role_with_hierarchy(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = ANY(_roles) OR role = 'platform_admin')
  );
$$;

-- =============================================================================
-- Done! Now run production_functions.sql, then production_rls_policies.sql
-- =============================================================================
