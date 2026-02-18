-- Fix search_path security issue for auto_evaluate_interview
CREATE OR REPLACE FUNCTION auto_evaluate_interview()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT;
BEGIN
  -- Read from config table with hardcoded fallback for safety
  SELECT value INTO project_url FROM system_config WHERE key = 'supabase_project_url';
  IF project_url IS NULL THEN
    project_url := 'https://vtztavcqjmirktkjdprm.supabase.co';
  END IF;

  -- Only trigger for submitted status
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    PERFORM net.http_post(
      url := project_url || '/functions/v1/auto-evaluate-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('attemptId', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix search_path security issue for trigger_auto_evaluate
CREATE OR REPLACE FUNCTION trigger_auto_evaluate()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT;
BEGIN
  -- Read from config table with hardcoded fallback for safety
  SELECT value INTO project_url FROM system_config WHERE key = 'supabase_project_url';
  IF project_url IS NULL THEN
    project_url := 'https://vtztavcqjmirktkjdprm.supabase.co';
  END IF;

  -- Only trigger when status changes to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    PERFORM net.http_post(
      url := project_url || '/functions/v1/auto-evaluate-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('attemptId', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;