-- =============================================================================
-- Pre-production patches
--
-- Purpose:
-- - Ensure objects required by production RLS + functions exist on fresh deployments
-- - Must run AFTER the baseline migration and BEFORE production_* migrations
--
-- Notes:
-- - Idempotent (safe to re-run)
-- - Uses IF EXISTS / IF NOT EXISTS to avoid failures
-- =============================================================================

-- Add missing columns to failed_jobs (referenced by production policies)
ALTER TABLE IF EXISTS public.failed_jobs
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE IF EXISTS public.failed_jobs
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.failed_jobs
  ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;


-- Create activity_feed table (referenced by production policies)
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


-- Fix approval_workflows entity_id type mismatch (TEXT vs UUID)
-- The production RLS file compares approval_workflows.entity_id to UUID primary keys.
DO $$
BEGIN
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

-- Fix get_user_roles signature so policies using "IN (SELECT ...)" work
DROP FUNCTION IF EXISTS public.get_user_roles(UUID);

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;


-- Function used by role-based access policies
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
