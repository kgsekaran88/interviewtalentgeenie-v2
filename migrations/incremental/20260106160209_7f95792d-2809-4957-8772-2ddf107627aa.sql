
-- Fix the auto_evaluate_interview trigger function to use correct project URL
-- The function was pointing to wrong Supabase project (aiwekrfwhdwvbnrkuurh instead of vtztavcqjmirktkjdprm)

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
    -- FIXED: Use correct project URL and anon key
    v_supabase_url := 'https://vtztavcqjmirktkjdprm.supabase.co';
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enRhdmNxam1pcmt0a2pkcHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzA4NDAsImV4cCI6MjA4MjkwNjg0MH0.eT1US55pKABe514mInOj8m8SaRzKUSJIADmB5d7oN-U';
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

-- Also fix trigger_auto_evaluate function
CREATE OR REPLACE FUNCTION public.trigger_auto_evaluate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Only trigger on status change to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    -- FIXED: Use correct project URL
    v_supabase_url := 'https://vtztavcqjmirktkjdprm.supabase.co';
    
    -- Try to get service key from settings, fallback to anon key
    v_service_key := current_setting('supabase.service_role_key', true);
    
    IF v_service_key IS NULL THEN
      -- Fallback to anon key if service key not available
      v_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enRhdmNxam1pcmt0a2pkcHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzA4NDAsImV4cCI6MjA4MjkwNjg0MH0.eT1US55pKABe514mInOj8m8SaRzKUSJIADmB5d7oN-U';
    END IF;
    
    -- Call evaluate-interview edge function
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/evaluate-interview',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      ),
      body := jsonb_build_object('attemptId', NEW.id)
    );
    
    -- Log the evaluation trigger
    INSERT INTO public.audit_logs (
      action,
      table_name,
      record_id,
      metadata
    ) VALUES (
      'AUTO_EVALUATE',
      'interview_attempts',
      NEW.id,
      jsonb_build_object(
        'attempt_id', NEW.id,
        'triggered_at', NOW(),
        'trigger_method', 'database_trigger'
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction
  RAISE WARNING 'Error in trigger_auto_evaluate: %', SQLERRM;
  RETURN NEW;
END;
$function$;
