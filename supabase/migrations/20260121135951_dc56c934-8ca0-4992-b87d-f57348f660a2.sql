
-- Update toggle_violation_ignored to use the consistent calculate_integrity_from_violations function
CREATE OR REPLACE FUNCTION public.toggle_violation_ignored(
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
  v_violations JSONB;
  v_new_integrity_score NUMERIC;
  v_attempt_id UUID;
  v_overall_cpi NUMERIC;
  v_new_hiring_decision TEXT;
BEGIN
  -- Get current ignored list, violations, and attempt_id
  SELECT ps.ignored_violations, ps.violations, ps.interview_attempt_id
  INTO v_current_ignored, v_violations, v_attempt_id
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
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    INTO v_current_ignored
    FROM jsonb_array_elements(v_current_ignored) AS elem
    WHERE elem::text != ('"' || p_violation_id || '"');
  END IF;
  
  -- Recalculate integrity score using the consistent function
  v_new_integrity_score := calculate_integrity_from_violations(
    COALESCE(v_violations, '[]'::jsonb),
    v_current_ignored
  );
  
  -- Update proctoring session
  UPDATE proctoring_sessions
  SET 
    ignored_violations = v_current_ignored,
    integrity_score = v_new_integrity_score,
    updated_at = NOW()
  WHERE id = p_session_id;
  
  -- Get overall CPI for hiring decision calculation
  SELECT cpi.overall_cpi
  INTO v_overall_cpi
  FROM candidate_performance_index cpi
  WHERE cpi.attempt_id = v_attempt_id;
  
  -- Recalculate hiring decision using the same logic as calculate-cpi
  IF v_overall_cpi IS NOT NULL THEN
    IF v_overall_cpi >= 85 AND v_new_integrity_score >= 90 THEN
      v_new_hiring_decision := 'strongly_recommend';
    ELSIF v_overall_cpi >= 70 AND v_new_integrity_score >= 80 THEN
      v_new_hiring_decision := 'recommend';
    ELSIF v_overall_cpi >= 50 AND v_new_integrity_score >= 70 THEN
      v_new_hiring_decision := 'consider';
    ELSE
      v_new_hiring_decision := 'not_recommended';
    END IF;
    
    -- Update CPI with new integrity score and hiring recommendation
    UPDATE candidate_performance_index
    SET 
      integrity_score = v_new_integrity_score,
      hiring_recommendation = v_new_hiring_decision,
      updated_at = NOW()
    WHERE attempt_id = v_attempt_id;
    
    -- Also update assessments table if exists
    UPDATE assessments
    SET hiring_decision = v_new_hiring_decision
    WHERE attempt_id = v_attempt_id;
  END IF;
  
  success := true;
  new_integrity_score := v_new_integrity_score::integer;
  new_hiring_decision := v_new_hiring_decision;
  RETURN NEXT;
END;
$$;
