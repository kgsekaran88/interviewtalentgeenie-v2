-- Create helper functions for managing cron jobs from Edge Functions

-- Function to get all cron jobs
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT jobid, jobname, schedule, active, command
  FROM cron.job
  ORDER BY jobname;
$$;

-- Function to update cron job schedule
CREATE OR REPLACE FUNCTION public.update_cron_schedule(
  p_jobname text,
  p_schedule text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  UPDATE cron.job
  SET schedule = p_schedule
  WHERE jobname = p_jobname;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_jobname;
  END IF;
END;
$$;

-- Function to enable/disable cron job
CREATE OR REPLACE FUNCTION public.set_cron_job_status(
  p_jobname text,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  UPDATE cron.job
  SET active = p_active
  WHERE jobname = p_jobname;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_jobname;
  END IF;
END;
$$;

-- Grant execute permissions to authenticated users (Edge Function will check platform_admin role)
GRANT EXECUTE ON FUNCTION public.get_cron_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_cron_schedule(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cron_job_status(text, boolean) TO authenticated;