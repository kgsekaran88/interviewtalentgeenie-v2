-- Comprehensive migration to fix ALL false positive severities

-- Step 1: Update copy_attempt violations from high to low (already done but ensuring all are caught)
UPDATE proctoring_sessions
SET detailed_violations = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'type' = 'copy_attempt' AND elem->>'severity' != 'low' THEN 
        jsonb_set(elem, '{severity}', '"low"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(detailed_violations) AS elem
)
WHERE detailed_violations IS NOT NULL 
  AND jsonb_array_length(detailed_violations) > 0
  AND detailed_violations::text LIKE '%copy_attempt%';

-- Step 2: Update look_away and extended inactivity violations to low severity
UPDATE proctoring_sessions
SET detailed_violations = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'type' IN ('look_away', 'looking_away', 'extended_inactivity') 
           AND elem->>'severity' IN ('high', 'medium') THEN 
        jsonb_set(elem, '{severity}', '"low"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(detailed_violations) AS elem
)
WHERE detailed_violations IS NOT NULL 
  AND jsonb_array_length(detailed_violations) > 0
  AND (detailed_violations::text LIKE '%look_away%' 
       OR detailed_violations::text LIKE '%looking_away%'
       OR detailed_violations::text LIKE '%extended_inactivity%');

-- Step 3: Update poor_lighting violations to low (if face visible, shouldn't be severe)
UPDATE proctoring_sessions
SET detailed_violations = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'type' IN ('poor_lighting', 'lighting') 
           AND elem->>'severity' IN ('high', 'medium') THEN 
        jsonb_set(elem, '{severity}', '"low"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(detailed_violations) AS elem
)
WHERE detailed_violations IS NOT NULL 
  AND jsonb_array_length(detailed_violations) > 0
  AND (detailed_violations::text LIKE '%poor_lighting%' 
       OR detailed_violations::text LIKE '%lighting%');

-- Step 4: Update suspicious_screen_content that don't mention AI tools, tab/window changes to medium
-- Only keep high severity for actual cheating indicators
UPDATE proctoring_sessions
SET detailed_violations = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'type' IN ('suspicious_screen_content', 'screen_content_finding')
           AND elem->>'severity' = 'high'
           AND NOT (
             LOWER(elem->>'description') LIKE '%chatgpt%'
             OR LOWER(elem->>'description') LIKE '%claude%'
             OR LOWER(elem->>'description') LIKE '%bard%'
             OR LOWER(elem->>'description') LIKE '%copilot%'
             OR LOWER(elem->>'description') LIKE '%ai tool%'
             OR LOWER(elem->>'description') LIKE '%ai assistant%'
             OR LOWER(elem->>'description') LIKE '%tab switch%'
             OR LOWER(elem->>'description') LIKE '%window change%'
             OR LOWER(elem->>'description') LIKE '%nested screen%'
             OR LOWER(elem->>'description') LIKE '%remote desktop%'
             OR LOWER(elem->>'description') LIKE '%teamviewer%'
             OR LOWER(elem->>'description') LIKE '%anydesk%'
             OR LOWER(elem->>'description') LIKE '%streaming%'
           )
      THEN jsonb_set(elem, '{severity}', '"medium"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(detailed_violations) AS elem
)
WHERE detailed_violations IS NOT NULL 
  AND jsonb_array_length(detailed_violations) > 0
  AND detailed_violations::text LIKE '%screen_content%';

-- Step 5: Update face_at_edge to low (minor positioning issue)
UPDATE proctoring_sessions
SET detailed_violations = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'type' = 'face_at_edge' AND elem->>'severity' IN ('high', 'medium') THEN 
        jsonb_set(elem, '{severity}', '"low"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(detailed_violations) AS elem
)
WHERE detailed_violations IS NOT NULL 
  AND jsonb_array_length(detailed_violations) > 0
  AND detailed_violations::text LIKE '%face_at_edge%';

-- Step 6: Create and run recalculation function
CREATE OR REPLACE FUNCTION recalculate_all_integrity_scores_v2()
RETURNS TABLE(updated_count integer, decision_changes integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_violation JSONB;
  v_new_score INTEGER;
  v_deduction INTEGER;
  v_updated INTEGER := 0;
  v_decisions_changed INTEGER := 0;
  v_ignored JSONB;
  v_attempt_id UUID;
  v_overall_score NUMERIC;
  v_new_decision TEXT;
  v_old_decision TEXT;
BEGIN
  FOR v_session IN 
    SELECT id, detailed_violations, ignored_violations, interview_attempt_id, integrity_score
    FROM proctoring_sessions
    WHERE detailed_violations IS NOT NULL 
      AND jsonb_array_length(COALESCE(detailed_violations, '[]'::jsonb)) > 0
  LOOP
    v_new_score := 100;
    v_ignored := COALESCE(v_session.ignored_violations, '[]'::jsonb);
    
    -- Calculate new integrity score
    FOR v_violation IN SELECT * FROM jsonb_array_elements(v_session.detailed_violations)
    LOOP
      -- Skip ignored violations
      IF v_ignored @> to_jsonb(v_violation->>'type') THEN
        CONTINUE;
      END IF;
      
      v_deduction := CASE v_violation->>'severity'
        WHEN 'high' THEN 15
        WHEN 'medium' THEN 8
        WHEN 'low' THEN 3
        ELSE 5
      END;
      
      v_new_score := GREATEST(0, v_new_score - v_deduction);
    END LOOP;
    
    -- Update proctoring session
    UPDATE proctoring_sessions
    SET integrity_score = v_new_score, updated_at = NOW()
    WHERE id = v_session.id;
    
    v_updated := v_updated + 1;
    
    -- Update hiring decision if assessment exists
    IF v_session.interview_attempt_id IS NOT NULL THEN
      SELECT a.overall_score, a.hiring_decision
      INTO v_overall_score, v_old_decision
      FROM assessments a
      WHERE a.attempt_id = v_session.interview_attempt_id;
      
      IF v_overall_score IS NOT NULL THEN
        -- Apply hiring decision rules
        IF v_new_score < 50 THEN
          v_new_decision := 'reject';
        ELSIF v_overall_score < 60 THEN
          v_new_decision := 'reject';
        ELSIF v_new_score <= 70 THEN
          v_new_decision := 'consider';
        ELSIF v_overall_score >= 85 THEN
          v_new_decision := 'strong_hire';
        ELSIF v_overall_score >= 70 THEN
          v_new_decision := 'hire';
        ELSE
          v_new_decision := 'consider';
        END IF;
        
        -- Update assessment
        UPDATE assessments
        SET hiring_decision = v_new_decision
        WHERE attempt_id = v_session.interview_attempt_id;
        
        -- Update CPI
        UPDATE candidate_performance_index
        SET integrity_score = v_new_score,
            hiring_recommendation = v_new_decision,
            updated_at = NOW()
        WHERE attempt_id = v_session.interview_attempt_id;
        
        IF v_old_decision IS DISTINCT FROM v_new_decision THEN
          v_decisions_changed := v_decisions_changed + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_updated, v_decisions_changed;
END;
$$;

-- Execute recalculation
SELECT * FROM recalculate_all_integrity_scores_v2();

-- Cleanup
DROP FUNCTION IF EXISTS recalculate_all_integrity_scores_v2();