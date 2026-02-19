-- Fix function body mismatch — auto_evaluate_interview
-- Generated: 2026-02-19
-- Note: URL and anon key set to local self-hosted Supabase gateway

CREATE OR REPLACE FUNCTION public.auto_evaluate_interview()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_include_video_analysis BOOLEAN;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    -- Use local Supabase gateway and local anon key (self-hosted)
    v_supabase_url := 'http://talentgeenie-kong:8000';
    v_anon_key := 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE3NzE0MDQyMzcsICJleHAiOiAyMDg2NzY0MjM3fQ.0T9mbkTwe7N_N8bUT49a4-Jg_wP0VtyiSQuDB418m5o';
    v_include_video_analysis := (OLD.status = 'pending_upload');

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/auto-evaluate-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key
      ),
      body := jsonb_build_object(
        'attemptId', NEW.id,
        'includeVideoAnalysis', v_include_video_analysis
      )
    );

    INSERT INTO public.audit_logs (
      action, table_name, record_id, metadata
    ) VALUES (
      'EVALUATE', 'interview_attempts', NEW.id,
      jsonb_build_object(
        'attempt_id', NEW.id,
        'triggered_at', NOW(),
        'auto_evaluation', true,
        'include_video_analysis', v_include_video_analysis,
        'previous_status', OLD.status
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in auto_evaluate_interview: %', SQLERRM;
  RETURN NEW;
END;
$function$;
