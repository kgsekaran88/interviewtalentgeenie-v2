// Shared helper to fetch proctoring settings with configurable violation scores
// Use 'any' for SupabaseClient to avoid version mismatch issues

export interface ProctoringConfig {
  // Feature toggles
  enable_face_detection: boolean;
  enable_eye_tracking: boolean;
  enable_voice_analysis: boolean;
  enable_tab_switching: boolean;
  enable_screen_recording: boolean;
  enable_object_detection: boolean;
  enable_screen_content_analysis: boolean;

  // Thresholds
  look_away_threshold_seconds: number;
  eye_movement_threshold_seconds: number;
  tab_switch_max_count: number;
  audio_anomaly_threshold: number;
  background_noise_threshold: number;

  // Per-violation scores (deduction points)
  score_different_person_detected: number;
  score_identity_verification_uncertain: number;
  score_phone_detected: number;
  score_headphones_detected: number;
  score_suspicious_background_objects: number;
  score_suspicious_screen_content: number;
  score_no_person_in_frame: number;
  score_face_at_edge: number;
  score_face_occluded: number;
  score_poor_lighting: number;
  score_looking_away: number;
  score_eye_gaze_off_screen: number;
  score_tab_switch: number;
  score_copy_attempt: number;
  score_print_screen: number;
  score_multiple_voices: number;
  score_audio_playback: number;
  score_external_conversation: number;
  score_multiple_monitors: number;
  score_virtual_machine: number;
  score_background_changed: number;
  score_clothing_changed: number;
  score_suspicious_typing: number;
  score_reading_pattern: number;
  score_multiple_speakers: number;
  score_nested_screen_sharing: number;
  score_paste_in_code_editor: number;

  // Per-violation enable/disable toggles
  enabled_different_person_detected: boolean;
  enabled_identity_verification_uncertain: boolean;
  enabled_phone_detected: boolean;
  enabled_headphones_detected: boolean;
  enabled_suspicious_background_objects: boolean;
  enabled_suspicious_screen_content: boolean;
  enabled_no_person_in_frame: boolean;
  enabled_face_at_edge: boolean;
  enabled_face_occluded: boolean;
  enabled_poor_lighting: boolean;
  enabled_looking_away: boolean;
  enabled_eye_gaze_off_screen: boolean;
  enabled_tab_switch: boolean;
  enabled_copy_attempt: boolean;
  enabled_print_screen: boolean;
  enabled_multiple_voices: boolean;
  enabled_audio_playback: boolean;
  enabled_external_conversation: boolean;
  enabled_multiple_monitors: boolean;
  enabled_virtual_machine: boolean;
  enabled_background_changed: boolean;
  enabled_clothing_changed: boolean;
  enabled_suspicious_typing: boolean;
  enabled_reading_pattern: boolean;
  enabled_multiple_speakers: boolean;
  enabled_nested_screen_sharing: boolean;
  enabled_paste_in_code_editor: boolean;

  // Minimum passing score
  min_passing_score: number;
}

