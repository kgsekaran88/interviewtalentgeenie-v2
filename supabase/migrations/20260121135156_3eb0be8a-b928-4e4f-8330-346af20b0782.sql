
-- Create a function to recalculate integrity from the violations JSON array
CREATE OR REPLACE FUNCTION public.calculate_integrity_from_violations(
  p_violations JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score NUMERIC := 100;
  v_violation JSONB;
  v_type TEXT;
  v_deduction NUMERIC;
BEGIN
  -- If no violations, return 100
  IF p_violations IS NULL OR jsonb_array_length(p_violations) = 0 THEN
    RETURN 100;
  END IF;
  
  -- Loop through each violation and deduct points based on type
  FOR v_violation IN SELECT * FROM jsonb_array_elements(p_violations)
  LOOP
    -- Skip ignored violations
    IF (v_violation->>'ignored')::boolean = true THEN
      CONTINUE;
    END IF;
    
    v_type := LOWER(REPLACE(v_violation->>'type', '-', '_'));
    
    -- Determine deduction based on violation type (matches proctoring-config.ts)
    v_deduction := CASE v_type
      -- Very High severity (15 points)
      WHEN 'different_person_detected' THEN 15
      WHEN 'different_person' THEN 15
      WHEN 'multiple_persons_video' THEN 15
      WHEN 'phone_detected' THEN 15
      WHEN 'phone_in_video' THEN 15
      WHEN 'suspicious_screen_content' THEN 15
      WHEN 'screen_content_finding' THEN 15
      WHEN 'nested_screen_sharing' THEN 15
      
      -- High severity (10 points)
      WHEN 'no_person_in_frame' THEN 10
      WHEN 'virtual_machine' THEN 10
      WHEN 'vm_detected' THEN 10
      WHEN 'external_conversation' THEN 10
      
      -- Medium-High severity (8 points)
      WHEN 'identity_verification_uncertain' THEN 8
      WHEN 'identity_uncertain' THEN 8
      WHEN 'multiple_voices' THEN 8
      WHEN 'multiple_speakers' THEN 8
      WHEN 'paste_in_code_editor' THEN 8
      
      -- Medium severity (5 points)
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
      
      -- Low severity (3 points)
      WHEN 'face_at_edge' THEN 3
      WHEN 'copy_attempt' THEN 3
      WHEN 'background_changed' THEN 3
      WHEN 'suspicious_typing' THEN 3
      WHEN 'silence_anomaly' THEN 3
      
      -- Very Low severity (2 points)
      WHEN 'poor_lighting' THEN 2
      WHEN 'clothing_changed' THEN 2
      WHEN 'look_away' THEN 2
      WHEN 'look_away_video' THEN 2
      WHEN 'looking_away' THEN 2
      WHEN 'eye_movement' THEN 2
      WHEN 'glasses_reflection' THEN 2
      WHEN 'sunglasses' THEN 2
      
      -- Default for unknown types
      ELSE 5
    END;
    
    v_score := v_score - v_deduction;
  END LOOP;
  
  RETURN GREATEST(0, v_score);
END;
$$;
