-- Recalculate integrity scores for all sessions (glasses_reflection already updated to low)
CREATE OR REPLACE FUNCTION recalculate_integrity_after_glasses_fix()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  session_record RECORD;
  v_element jsonb;
  new_score INTEGER;
  violation_deduction INTEGER;
  current_overall_score NUMERIC;
BEGIN
  FOR session_record IN 
    SELECT ps.id, ps.detailed_violations, ps.ignored_violations, ps.interview_attempt_id
    FROM proctoring_sessions ps
    WHERE ps.detailed_violations IS NOT NULL 
      AND jsonb_array_length(ps.detailed_violations) > 0
  LOOP
    new_score := 100;
    
    FOR v_element IN SELECT * FROM jsonb_array_elements(session_record.detailed_violations)
    LOOP
      IF session_record.ignored_violations IS NOT NULL 
         AND session_record.ignored_violations ? (v_element->>'id') THEN
        CONTINUE;
      END IF;
      
      CASE v_element->>'severity'
        WHEN 'high' THEN violation_deduction := 15;
        WHEN 'medium' THEN violation_deduction := 8;
        WHEN 'low' THEN violation_deduction := 3;
        ELSE violation_deduction := 5;
      END CASE;
      
      new_score := GREATEST(0, new_score - violation_deduction);
    END LOOP;
    
    UPDATE proctoring_sessions 
    SET integrity_score = new_score 
    WHERE id = session_record.id;
    
    IF session_record.interview_attempt_id IS NOT NULL THEN
      SELECT overall_score INTO current_overall_score
      FROM assessments WHERE attempt_id = session_record.interview_attempt_id;
      
      IF current_overall_score IS NOT NULL THEN
        UPDATE assessments
        SET hiring_decision = CASE
          WHEN new_score < 50 THEN 'reject'
          WHEN current_overall_score < 60 THEN 'reject'
          WHEN new_score <= 70 THEN 'consider'
          WHEN current_overall_score >= 85 THEN 'strong_hire'
          WHEN current_overall_score >= 70 THEN 'hire'
          ELSE 'consider'
        END
        WHERE attempt_id = session_record.interview_attempt_id;
        
        UPDATE candidate_performance_index
        SET 
          integrity_score = new_score,
          hiring_recommendation = CASE
            WHEN new_score < 50 THEN 'reject'
            WHEN current_overall_score < 60 THEN 'reject'
            WHEN new_score <= 70 THEN 'consider'
            WHEN current_overall_score >= 85 THEN 'strong_hire'
            WHEN current_overall_score >= 70 THEN 'hire'
            ELSE 'consider'
          END
        WHERE attempt_id = session_record.interview_attempt_id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

SELECT recalculate_integrity_after_glasses_fix();

DROP FUNCTION recalculate_integrity_after_glasses_fix();