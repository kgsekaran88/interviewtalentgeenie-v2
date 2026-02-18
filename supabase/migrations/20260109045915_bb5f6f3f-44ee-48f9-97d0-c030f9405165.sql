-- Update the update_attempt_with_session function to enforce time limits server-side
CREATE OR REPLACE FUNCTION public.update_attempt_with_session(token text, attempt_answers jsonb, seconds_taken integer)
 RETURNS TABLE(success boolean, attempt_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt_id UUID;
  v_status TEXT;
  v_interview_id UUID;
  v_proctoring_enabled BOOLEAN;
  v_time_limit INTEGER;
  v_created_at TIMESTAMPTZ;
  v_elapsed_seconds INTEGER;
  v_max_allowed_seconds INTEGER;
  v_new_status TEXT;
BEGIN
  IF token IS NULL OR LENGTH(token) = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  IF attempt_answers IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- Get attempt info including time limit and proctoring status
  SELECT ia.id, ia.status, ia.interview_id, ia.created_at, i.proctoring_enabled, i.time_limit
  INTO v_attempt_id, v_status, v_interview_id, v_created_at, v_proctoring_enabled, v_time_limit
  FROM public.interview_attempts ia
  JOIN public.interviews i ON i.id = ia.interview_id
  WHERE ia.session_token = token
  AND ia.session_token IS NOT NULL
  AND LENGTH(ia.session_token) > 0;

  IF v_attempt_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  IF v_status != 'in_progress' THEN
    RETURN QUERY SELECT FALSE, v_attempt_id;
    RETURN;
  END IF;

  -- SERVER-SIDE TIME LIMIT ENFORCEMENT
  -- Calculate actual elapsed time from attempt creation
  v_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_created_at))::INTEGER;
  
  -- If time limit is set, enforce it (with 60 second grace period for network delays)
  IF v_time_limit IS NOT NULL AND v_time_limit > 0 THEN
    v_max_allowed_seconds := (v_time_limit * 60) + 60; -- time_limit is in minutes, add 60s grace
    
    -- If submission is too late, still accept but cap the time_taken to the limit
    IF v_elapsed_seconds > v_max_allowed_seconds THEN
      -- Cap the time_taken to the actual limit (no credit for extra time)
      seconds_taken := v_time_limit * 60;
    END IF;
  END IF;

  -- For proctored interviews, set to pending_upload (evaluation happens after video upload)
  -- For non-proctored interviews, set to submitted (trigger evaluation immediately)
  v_new_status := CASE WHEN v_proctoring_enabled THEN 'pending_upload' ELSE 'submitted' END;

  UPDATE public.interview_attempts
  SET 
    answers = attempt_answers,
    time_taken = seconds_taken,
    status = v_new_status,
    submitted_at = NOW()
  WHERE id = v_attempt_id;

  RETURN QUERY SELECT TRUE, v_attempt_id;
END;
$function$;