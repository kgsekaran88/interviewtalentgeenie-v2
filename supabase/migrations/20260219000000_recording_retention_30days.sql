-- =============================================================================
-- Recording retention: reduce default from 90 → 30 days
-- =============================================================================
-- Rationale: each interview produces ~800 MB (video + screen recording).
-- Hiring decisions are made within 2 weeks; 30 days is sufficient and reduces
-- storage costs by 3× compared to the previous 90-day default.
--
-- This updates:
--   1. The hardcoded fallback in cleanup_old_proctoring_recordings()
--   2. Any existing platform-level retention policy rows (organization_id IS NULL)
--   3. Adds a platform default row if none exists
-- =============================================================================

-- 1. Replace hardcoded 90-day interval in the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_proctoring_recordings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retention_days integer;
BEGIN
  -- Read platform-level retention setting; fall back to 30 days
  SELECT COALESCE(
    (SELECT retention_days FROM data_retention_policies
      WHERE data_type = 'proctoring_recordings'
        AND organization_id IS NULL
      LIMIT 1),
    30
  ) INTO v_retention_days;

  DELETE FROM storage.objects
  WHERE bucket_id = 'proctoring-recordings'
    AND created_at < NOW() - (v_retention_days || ' days')::interval;

  INSERT INTO audit_logs (
    action,
    resource_type,
    details,
    severity
  ) VALUES (
    'cleanup_proctoring_recordings',
    'storage',
    jsonb_build_object(
      'bucket', 'proctoring-recordings',
      'retention_days', v_retention_days,
      'timestamp', NOW()
    ),
    'info'
  );
END;
$$;

-- 2. Update any existing platform-level row
UPDATE data_retention_policies
SET retention_days = 30,
    updated_at     = NOW()
WHERE data_type       = 'proctoring_recordings'
  AND organization_id IS NULL;

-- 3. Insert platform default if none exists
INSERT INTO data_retention_policies (
  organization_id,
  data_type,
  retention_days,
  is_active
)
SELECT
  NULL,
  'proctoring_recordings',
  30,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM data_retention_policies
  WHERE data_type       = 'proctoring_recordings'
    AND organization_id IS NULL
);
