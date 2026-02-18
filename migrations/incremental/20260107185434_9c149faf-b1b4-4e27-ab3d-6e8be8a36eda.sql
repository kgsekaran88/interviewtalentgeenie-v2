-- Fix: Resume existing in_progress attempts instead of creating duplicates
CREATE OR REPLACE FUNCTION public.create_interview_attempt_with_invitation(p_invitation_id uuid, p_candidate_name text, p_candidate_email text)
 RETURNS TABLE(attempt_id uuid, session_token text, success boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt_id UUID;
  v_session_token TEXT;
  v_invitation RECORD;
  v_existing_attempt RECORD;
  v_question_ids uuid[];
BEGIN
  -- Validate inputs
  IF p_candidate_name IS NULL OR LENGTH(TRIM(p_candidate_name)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Name is required';
    RETURN;
  END IF;

  IF p_candidate_email IS NULL OR LENGTH(TRIM(p_candidate_email)) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Email is required';
    RETURN;
  END IF;

  -- Fetch and validate invitation
  SELECT * INTO v_invitation
  FROM public.interview_invitations
  WHERE id = p_invitation_id;

  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Invalid invitation';
    RETURN;
  END IF;

  -- Check if invitation has expired
  IF v_invitation.expires_at < NOW() THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Invitation has expired';
    RETURN;
  END IF;

  -- Validate email matches invitation
  IF LOWER(TRIM(p_candidate_email)) != LOWER(TRIM(v_invitation.candidate_email)) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Email does not match invitation. Please use the email address that received this invitation.';
    RETURN;
  END IF;

  -- Check if invitation already used (only block if status is 'completed')
  IF v_invitation.status = 'completed' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'This invitation has already been used. Each candidate can only attempt once.';
    RETURN;
  END IF;

  -- Check if interview is active
  IF NOT EXISTS (
    SELECT 1 FROM public.interviews 
    WHERE id = v_invitation.interview_id 
    AND status = 'active'
  ) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'Interview is not active';
    RETURN;
  END IF;

  -- **NEW: Check for existing in_progress attempt for this invitation**
  SELECT id, session_token INTO v_existing_attempt
  FROM public.interview_attempts
  WHERE invitation_id = p_invitation_id
    AND status = 'in_progress'
  ORDER BY created_at DESC
  LIMIT 1;

  -- If existing in_progress attempt found, resume it
  IF v_existing_attempt.id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_attempt.id, v_existing_attempt.session_token, TRUE, NULL::TEXT;
    RETURN;
  END IF;

  -- **NEW: Also check for submitted/evaluated attempt (already completed)**
  IF EXISTS (
    SELECT 1 FROM public.interview_attempts
    WHERE invitation_id = p_invitation_id
      AND status IN ('submitted', 'evaluated')
  ) THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE, 'You have already completed this interview.';
    RETURN;
  END IF;

  -- Generate session token
  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  -- Create interview attempt with invitation link
  INSERT INTO public.interview_attempts (
    interview_id,
    invitation_id,
    candidate_name,
    candidate_email,
    status,
    session_token
  ) VALUES (
    v_invitation.interview_id,
    p_invitation_id,
    TRIM(p_candidate_name),
    TRIM(p_candidate_email),
    'in_progress',
    v_session_token
  )
  RETURNING id INTO v_attempt_id;

  -- Update invitation status to 'accessed'
  UPDATE public.interview_invitations
  SET 
    status = 'accessed',
    accessed_at = NOW()
  WHERE id = p_invitation_id;

  -- Extract selected question IDs from invitation metadata
  v_question_ids := ARRAY(
    SELECT jsonb_array_elements_text(v_invitation.metadata->'selected_question_ids')::uuid
  );

  -- Populate attempt_questions with pre-selected questions
  INSERT INTO public.attempt_questions (attempt_id, question_id, display_order)
  SELECT 
    v_attempt_id,
    unnest(v_question_ids),
    generate_series(0, array_length(v_question_ids, 1) - 1);

  RETURN QUERY SELECT v_attempt_id, v_session_token, TRUE, NULL::TEXT;
END;
$function$;