
-- Drop the old function first since return type changed
DROP FUNCTION IF EXISTS public.recalculate_all_cpi();

-- Recreate with new return type including total_violations
CREATE OR REPLACE FUNCTION public.recalculate_all_cpi()
RETURNS TABLE(
  attempt_id UUID,
  candidate_name TEXT,
  old_cpi NUMERIC,
  new_cpi NUMERIC,
  old_integrity NUMERIC,
  new_integrity NUMERIC,
  old_recommendation TEXT,
  new_recommendation TEXT,
  total_violations INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_technical_score NUMERIC;
  v_problem_solving_score NUMERIC;
  v_new_integrity NUMERIC;
  v_new_cpi NUMERIC;
  v_new_recommendation TEXT;
  v_violation_count INT;
BEGIN
  -- Loop through all completed/evaluated attempts with CPI records
  FOR rec IN 
    SELECT 
      ia.id,
      ia.candidate_name AS cand_name,
      cpi.technical_score,
      cpi.problem_solving_score,
      cpi.overall_cpi AS old_overall_cpi,
      cpi.integrity_score AS old_integrity_score,
      cpi.hiring_recommendation AS old_hiring_rec,
      ps.id AS proctoring_session_id,
      ps.violations
    FROM interview_attempts ia
    INNER JOIN candidate_performance_index cpi ON cpi.attempt_id = ia.id
    LEFT JOIN proctoring_sessions ps ON ps.interview_attempt_id = ia.id
    WHERE ia.status IN ('completed', 'evaluated')
  LOOP
    v_technical_score := rec.technical_score;
    v_problem_solving_score := rec.problem_solving_score;
    
    -- Calculate integrity from ALL violations in JSON array
    IF rec.proctoring_session_id IS NULL THEN
      v_new_integrity := 100;
      v_violation_count := 0;
    ELSIF rec.violations IS NULL OR jsonb_array_length(rec.violations::jsonb) = 0 THEN
      v_new_integrity := 100;
      v_violation_count := 0;
    ELSE
      v_new_integrity := calculate_integrity_from_violations(rec.violations::jsonb);
      v_violation_count := jsonb_array_length(rec.violations::jsonb);
    END IF;
    
    -- Calculate new CPI (60% technical + 40% problem solving)
    v_new_cpi := ROUND(
      (v_technical_score * 60 / 100) + (v_problem_solving_score * 40 / 100), 
      2
    );
    
    -- Determine new hiring recommendation
    IF v_new_cpi >= 85 AND v_new_integrity >= 90 THEN
      v_new_recommendation := 'strongly_recommend';
    ELSIF v_new_cpi >= 70 AND v_new_integrity >= 80 THEN
      v_new_recommendation := 'recommend';
    ELSIF v_new_cpi >= 50 AND v_new_integrity >= 70 THEN
      v_new_recommendation := 'consider';
    ELSE
      v_new_recommendation := 'not_recommended';
    END IF;
    
    -- Update CPI record
    UPDATE candidate_performance_index
    SET 
      overall_cpi = v_new_cpi,
      integrity_score = v_new_integrity,
      hiring_recommendation = v_new_recommendation,
      violations_detected = v_violation_count,
      updated_at = NOW()
    WHERE candidate_performance_index.attempt_id = rec.id;
    
    -- Update proctoring session integrity score if exists
    IF rec.proctoring_session_id IS NOT NULL THEN
      UPDATE proctoring_sessions
      SET integrity_score = v_new_integrity
      WHERE proctoring_sessions.id = rec.proctoring_session_id;
    END IF;
    
    -- Return result for this record
    attempt_id := rec.id;
    candidate_name := rec.cand_name;
    old_cpi := rec.old_overall_cpi;
    new_cpi := v_new_cpi;
    old_integrity := rec.old_integrity_score;
    new_integrity := v_new_integrity;
    old_recommendation := rec.old_hiring_rec;
    new_recommendation := v_new_recommendation;
    total_violations := v_violation_count;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;