// Default configuration (used as fallback)
export const DEFAULT_PROCTORING_CONFIG: ProctoringConfig = {
  // Feature toggles
  enable_face_detection: true,
  enable_eye_tracking: true,
  enable_voice_analysis: true,
  enable_tab_switching: true,
  enable_screen_recording: true,
  enable_object_detection: true,
  enable_screen_content_analysis: true,

  // Thresholds
  look_away_threshold_seconds: 5,
  eye_movement_threshold_seconds: 5,
  tab_switch_max_count: 3,
  audio_anomaly_threshold: 0.7,
  background_noise_threshold: 0.6,

  // Very High severity (15 points)
  score_different_person_detected: 15,
  score_phone_detected: 15,
  score_suspicious_screen_content: 15,

  // High severity (10 points)
  score_no_person_in_frame: 10,
  score_virtual_machine: 10,
  score_external_conversation: 10,

  // Medium-High severity (8 points)
  score_identity_verification_uncertain: 8,
  score_multiple_voices: 8,
  score_multiple_speakers: 8,

  // Medium severity (5 points)
  score_headphones_detected: 5,
  score_suspicious_background_objects: 5,
  score_face_occluded: 5,
  score_eye_gaze_off_screen: 5,
  score_tab_switch: 5,
  score_print_screen: 5,
  score_audio_playback: 5,
  score_multiple_monitors: 5,
  score_reading_pattern: 5,

  // Low severity (2 points) - normal behavior during interviews
  score_looking_away: 2, // Reduced - thinking time is normal
  score_nested_screen_sharing: 15, // HIGH - indicates external assistance
  score_paste_in_code_editor: 8, // MEDIUM-HIGH - potential cheating

  // Low severity (3 points)
  score_face_at_edge: 3,
  score_copy_attempt: 3,
  score_background_changed: 3,
  score_suspicious_typing: 3,

  // Very Low severity (2 points)
  score_poor_lighting: 2,
  score_clothing_changed: 2,

  // Enable all violations by default
  enabled_different_person_detected: true,
  enabled_identity_verification_uncertain: true,
  enabled_phone_detected: true,
  enabled_headphones_detected: true,
  enabled_suspicious_background_objects: true,
  enabled_suspicious_screen_content: true,
  enabled_no_person_in_frame: true,
  enabled_face_at_edge: true,
  enabled_face_occluded: true,
  enabled_poor_lighting: true,
  enabled_looking_away: true,
  enabled_eye_gaze_off_screen: true,
  enabled_tab_switch: true,
  enabled_copy_attempt: true,
  enabled_print_screen: true,
  enabled_multiple_voices: true,
  enabled_audio_playback: true,
  enabled_external_conversation: true,
  enabled_multiple_monitors: true,
  enabled_virtual_machine: true,
  enabled_background_changed: true,
  enabled_clothing_changed: true,
  enabled_suspicious_typing: true,
  enabled_reading_pattern: true,
  enabled_multiple_speakers: true,
  enabled_nested_screen_sharing: true,
  enabled_paste_in_code_editor: true,

  min_passing_score: 70,
};

/**
 * Fetch proctoring configuration from the database.
 * Falls back to default configuration if not found.
 */
export async function getProctoringConfig(
  supabase: any, // Use 'any' to avoid SupabaseClient version mismatch
  organizationId?: string | null
): Promise<ProctoringConfig> {
  try {
    // Try to get org-specific settings first, then fall back to global
    let query = supabase.from("proctoring_settings").select("*");

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    } else {
      query = query.is("organization_id", null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.warn("[proctoring-config] Error fetching config:", error);
      return DEFAULT_PROCTORING_CONFIG;
    }

    if (!data) {
      // If no org-specific config and we were looking for one, try global
      if (organizationId) {
        const { data: globalData } = await supabase
          .from("proctoring_settings")
          .select("*")
          .is("organization_id", null)
          .maybeSingle();

        if (globalData) {
          return mergeWithDefaults(globalData);
        }
      }
      return DEFAULT_PROCTORING_CONFIG;
    }

    return mergeWithDefaults(data);
  } catch (err) {
    console.error("[proctoring-config] Failed to fetch config:", err);
    return DEFAULT_PROCTORING_CONFIG;
  }
}

/**
 * Merge database settings with defaults (in case some columns are missing)
 */
function mergeWithDefaults(data: Record<string, unknown>): ProctoringConfig {
  return {
    ...DEFAULT_PROCTORING_CONFIG,
    ...Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== null && v !== undefined)
    ),
  } as ProctoringConfig;
}

/**
 * Get the deduction score for a specific violation type
 */
