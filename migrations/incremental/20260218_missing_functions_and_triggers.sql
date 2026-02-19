-- ============================================================================
-- Missing Functions & Triggers Migration
-- Generated: 2026-02-18
-- Source: interviewtalentgeenie (Cloud project) migration files
--
-- This file consolidates all database functions and triggers that exist in
-- the Cloud project but are missing from interviewtalentgeenie-v2.
--
-- DEPENDENCIES:
--   - pg_cron extension (required by: get_cron_jobs, update_cron_schedule,
--     set_cron_job_status — these reference the cron.job table)
--   - Tables: organizations, organization_members, user_roles,
--     interview_attempts, proctoring_sessions, candidate_performance_index,
--     assessments, evaluation_queue, audit_logs, interviews, questions,
--     interview_invitations, proctoring_settings
-- ============================================================================


-- ============================================================================
-- 1. add_platform_admin_to_talentgeenie()
--    Source: 20260107193035_309f193d-15ca-40bb-b491-fc36f5580463.sql
--    Purpose: Auto-adds users granted platform_admin role to the TalentGeenie
--             organization as active members.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_platform_admin_to_talentgeenie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  talentgeenie_org_id uuid;
  member_exists boolean;
BEGIN
  -- Only proceed if the role being added is platform_admin
  IF NEW.role = 'platform_admin' THEN
    -- Get TalentGeenie org ID
    SELECT id INTO talentgeenie_org_id 
    FROM organizations 
    WHERE name = 'TalentGeenie'
    LIMIT 1;
    
    -- If TalentGeenie org exists, check if member already exists
    IF talentgeenie_org_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM organization_members 
        WHERE user_id = NEW.user_id 
        AND organization_id = talentgeenie_org_id
      ) INTO member_exists;
      
      -- Only insert if not already a member
      IF NOT member_exists THEN
        INSERT INTO organization_members (user_id, organization_id, status)
        VALUES (NEW.user_id, talentgeenie_org_id, 'active');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger: on_platform_admin_role_added
-- Source: 20260107193035_309f193d-15ca-40bb-b491-fc36f5580463.sql
DROP TRIGGER IF EXISTS on_platform_admin_role_added ON user_roles;
CREATE TRIGGER on_platform_admin_role_added
  AFTER INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.add_platform_admin_to_talentgeenie();


