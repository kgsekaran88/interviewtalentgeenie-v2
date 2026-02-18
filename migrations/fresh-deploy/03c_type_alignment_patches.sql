-- =============================================================================
-- FRESH DEPLOYMENT: 03c - TYPE ALIGNMENT PATCHES (pre-RLS)
--
-- Purpose:
-- - Prevent RLS policy creation failures like: operator does not exist: text = uuid
-- - This happens when tables already exist (CREATE TABLE IF NOT EXISTS) with older TEXT ids
-- - Aligns column types to match Production Cloud schema (UUID ids)
--
-- Safe to re-run: uses IF EXISTS checks and only alters when needed.
-- =============================================================================

-- Helper: convert TEXT/VARCHAR columns to UUID when Production Cloud expects UUID

DO $$
BEGIN
  -- approval_workflows.entity_id must be UUID
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

  -- collaboration_threads.entity_id must be UUID
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

  -- activity_feed.entity_id must be UUID
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_feed'
      AND column_name = 'entity_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE public.activity_feed
      ALTER COLUMN entity_id TYPE uuid
      USING entity_id::uuid;
  END IF;

  -- predictive_analytics.entity_id must be UUID
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'predictive_analytics'
      AND column_name = 'entity_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE public.predictive_analytics
      ALTER COLUMN entity_id TYPE uuid
      USING NULLIF(entity_id, '')::uuid;
  END IF;

  -- usage_tracking.resource_id must be UUID
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usage_tracking'
      AND column_name = 'resource_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE public.usage_tracking
      ALTER COLUMN resource_id TYPE uuid
      USING NULLIF(resource_id, '')::uuid;
  END IF;

  -- security_events.resource_id must be UUID
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'security_events'
      AND column_name = 'resource_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE public.security_events
      ALTER COLUMN resource_id TYPE uuid
      USING NULLIF(resource_id, '')::uuid;
  END IF;

  -- email_templates.organization_id must exist (UUID)
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'email_templates'
  ) THEN
    -- If older schema used org_id instead of organization_id, rename it
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'email_templates'
        AND column_name = 'organization_id'
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'email_templates'
          AND column_name = 'org_id'
      ) THEN
        ALTER TABLE public.email_templates
          RENAME COLUMN org_id TO organization_id;
      ELSE
        -- Otherwise add it
        ALTER TABLE public.email_templates
          ADD COLUMN organization_id uuid;
      END IF;
    END IF;

    -- If the column exists but is text/varchar, align to UUID
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'email_templates'
        AND column_name = 'organization_id'
        AND data_type IN ('text', 'character varying')
    ) THEN
      ALTER TABLE public.email_templates
        ALTER COLUMN organization_id TYPE uuid
        USING NULLIF(organization_id, '')::uuid;
    END IF;
  END IF;
END;
$$;
