-- Update save_interview_evaluation_tx to accept question_scores parameter
CREATE OR REPLACE FUNCTION public.save_interview_evaluation_tx(
  p_attempt_id uuid, 
  p_overall_score integer, 
  p_hiring_decision text, 
  p_strengths text[], 
  p_weaknesses text[], 
  p_topic_scores jsonb, 
  p_detailed_analysis text, 
  p_technical_score numeric, 
  p_problem_solving_score numeric, 
  p_integrity_score numeric, 
  p_candidate_name text, 
  p_candidate_email text, 
  p_top_skills text[], 
  p_weak_skills text[], 
  p_violations_detected integer DEFAULT 0,
  p_question_scores jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempt RECORD;
  v_cpi numeric;
  v_assessment_id uuid;
BEGIN
  -- Verify attempt exists
  SELECT * INTO v_attempt FROM interview_attempts WHERE id = p_attempt_id;
  IF v_attempt IS NULL THEN
    RAISE EXCEPTION 'Interview attempt not found';
  END IF;

  -- Create or update assessment (now includes question_scores)
  INSERT INTO assessments (attempt_id, overall_score, hiring_decision, strengths, weaknesses, topic_scores, detailed_analysis, question_scores)
  VALUES (p_attempt_id, p_overall_score, p_hiring_decision, p_strengths, p_weaknesses, p_topic_scores, p_detailed_analysis, p_question_scores)
  ON CONFLICT (attempt_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    hiring_decision = EXCLUDED.hiring_decision,
    strengths = EXCLUDED.strengths,
    weaknesses = EXCLUDED.weaknesses,
    topic_scores = EXCLUDED.topic_scores,
    detailed_analysis = EXCLUDED.detailed_analysis,
    question_scores = EXCLUDED.question_scores
  RETURNING id INTO v_assessment_id;

  -- Calculate CPI
  v_cpi := calculate_cpi_score(p_technical_score, p_problem_solving_score, p_integrity_score);

  -- Create or update CPI
  INSERT INTO candidate_performance_index (
    attempt_id, interview_id, candidate_name, candidate_email,
    technical_score, problem_solving_score, integrity_score, overall_cpi,
    hiring_recommendation, top_skills, weak_skills, topic_scores, violations_detected
  )
  VALUES (
    p_attempt_id, v_attempt.interview_id, p_candidate_name, p_candidate_email,
    p_technical_score, p_problem_solving_score, p_integrity_score, v_cpi,
    p_hiring_decision, p_top_skills, p_weak_skills, p_topic_scores, p_violations_detected
  )
  ON CONFLICT (attempt_id) DO UPDATE SET
    technical_score = EXCLUDED.technical_score,
    problem_solving_score = EXCLUDED.problem_solving_score,
    integrity_score = EXCLUDED.integrity_score,
    overall_cpi = EXCLUDED.overall_cpi,
    hiring_recommendation = EXCLUDED.hiring_recommendation,
    top_skills = EXCLUDED.top_skills,
    weak_skills = EXCLUDED.weak_skills,
    topic_scores = EXCLUDED.topic_scores,
    violations_detected = EXCLUDED.violations_detected,
    updated_at = NOW();

  -- Update attempt status
  UPDATE interview_attempts 
  SET status = 'evaluated'
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'attempt_id', p_attempt_id,
    'assessment_id', v_assessment_id,
    'cpi_score', v_cpi
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Interview evaluation failed: %', SQLERRM;
END;
$$;