-- =============================================================================
-- Remove ALL hardcoded Lovable cloud URLs from the running database
-- Affected Lovable project IDs:
--   aiwekrfwhdwvbnrkuurh  (original project)
--   vtztavcqjmirktkjdprm  (second project)
-- Production self-hosted URL: https://interviewai.talentgeenie.com
-- =============================================================================

-- 1. Correct the project URL stored in system_config
--    (inserted by migration 20260106160738 with the old Lovable URL)
UPDATE system_config
SET value = 'https://interviewai.talentgeenie.com',
    updated_at = NOW()
WHERE key = 'supabase_project_url'
  AND value LIKE '%.supabase.co%';

-- Safety net: insert if row was somehow missing
INSERT INTO system_config (key, value, created_at, updated_at)
VALUES ('supabase_project_url', 'https://interviewai.talentgeenie.com', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 2. Recreate auto_evaluate_interview() without any hardcoded Lovable URL.
--    History:
--    - 20260102083322: hardcoded aiwekrfwhdwvbnrkuurh + Lovable ANON key
--    - 20260106160209: hardcoded vtztavcqjmirktkjdprm + Lovable ANON key
--    - 20260106160738: reads system_config, fallback to vtztavcqjmirktkjdprm ← still bad
--    - 20260106160752: same, adds search_path fix ← still bad
--    This migration: reads system_config ONLY, uses service role key, no fallback
-- =============================================================================
CREATE OR REPLACE FUNCTION public.auto_evaluate_interview()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url         TEXT;
  v_service_key          TEXT;
  v_include_video_analysis BOOLEAN;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN

    -- Read project URL from system_config (no hardcoded fallback)
    SELECT value INTO v_supabase_url
    FROM system_config
    WHERE key = 'supabase_project_url';

    -- Fallback to PostgreSQL app setting (set via docker-compose environment)
    IF v_supabase_url IS NULL THEN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
    END IF;

    v_service_key := current_setting('app.settings.service_role_key', true);
    v_include_video_analysis := (OLD.status = 'pending_upload');

    -- Only call edge function if both URL and service key are available
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_supabase_url || '/functions/v1/auto-evaluate-trigger',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_service_key,
          'apikey',        v_service_key
        ),
        body    := jsonb_build_object(
          'attemptId',           NEW.id,
          'includeVideoAnalysis', v_include_video_analysis
        )
      );
    END IF;

    INSERT INTO public.audit_logs (action, table_name, record_id, metadata)
    VALUES (
      'EVALUATE',
      'interview_attempts',
      NEW.id,
      jsonb_build_object(
        'attempt_id',             NEW.id,
        'triggered_at',           NOW(),
        'auto_evaluation',        true,
        'include_video_analysis', v_include_video_analysis,
        'previous_status',        OLD.status
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in auto_evaluate_interview: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 3. Recreate trigger_auto_evaluate() without any hardcoded Lovable URL.
--    History: same chain as above; this is the definitive clean version.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trigger_auto_evaluate()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN

    -- Read project URL from system_config (no hardcoded fallback)
    SELECT value INTO v_supabase_url
    FROM system_config
    WHERE key = 'supabase_project_url';

    -- Fallback to PostgreSQL app setting (set via docker-compose environment)
    IF v_supabase_url IS NULL THEN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
    END IF;

    v_service_key := current_setting('app.settings.service_role_key', true);

    -- Only call edge function if both URL and service key are available
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_supabase_url || '/functions/v1/evaluate-interview',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_service_key,
          'apikey',        v_service_key
        ),
        body    := jsonb_build_object('attemptId', NEW.id)
      );
    END IF;

    INSERT INTO public.audit_logs (action, table_name, record_id, metadata)
    VALUES (
      'AUTO_EVALUATE',
      'interview_attempts',
      NEW.id,
      jsonb_build_object(
        'attempt_id',      NEW.id,
        'triggered_at',    NOW(),
        'trigger_method',  'database_trigger'
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in trigger_auto_evaluate: %', SQLERRM;
  RETURN NEW;
END;
$$;
