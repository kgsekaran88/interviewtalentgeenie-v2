-- Drop the existing function first (return type is changing)
DROP FUNCTION IF EXISTS public.toggle_violation_ignored(uuid, text, boolean);

-- Recreate with updated logic to also update hiring decision
CREATE FUNCTION public.toggle_violation_ignored(
  p_session_id uuid, 
  p_violation_id text, 
  p_ignore boolean
) 
RETURNS TABLE(success boolean, new_integrity_score integer, new_hiring_decision text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_ignored JSONB;
  v_detailed_violations JSONB;
  v_new_integrity_score INTEGER;
  v_violation JSONB;
  v_deduction INTEGER;
  v_violation_type TEXT;
  v_attempt_id UUID;
  v_overall_score NUMERIC;
  v_new_hiring_decision TEXT;
  v_current_decision TEXT;
BEGIN
  -- Get current ignored list, violations, and attempt_id
  SELECT ps.ignored_violations, ps.detailed_violations, ps.interview_attempt_id
  INTO v_current_ignored, v_detailed_violations, v_attempt_id
  FROM proctoring_sessions ps
  WHERE ps.id = p_session_id;
  
  IF v_current_ignored IS NULL THEN
    v_current_ignored := '[]'::jsonb;
  END IF;
  
  -- Update ignored list
  IF p_ignore THEN
    IF NOT v_current_ignored @> to_jsonb(p_violation_id) THEN
      v_current_ignored := v_current_ignored || to_jsonb(p_violation_id);
    END IF;
  ELSE
    SELECT jsonb_agg(elem)
    INTO v_current_ignored
    FROM jsonb_array_elements(v_current_ignored) AS elem
    WHERE elem::text != ('"' || p_violation_id || '"');
    
    IF v_current_ignored IS NULL THEN
      v_current_ignored := '[]'::jsonb;
    END IF;
  END IF;
  
  -- Recalculate integrity score
  v_new_integrity_score := 100;
  
  IF v_detailed_violations IS NOT NULL AND jsonb_array_length(v_detailed_violations) > 0 THEN
    FOR v_violation IN SELECT * FROM jsonb_array_elements(v_detailed_violations)
    LOOP
      v_violation_type := v_violation->>'type';
      
      -- Skip ignored violations
      IF v_current_ignored @> to_jsonb(v_violation_type) THEN
        CONTINUE;
      END IF;
      
      v_deduction := CASE v_violation->>'severity'
        WHEN 'high' THEN 15
        WHEN 'medium' THEN 8
        WHEN 'low' THEN 3
        ELSE 5
      END;
      
      v_new_integrity_score := GREATEST(0, v_new_integrity_score - v_deduction);
    END LOOP;
  END IF;
  
  -- Update proctoring session
  UPDATE proctoring_sessions
  SET 
    ignored_violations = v_current_ignored,
    integrity_score = v_new_integrity_score,
    updated_at = NOW()
  WHERE id = p_session_id;
  
  -- Get current assessment info if exists
  SELECT a.overall_score, a.hiring_decision
  INTO v_overall_score, v_current_decision
  FROM assessments a
  WHERE a.attempt_id = v_attempt_id;
  
  -- Recalculate hiring decision if assessment exists
  IF v_overall_score IS NOT NULL THEN
    -- Apply hiring decision rules based on integrity and overall score
    IF v_new_integrity_score < 50 THEN
      -- Severe integrity issues = automatic rejection
      v_new_hiring_decision := 'reject';
    ELSIF v_overall_score < 60 THEN
      -- Poor technical performance = rejection
      v_new_hiring_decision := 'reject';
    ELSIF v_new_integrity_score <= 70 THEN
      -- Integrity concerns = consider (needs manual review)
      v_new_hiring_decision := 'consider';
    ELSIF v_overall_score >= 85 THEN
      v_new_hiring_decision := 'strong_hire';
    ELSIF v_overall_score >= 70 THEN
      v_new_hiring_decision := 'hire';
    ELSE
      v_new_hiring_decision := 'consider';
    END IF;
    
    -- Update assessment with new hiring decision
    UPDATE assessments
    SET hiring_decision = v_new_hiring_decision
    WHERE attempt_id = v_attempt_id;
    
    -- Also update CPI integrity score if exists
    UPDATE candidate_performance_index
    SET 
      integrity_score = v_new_integrity_score,
      hiring_recommendation = v_new_hiring_decision,
      updated_at = NOW()
    WHERE attempt_id = v_attempt_id;
  ELSE
    v_new_hiring_decision := v_current_decision;
  END IF;
  
  RETURN QUERY SELECT TRUE, v_new_integrity_score, v_new_hiring_decision;
END;
$$;