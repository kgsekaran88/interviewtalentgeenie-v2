
-- Update the cleanup-stale-proctoring schedule from every 5 minutes to every 1 hour
SELECT cron.unschedule('cleanup-stale-proctoring');

SELECT cron.schedule(
  'cleanup-stale-proctoring',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-stale-proctoring',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
