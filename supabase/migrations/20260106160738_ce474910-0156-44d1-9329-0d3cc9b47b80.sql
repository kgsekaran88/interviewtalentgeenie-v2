-- Insert project URL into system_config (upsert to be safe)
INSERT INTO system_config (key, value, created_at, updated_at)
VALUES ('supabase_project_url', 'https://vtztavcqjmirktkjdprm.supabase.co', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Update auto_evaluate_interview function to read from config with fallback
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
    -- Call the auto-evaluate-trigger edge function
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger_auto_evaluate function to read from config with fallback
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
$$ LANGUAGE plpgsql SECURITY DEFINER;