-- ============================================================================
-- 2. calculate_integrity_from_violations()
--    Source: 20260122144418_e5be4be2-e64d-43fc-85a5-efad049b357e.sql
--    Purpose: Calculates an integrity score (0–100) from a JSONB array of
--             proctoring violations, supporting org-specific proctoring
--             settings and ignored-violation filtering.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_integrity_from_violations(
  p_violations jsonb, 
  p_ignored_violations jsonb DEFAULT '[]'::jsonb,
  p_organization_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_score NUMERIC := 100;
  v_violation JSONB;
  v_type TEXT;
  v_normalized_type TEXT;
  v_deduction NUMERIC;
  v_config RECORD;
  v_has_config BOOLEAN := FALSE;
BEGIN
  -- If no violations, return 100
  IF p_violations IS NULL OR jsonb_array_length(p_violations) = 0 THEN
    RETURN 100;
  END IF;
  
  -- Ensure ignored_violations is not null
  IF p_ignored_violations IS NULL THEN
    p_ignored_violations := '[]'::JSONB;
  END IF;
  
  -- Try to fetch org-specific proctoring settings
  IF p_organization_id IS NOT NULL THEN
    SELECT * INTO v_config
    FROM proctoring_settings
    WHERE organization_id = p_organization_id
    LIMIT 1;
    
    IF FOUND THEN
      v_has_config := TRUE;
    END IF;
  END IF;
  
  -- Loop through each violation and deduct points based on type
  FOR v_violation IN SELECT * FROM jsonb_array_elements(p_violations)
  LOOP
    v_type := v_violation->>'type';
    
    -- Skip if violation has ignored flag set to true
    IF (v_violation->>'ignored')::boolean = true THEN
      CONTINUE;
    END IF;
    
    -- Skip if violation type is in the ignored_violations array
    IF p_ignored_violations @> to_jsonb(v_type) THEN
      CONTINUE;
    END IF;
    
    -- Normalize type for matching
    v_normalized_type := LOWER(REPLACE(v_type, '-', '_'));
    
    -- Check if violation type is enabled (if org config exists)
    IF v_has_config THEN
      IF v_normalized_type IN ('different_person_detected', 'different_person') AND NOT COALESCE(v_config.enabled_different_person_detected, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('identity_verification_uncertain', 'identity_uncertain') AND NOT COALESCE(v_config.enabled_identity_verification_uncertain, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('phone_detected', 'phone_in_video') AND NOT COALESCE(v_config.enabled_phone_detected, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('headphones_detected', 'earbuds_detected', 'airpods_detected') AND NOT COALESCE(v_config.enabled_headphones_detected, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('suspicious_background_objects', 'suspicious_background', 'prohibited_object') AND NOT COALESCE(v_config.enabled_suspicious_background_objects, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('suspicious_screen_content', 'screen_content_finding') AND NOT COALESCE(v_config.enabled_suspicious_screen_content, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('no_person_in_frame') AND NOT COALESCE(v_config.enabled_no_person_in_frame, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('face_at_edge') AND NOT COALESCE(v_config.enabled_face_at_edge, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('face_occluded') AND NOT COALESCE(v_config.enabled_face_occluded, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('poor_lighting') AND NOT COALESCE(v_config.enabled_poor_lighting, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('looking_away', 'look_away', 'look_away_video') AND NOT COALESCE(v_config.enabled_looking_away, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('eye_gaze_off_screen') AND NOT COALESCE(v_config.enabled_eye_gaze_off_screen, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('tab_switch') AND NOT COALESCE(v_config.enabled_tab_switch, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('copy_attempt') AND NOT COALESCE(v_config.enabled_copy_attempt, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('print_screen') AND NOT COALESCE(v_config.enabled_print_screen, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('multiple_voices') AND NOT COALESCE(v_config.enabled_multiple_voices, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('audio_playback') AND NOT COALESCE(v_config.enabled_audio_playback, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('external_conversation') AND NOT COALESCE(v_config.enabled_external_conversation, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('multiple_monitors', 'second_monitor_suspected') AND NOT COALESCE(v_config.enabled_multiple_monitors, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('virtual_machine', 'vm_detected') AND NOT COALESCE(v_config.enabled_virtual_machine, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('background_changed') AND NOT COALESCE(v_config.enabled_background_changed, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('clothing_changed') AND NOT COALESCE(v_config.enabled_clothing_changed, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('suspicious_typing') AND NOT COALESCE(v_config.enabled_suspicious_typing, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('reading_pattern') AND NOT COALESCE(v_config.enabled_reading_pattern, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('multiple_speakers') AND NOT COALESCE(v_config.enabled_multiple_speakers, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('nested_screen_sharing') AND NOT COALESCE(v_config.enabled_nested_screen_sharing, TRUE) THEN CONTINUE; END IF;
      IF v_normalized_type IN ('paste_in_code_editor', 'paste_detected', 'code_paste') AND NOT COALESCE(v_config.enabled_paste_in_code_editor, TRUE) THEN CONTINUE; END IF;
    END IF;
    
    -- Determine deduction - use org config scores if available, else defaults
    IF v_has_config THEN
      v_deduction := CASE v_normalized_type
        -- Very High severity
        WHEN 'different_person_detected' THEN COALESCE(v_config.score_different_person_detected, 15)
        WHEN 'different_person' THEN COALESCE(v_config.score_different_person_detected, 15)
        WHEN 'multiple_persons_video' THEN COALESCE(v_config.score_different_person_detected, 15)
        WHEN 'phone_detected' THEN COALESCE(v_config.score_phone_detected, 15)
        WHEN 'phone_in_video' THEN COALESCE(v_config.score_phone_detected, 15)
        WHEN 'suspicious_screen_content' THEN COALESCE(v_config.score_suspicious_screen_content, 15)
        WHEN 'screen_content_finding' THEN COALESCE(v_config.score_suspicious_screen_content, 15)
        WHEN 'nested_screen_sharing' THEN COALESCE(v_config.score_nested_screen_sharing, 15)
        
        -- High severity
        WHEN 'no_person_in_frame' THEN COALESCE(v_config.score_no_person_in_frame, 10)
        WHEN 'virtual_machine' THEN COALESCE(v_config.score_virtual_machine, 10)
        WHEN 'vm_detected' THEN COALESCE(v_config.score_virtual_machine, 10)
        WHEN 'external_conversation' THEN COALESCE(v_config.score_external_conversation, 10)
        
        -- Medium-High severity
        WHEN 'identity_verification_uncertain' THEN COALESCE(v_config.score_identity_verification_uncertain, 8)
        WHEN 'identity_uncertain' THEN COALESCE(v_config.score_identity_verification_uncertain, 8)
        WHEN 'multiple_voices' THEN COALESCE(v_config.score_multiple_voices, 8)
        WHEN 'multiple_speakers' THEN COALESCE(v_config.score_multiple_speakers, 8)
        WHEN 'paste_in_code_editor' THEN COALESCE(v_config.score_paste_in_code_editor, 8)
        
        -- Medium severity
        WHEN 'headphones_detected' THEN COALESCE(v_config.score_headphones_detected, 5)
        WHEN 'earbuds_detected' THEN COALESCE(v_config.score_headphones_detected, 5)
        WHEN 'airpods_detected' THEN COALESCE(v_config.score_headphones_detected, 5)
        WHEN 'suspicious_background_objects' THEN COALESCE(v_config.score_suspicious_background_objects, 5)
        WHEN 'suspicious_background' THEN COALESCE(v_config.score_suspicious_background_objects, 5)
        WHEN 'prohibited_object' THEN COALESCE(v_config.score_suspicious_background_objects, 5)
        WHEN 'face_occluded' THEN COALESCE(v_config.score_face_occluded, 5)
        WHEN 'eye_gaze_off_screen' THEN COALESCE(v_config.score_eye_gaze_off_screen, 5)
        WHEN 'tab_switch' THEN COALESCE(v_config.score_tab_switch, 5)
        WHEN 'print_screen' THEN COALESCE(v_config.score_print_screen, 5)
        WHEN 'audio_playback' THEN COALESCE(v_config.score_audio_playback, 5)
        WHEN 'multiple_monitors' THEN COALESCE(v_config.score_multiple_monitors, 5)
        WHEN 'second_monitor_suspected' THEN COALESCE(v_config.score_multiple_monitors, 5)
        WHEN 'reading_pattern' THEN COALESCE(v_config.score_reading_pattern, 5)
        WHEN 'screen_share_stopped' THEN 5
        
        -- Low severity
        WHEN 'face_at_edge' THEN COALESCE(v_config.score_face_at_edge, 3)
        WHEN 'copy_attempt' THEN COALESCE(v_config.score_copy_attempt, 3)
        WHEN 'background_changed' THEN COALESCE(v_config.score_background_changed, 3)
        WHEN 'suspicious_typing' THEN COALESCE(v_config.score_suspicious_typing, 3)
        WHEN 'silence_anomaly' THEN 3
        
        -- Very Low severity
        WHEN 'poor_lighting' THEN COALESCE(v_config.score_poor_lighting, 2)
        WHEN 'clothing_changed' THEN COALESCE(v_config.score_clothing_changed, 2)
        WHEN 'look_away' THEN COALESCE(v_config.score_looking_away, 2)
        WHEN 'look_away_video' THEN COALESCE(v_config.score_looking_away, 2)
        WHEN 'looking_away' THEN COALESCE(v_config.score_looking_away, 2)
        WHEN 'eye_movement' THEN 2
        WHEN 'glasses_reflection' THEN 2
        WHEN 'sunglasses' THEN 2
        
        ELSE 5
      END;
    ELSE
      -- Use hardcoded defaults (same as before)
      v_deduction := CASE v_normalized_type
        WHEN 'different_person_detected' THEN 15
        WHEN 'different_person' THEN 15
        WHEN 'multiple_persons_video' THEN 15
        WHEN 'phone_detected' THEN 15
        WHEN 'phone_in_video' THEN 15
        WHEN 'suspicious_screen_content' THEN 15
        WHEN 'screen_content_finding' THEN 15
        WHEN 'nested_screen_sharing' THEN 15
        WHEN 'no_person_in_frame' THEN 10
        WHEN 'virtual_machine' THEN 10
        WHEN 'vm_detected' THEN 10
        WHEN 'external_conversation' THEN 10
        WHEN 'identity_verification_uncertain' THEN 8
        WHEN 'identity_uncertain' THEN 8
        WHEN 'multiple_voices' THEN 8
        WHEN 'multiple_speakers' THEN 8
        WHEN 'paste_in_code_editor' THEN 8
        WHEN 'headphones_detected' THEN 5
        WHEN 'earbuds_detected' THEN 5
        WHEN 'airpods_detected' THEN 5
        WHEN 'suspicious_background_objects' THEN 5
        WHEN 'suspicious_background' THEN 5
        WHEN 'prohibited_object' THEN 5
        WHEN 'face_occluded' THEN 5
        WHEN 'eye_gaze_off_screen' THEN 5
        WHEN 'tab_switch' THEN 5
        WHEN 'print_screen' THEN 5
        WHEN 'audio_playback' THEN 5
        WHEN 'multiple_monitors' THEN 5
        WHEN 'second_monitor_suspected' THEN 5
        WHEN 'reading_pattern' THEN 5
        WHEN 'screen_share_stopped' THEN 5
        WHEN 'face_at_edge' THEN 3
        WHEN 'copy_attempt' THEN 3
        WHEN 'background_changed' THEN 3
        WHEN 'suspicious_typing' THEN 3
        WHEN 'silence_anomaly' THEN 3
        WHEN 'poor_lighting' THEN 2
        WHEN 'clothing_changed' THEN 2
        WHEN 'look_away' THEN 2
        WHEN 'look_away_video' THEN 2
        WHEN 'looking_away' THEN 2
        WHEN 'eye_movement' THEN 2
        WHEN 'glasses_reflection' THEN 2
        WHEN 'sunglasses' THEN 2
        ELSE 5
      END;
    END IF;
    
    v_score := v_score - v_deduction;
  END LOOP;
  
  RETURN GREATEST(0, v_score);
END;
$function$;


-- ============================================================================
-- 3. flag_stuck_upload_attempts()
--    Source: 20260110140645_655cfe3c-8244-41ea-876d-033e2090588f.sql
--    Purpose: Detects interview attempts stuck in 'pending_upload' for >30 min,
--             marks them as 'upload_incomplete', flags proctoring sessions,
--             and logs to audit_logs.
-- ============================================================================
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

GRANT EXECUTE ON FUNCTION public.flag_stuck_upload_attempts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_stuck_upload_attempts() TO service_role;


-- ============================================================================
-- 4. get_cron_jobs() / update_cron_schedule() / set_cron_job_status()
--    Source: 20260126130023_01bda2e5-7e52-4614-a234-c5fd2ba715cb.sql
--    Purpose: Helper functions for managing pg_cron jobs from Edge Functions.
--
--    ⚠️  DEPENDENCY: Requires the pg_cron extension and the cron schema.
--        These will fail if pg_cron is not enabled on the target database.
-- ============================================================================

-- 4a. get_cron_jobs — lists all cron jobs
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT jobid, jobname, schedule, active, command
  FROM cron.job
  ORDER BY jobname;
$$;

-- 4b. update_cron_schedule — changes a job's cron schedule
CREATE OR REPLACE FUNCTION public.update_cron_schedule(
  p_jobname text,
  p_schedule text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  UPDATE cron.job
  SET schedule = p_schedule
  WHERE jobname = p_jobname;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_jobname;
  END IF;
END;
$$;

-- 4c. set_cron_job_status — enables or disables a job
CREATE OR REPLACE FUNCTION public.set_cron_job_status(
  p_jobname text,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  UPDATE cron.job
  SET active = p_active
  WHERE jobname = p_jobname;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_jobname;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_cron_schedule(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cron_job_status(text, boolean) TO authenticated;


-- ============================================================================
-- 5. Audit DELETE triggers: log_interview_delete / log_question_delete /
--    log_invitation_delete + triggers
--    Source: 20260206114640_66dc0541-a7d8-4879-afb8-c212168471aa.sql
--    Purpose: Logs row data to audit_logs before DELETE on interviews,
--             questions, and interview_invitations tables.
-- ============================================================================

-- 5a. log_interview_delete
CREATE OR REPLACE FUNCTION public.log_interview_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    metadata
  ) VALUES (
    'DELETE',
    'interviews',
    OLD.id::text,
    auth.uid(),
    jsonb_build_object(
      'old_data', row_to_json(OLD)::jsonb,
      'deleted_at', now()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5b. log_question_delete
CREATE OR REPLACE FUNCTION public.log_question_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    metadata
  ) VALUES (
    'DELETE',
    'questions',
    OLD.id::text,
    auth.uid(),
    jsonb_build_object(
      'old_data', row_to_json(OLD)::jsonb,
      'deleted_at', now()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5c. log_invitation_delete
CREATE OR REPLACE FUNCTION public.log_invitation_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    metadata
  ) VALUES (
    'DELETE',
    'interview_invitations',
    OLD.id::text,
    auth.uid(),
    jsonb_build_object(
      'old_data', row_to_json(OLD)::jsonb,
      'deleted_at', now()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers for audit DELETE logging
DROP TRIGGER IF EXISTS audit_interviews_delete ON public.interviews;
CREATE TRIGGER audit_interviews_delete
  BEFORE DELETE ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.log_interview_delete();

DROP TRIGGER IF EXISTS audit_questions_delete ON public.questions;
CREATE TRIGGER audit_questions_delete
  BEFORE DELETE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_question_delete();

DROP TRIGGER IF EXISTS audit_invitations_delete ON public.interview_invitations;
CREATE TRIGGER audit_invitations_delete
  BEFORE DELETE ON public.interview_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invitation_delete();


-- ============================================================================
-- 6. recalculate_all_cpi()
--    Source: 20260121135118_01005ea2-1173-4a90-aa76-0fa62d1b9072.sql
--    Purpose: Loops through all completed/evaluated attempts and recalculates
--             CPI (60% technical + 40% problem solving), integrity scores,
--             and hiring recommendations.
-- ============================================================================
DROP FUNCTION IF EXISTS public.recalculate_all_cpi();

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


-- ============================================================================
-- 7. recalculate_all_integrity_scores()
--    Source: 20260107181152_72451af4-70f4-4e34-a1d8-27c498952998.sql
--    Purpose: Recalculates integrity scores for all proctoring sessions using
--             severity-based deductions and updates hiring decisions.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_all_integrity_scores()
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
        
        IF v_old_decision != v_new_decision THEN
          v_decisions_changed := v_decisions_changed + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_updated, v_decisions_changed;
END;
$$;


-- ============================================================================
-- 8. recalculate_all_integrity_scores_v2()
--    Source: 20260107181315_2e612382-9af5-43ba-b574-9aabc69a777d.sql
--    Purpose: V2 of the integrity recalculation — identical logic to v1 but
--             created after additional severity data-fixes were applied.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_all_integrity_scores_v2()
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


-- ============================================================================
-- 9. recalculate_integrity_after_glasses_fix()
--    Source: 20260107181942_cde0ce68-cfc4-4c5c-82a6-9f3b6c3e0f0c.sql
--    Purpose: Recalculates integrity scores after glasses_reflection violations
--             were reclassified to low severity. Updates assessments and CPI.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_integrity_after_glasses_fix()
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


-- ============================================================================
-- 10. set_interview_deadline() / set_interview_deadline_on_insert() + triggers
--     Source: 20260112075601_7042a127-130c-4112-accb-151baa03a853.sql
--     Purpose: Auto-sets deadline_at on interview_attempts when an interview
--              starts (status → in_progress), based on the interview's
--              time_limit. Handles both UPDATE and INSERT paths.
-- ============================================================================

-- 10a. set_interview_deadline (for UPDATE)
CREATE OR REPLACE FUNCTION public.set_interview_deadline()
RETURNS TRIGGER AS $$
DECLARE
  interview_duration INTEGER;
BEGIN
  -- Only set deadline when status changes to in_progress and started_at is being set
  IF NEW.status = 'in_progress' AND NEW.started_at IS NOT NULL AND OLD.started_at IS NULL THEN
    -- Get the interview duration
    SELECT time_limit INTO interview_duration
    FROM public.interviews
    WHERE id = NEW.interview_id;
    
    -- Set deadline if duration exists (time_limit is in minutes)
    IF interview_duration IS NOT NULL AND interview_duration > 0 THEN
      NEW.deadline_at := NEW.started_at + (interview_duration || ' minutes')::INTERVAL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: set_interview_deadline_trigger (BEFORE UPDATE)
DROP TRIGGER IF EXISTS set_interview_deadline_trigger ON public.interview_attempts;
CREATE TRIGGER set_interview_deadline_trigger
BEFORE UPDATE ON public.interview_attempts
FOR EACH ROW
EXECUTE FUNCTION public.set_interview_deadline();

-- 10b. set_interview_deadline_on_insert (for INSERT)
CREATE OR REPLACE FUNCTION public.set_interview_deadline_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  interview_duration INTEGER;
BEGIN
  -- Set deadline if started_at is provided and status is in_progress
  IF NEW.status = 'in_progress' AND NEW.started_at IS NOT NULL THEN
    SELECT time_limit INTO interview_duration
    FROM public.interviews
    WHERE id = NEW.interview_id;
    
    IF interview_duration IS NOT NULL AND interview_duration > 0 THEN
      NEW.deadline_at := NEW.started_at + (interview_duration || ' minutes')::INTERVAL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: set_interview_deadline_on_insert_trigger (BEFORE INSERT)
DROP TRIGGER IF EXISTS set_interview_deadline_on_insert_trigger ON public.interview_attempts;
CREATE TRIGGER set_interview_deadline_on_insert_trigger
BEFORE INSERT ON public.interview_attempts
FOR EACH ROW
EXECUTE FUNCTION public.set_interview_deadline_on_insert();
