
-- Create a function to detect and flag stuck upload attempts
CREATE OR REPLACE FUNCTION public.flag_stuck_upload_attempts()
RETURNS TABLE(
  attempts_flagged integer,
  attempt_ids uuid[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts_flagged integer := 0;
  v_attempt_ids uuid[] := ARRAY[]::uuid[];
  v_cutoff_time timestamp with time zone;
BEGIN
  -- Consider uploads stuck if pending for more than 30 minutes
  v_cutoff_time := now() - interval '30 minutes';
  
  -- Find and update stuck interview attempts
  WITH stuck_attempts AS (
    UPDATE interview_attempts ia
    SET status = 'upload_incomplete'
    WHERE ia.status = 'pending_upload'
      AND ia.submitted_at < v_cutoff_time
    RETURNING ia.id
  )
  SELECT COUNT(*)::integer, ARRAY_AGG(id)
  INTO v_attempts_flagged, v_attempt_ids
  FROM stuck_attempts;
  
  -- Update corresponding proctoring sessions
  UPDATE proctoring_sessions ps
  SET review_status = 'upload_incomplete',
      reviewer_notes = COALESCE(reviewer_notes, '') || 
        CASE WHEN reviewer_notes IS NOT NULL AND reviewer_notes != '' THEN '; ' ELSE '' END ||
        'Auto-flagged: Upload incomplete after 30 minutes',
      flagged_for_review = true,
      updated_at = now()
  WHERE ps.interview_attempt_id = ANY(v_attempt_ids)
    AND (ps.review_status IS NULL OR ps.review_status NOT IN ('upload_incomplete', 'approved', 'rejected'));
  
  -- Log the operation
  IF v_attempts_flagged > 0 THEN
    INSERT INTO audit_logs (action, table_name, record_id, metadata)
    VALUES (
      'auto_flag_stuck_uploads',
      'interview_attempts',
      NULL,
      jsonb_build_object(
        'attempts_flagged', v_attempts_flagged,
        'attempt_ids', v_attempt_ids,
        'cutoff_time', v_cutoff_time
      )
    );
  END IF;
  
  RETURN QUERY SELECT v_attempts_flagged, v_attempt_ids;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.flag_stuck_upload_attempts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_stuck_upload_attempts() TO service_role;
