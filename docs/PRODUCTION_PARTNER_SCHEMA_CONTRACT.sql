-- ============================================================================
-- PARTNER ONBOARDING / APPROVAL: PRODUCTION SCHEMA CONTRACT CHECK
-- Generated: 2026-01-02
-- Purpose: fail-fast if production is missing required DB objects for partner flows
-- ============================================================================

DO $$
BEGIN
  -- partner_applications columns required by app + approval function
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_applications' AND column_name='organization_name') THEN
    RAISE EXCEPTION 'Schema contract failed: partner_applications.organization_name missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_applications' AND column_name='applicant_user_id') THEN
    RAISE EXCEPTION 'Schema contract failed: partner_applications.applicant_user_id missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_applications' AND column_name='selected_plan_id') THEN
    RAISE EXCEPTION 'Schema contract failed: partner_applications.selected_plan_id missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_applications' AND column_name='contact_email') THEN
    RAISE EXCEPTION 'Schema contract failed: partner_applications.contact_email missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_applications' AND column_name='industry') THEN
    RAISE EXCEPTION 'Schema contract failed: partner_applications.industry missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_applications' AND column_name='company_size') THEN
    RAISE EXCEPTION 'Schema contract failed: partner_applications.company_size missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_applications' AND column_name='country') THEN
    RAISE EXCEPTION 'Schema contract failed: partner_applications.country missing';
  END IF;

  -- approval function exists
  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='approve_partner_application_tx';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schema contract failed: function public.approve_partner_application_tx missing';
  END IF;
END $$;

-- Print signatures so you can compare dev vs prod quickly
WITH cols AS (
  SELECT table_name, ordinal_position, column_name, data_type, is_nullable, COALESCE(column_default, '') AS column_default
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name IN ('partner_applications','subscription_plans','organizations','organization_subscriptions')
)
SELECT
  table_name,
  md5(string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || column_default, '|' ORDER BY ordinal_position)) AS schema_signature
FROM cols
GROUP BY table_name
ORDER BY table_name;
