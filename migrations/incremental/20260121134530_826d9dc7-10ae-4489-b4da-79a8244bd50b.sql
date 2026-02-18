
-- Create a function to recalculate CPI for all candidates
-- This recalculates integrity from violation counts and updates hiring recommendation
CREATE OR REPLACE FUNCTION public.recalculate_all_cpi()
RETURNS TABLE(
  attempt_id UUID,
  candidate_name TEXT,
  old_cpi NUMERIC,
  new_cpi NUMERIC,
  old_integrity NUMERIC,
  new_integrity NUMERIC,
  old_recommendation TEXT,
  new_recommendation TEXT
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
  v_mp INT;
  v_mv INT;
  v_ts INT;
  v_la INT;
  v_ca INT;
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
      COALESCE(ps.multiple_person_detections, 0) AS mp,
      COALESCE(ps.multiple_voice_detections, 0) AS mv,
      COALESCE(ps.tab_switch_count, 0) AS ts,
      COALESCE(ps.look_away_count, 0) AS la,
      COALESCE(ps.copy_attempt_count, 0) AS ca,
      ps.id AS proctoring_session_id
    FROM interview_attempts ia
    INNER JOIN candidate_performance_index cpi ON cpi.attempt_id = ia.id
    LEFT JOIN proctoring_sessions ps ON ps.interview_attempt_id = ia.id
    WHERE ia.status IN ('completed', 'evaluated')
  LOOP
    v_technical_score := rec.technical_score;
    v_problem_solving_score := rec.problem_solving_score;
    
    -- Calculate integrity from violation counts (ALL violations, not ignored ones)
    v_mp := rec.mp;
    v_mv := rec.mv;
    v_ts := rec.ts;
    v_la := rec.la;
    v_ca := rec.ca;
    
    IF v_mp = 0 AND v_mv = 0 AND v_ts = 0 AND v_la = 0 AND v_ca = 0 THEN
      v_new_integrity := 100;
    ELSE
      -- Deduct: multiple person/voice/copy = -15, tab switch = -5, look away = -3
      v_new_integrity := GREATEST(0, 100 - (v_mp * 15) - (v_mv * 15) - (v_ca * 15) - (v_ts * 5) - (v_la * 3));
    END IF;
    
    -- If no proctoring session, integrity defaults to 100
    IF rec.proctoring_session_id IS NULL THEN
      v_new_integrity := 100;
    END IF;
    
    -- Calculate new CPI (now only technical + problem solving, no integrity)
    -- Using 60% technical, 40% problem solving
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
      violations_detected = v_mp + v_mv + v_ts + v_la + v_ca,
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
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;
