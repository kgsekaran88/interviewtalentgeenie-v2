
-- Update calculate_integrity_from_violations to support org-specific proctoring configs
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
      -- Check enabled flags based on violation type
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

-- Update toggle_violation_ignored to fetch and pass organization_id
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
  v_organization_id UUID;
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
  
  -- Fetch organization_id from the interview chain
  SELECT i.organization_id
  INTO v_organization_id
  FROM interview_attempts ia
  JOIN interviews i ON i.id = ia.interview_id
  WHERE ia.id = v_attempt_id;
  
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
  
  -- Recalculate integrity score using org-aware function
  v_new_integrity_score := calculate_integrity_from_violations(
    COALESCE(v_violations, '[]'::jsonb),
    v_current_ignored,
    v_organization_id
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