export function getViolationScore(
  config: ProctoringConfig,
  violationType: string
): number {
  const scoreKey = `score_${violationType}` as keyof ProctoringConfig;
  const score = config[scoreKey];
  
  if (typeof score === "number") {
    return score;
  }

  // Fallback mapping for common violation type variations
  const typeMapping: Record<string, keyof ProctoringConfig> = {
    different_person: "score_different_person_detected",
    identity_uncertain: "score_identity_verification_uncertain",
    phone: "score_phone_detected",
    phone_in_video: "score_phone_detected",
    headphones: "score_headphones_detected",
    headphones_detected: "score_headphones_detected",
    // Earbuds/AirPods - map to headphones score (wireless earbuds are suspicious)
    earbuds_detected: "score_headphones_detected",
    earbuds: "score_headphones_detected",
    airpods: "score_headphones_detected",
    airpods_detected: "score_headphones_detected",
    wireless_earbuds: "score_headphones_detected",
    bluetooth_earpiece: "score_headphones_detected",
    suspicious_background: "score_suspicious_background_objects",
    screen_content: "score_suspicious_screen_content",
    screen_content_finding: "score_suspicious_screen_content",
    no_person: "score_no_person_in_frame",
    face_edge: "score_face_at_edge",
    face_partially_visible: "score_face_at_edge",
    occluded: "score_face_occluded",
    lighting: "score_poor_lighting",
    look_away: "score_looking_away",
    looking_away: "score_looking_away",
    // Video-based look away detection from AI analysis
    look_away_video: "score_looking_away",
    looking_away_video: "score_looking_away",
    eye_gaze: "score_eye_gaze_off_screen",
    tab_switch: "score_tab_switch",
    copy: "score_copy_attempt",
    copy_attempt: "score_copy_attempt",
    print_screen: "score_print_screen",
    screenshot: "score_print_screen",
    multiple_voice: "score_multiple_voices",
    multiple_voices: "score_multiple_voices",
    audio_playback: "score_audio_playback",
    external_conversation: "score_external_conversation",
    multiple_monitor: "score_multiple_monitors",
    multiple_monitors: "score_multiple_monitors",
    virtual_machine: "score_virtual_machine",
    vm_detected: "score_virtual_machine",
    background_changed: "score_background_changed",
    clothing_changed: "score_clothing_changed",
    suspicious_typing: "score_suspicious_typing",
    typing_pattern: "score_suspicious_typing",
    reading_pattern: "score_reading_pattern",
    multiple_speaker: "score_multiple_speakers",
    multiple_speakers: "score_multiple_speakers",
    prohibited_object: "score_suspicious_background_objects",
    nested_screen_sharing: "score_nested_screen_sharing",
    nested_sharing: "score_nested_screen_sharing",
    paste_in_code_editor: "score_paste_in_code_editor",
    paste_detected: "score_paste_in_code_editor",
    code_paste: "score_paste_in_code_editor",
  };

  const mappedKey = typeMapping[violationType];
  if (mappedKey && typeof config[mappedKey] === "number") {
    return config[mappedKey] as number;
  }

  // Default fallback
  console.warn(`[proctoring-config] Unknown violation type: ${violationType}, using default score of 5`);
  return 5;
}

/**
 * Check if a violation type is enabled
 */
export function isViolationEnabled(
  config: ProctoringConfig,
  violationType: string
): boolean {
  const enabledKey = `enabled_${violationType}` as keyof ProctoringConfig;
  const enabled = config[enabledKey];
  
  if (typeof enabled === "boolean") {
    return enabled;
  }

  // Fallback mapping for common violation type variations
  const typeMapping: Record<string, keyof ProctoringConfig> = {
    different_person: "enabled_different_person_detected",
    phone: "enabled_phone_detected",
    phone_in_video: "enabled_phone_detected",
    headphones: "enabled_headphones_detected",
    // Earbuds/AirPods - map to headphones enabled
    earbuds_detected: "enabled_headphones_detected",
    earbuds: "enabled_headphones_detected",
    airpods: "enabled_headphones_detected",
    airpods_detected: "enabled_headphones_detected",
    wireless_earbuds: "enabled_headphones_detected",
    bluetooth_earpiece: "enabled_headphones_detected",
    suspicious_screen: "enabled_suspicious_screen_content",
    screen_content: "enabled_suspicious_screen_content",
    look_away: "enabled_looking_away",
    // Video-based look away detection from AI analysis
    look_away_video: "enabled_looking_away",
    looking_away_video: "enabled_looking_away",
    tab_switch: "enabled_tab_switch",
    copy: "enabled_copy_attempt",
    copy_attempt: "enabled_copy_attempt",
    multiple_voice: "enabled_multiple_voices",
    multiple_monitor: "enabled_multiple_monitors",
    prohibited_object: "enabled_suspicious_background_objects",
    nested_screen_sharing: "enabled_nested_screen_sharing",
    nested_sharing: "enabled_nested_screen_sharing",
    paste_in_code_editor: "enabled_paste_in_code_editor",
    paste_detected: "enabled_paste_in_code_editor",
    code_paste: "enabled_paste_in_code_editor",
  };

  const mappedKey = typeMapping[violationType];
  if (mappedKey && typeof config[mappedKey] === "boolean") {
    return config[mappedKey] as boolean;
  }

  // Default to enabled
  return true;
}

/**
 * Calculate integrity score from violations using configurable scores
 */
export function calculateIntegrityScore(
  config: ProctoringConfig,
  violations: Array<{ type: string; [key: string]: unknown }>
): number {
  let score = 100;

  for (const violation of violations) {
    const violationType = (violation.type || "").toLowerCase().replace(/-/g, "_");
    
    // Check if this violation type is enabled
    if (!isViolationEnabled(config, violationType)) {
      continue;
    }

    const deduction = getViolationScore(config, violationType);
    score -= deduction;
  }

  return Math.max(0, Math.min(100, score));
}
