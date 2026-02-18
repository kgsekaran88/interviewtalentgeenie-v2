-- Update the cron job to run every 30 minutes as a safety net fallback
SELECT cron.unschedule('enforce-interview-deadlines');

SELECT cron.schedule(
  'enforce-interview-deadlines',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/enforce-interview-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);