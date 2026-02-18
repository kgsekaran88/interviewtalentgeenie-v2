import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, attemptId, sessionToken, attemptType, updates } = await req.json();

    console.log('[update-proctoring-session] Request:', { 
      sessionId, 
      attemptId, 
      attemptType,
      hasSessionToken: !!sessionToken,
      updateKeys: updates ? Object.keys(updates) : []
    });

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No updates provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // For interview attempts, validate session token
    if (attemptType === 'interview' && attemptId) {
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: 'Session token required for interview proctoring updates' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate session token matches the attempt
      const { data: attempt, error: attemptError } = await supabase
        .from('interview_attempts')
        .select('id, session_token')
        .eq('id', attemptId)
        .single();

      if (attemptError || !attempt) {
        console.error('[update-proctoring-session] Attempt not found:', attemptError);
        return new Response(
          JSON.stringify({ error: 'Interview attempt not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (attempt.session_token !== sessionToken) {
        console.error('[update-proctoring-session] Invalid session token');
        return new Response(
          JSON.stringify({ error: 'Invalid session token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the session belongs to this attempt
      const { data: session, error: sessionError } = await supabase
        .from('proctoring_sessions')
        .select('id, interview_attempt_id')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        console.error('[update-proctoring-session] Session not found:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Proctoring session not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (session.interview_attempt_id !== attemptId) {
        console.error('[update-proctoring-session] Session does not belong to this attempt');
        return new Response(
          JSON.stringify({ error: 'Session does not belong to this attempt' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[update-proctoring-session] Session token validated');
    }

    // Sanitize updates - only allow specific fields to be updated
    const allowedFields = [
      'camera_check_passed',
      'microphone_check_passed',
      'screen_share_check_passed',
      'lighting_check_passed',
      'ended_at',
      'integrity_score',
      'multiple_person_detections',
      'multiple_voice_detections',
      'tab_switch_count',
      'look_away_count',
      'copy_attempt_count',
      'detailed_violations',
      'flagged_for_review',
      'reviewer_notes',
      'review_status',
      'video_recording_url',
      'screen_recording_url',
      'upload_status',
      'periodic_screenshots',
      'audio_transcription',
      'screen_content_analysis',
      'eye_gaze_analysis',
    ];

    const sanitizedUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = value;
      } else {
        console.warn('[update-proctoring-session] Ignoring disallowed field:', key);
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid updates provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AUTO-APPROVE LOGIC: If session is ending with integrity score > 80, auto-approve
    const AUTO_APPROVE_THRESHOLD = 80;
    if (sanitizedUpdates.ended_at && sanitizedUpdates.integrity_score !== undefined) {
      const integrityScore = sanitizedUpdates.integrity_score;
      if (integrityScore >= AUTO_APPROVE_THRESHOLD) {
        sanitizedUpdates.review_status = 'approved';
        sanitizedUpdates.reviewer_notes = `Auto-approved: Integrity score ${integrityScore}% meets threshold (>${AUTO_APPROVE_THRESHOLD}%).`;
        console.log('[update-proctoring-session] Auto-approving session with score:', integrityScore);
      } else if (integrityScore < 50) {
        // Flag low scores for mandatory review
        sanitizedUpdates.flagged_for_review = true;
        sanitizedUpdates.review_status = 'pending';
        console.log('[update-proctoring-session] Flagging session for review with score:', integrityScore);
      }
    }

    // Perform the update
    const { error: updateError } = await supabase
      .from('proctoring_sessions')
      .update(sanitizedUpdates)
      .eq('id', sessionId);

    if (updateError) {
      console.error('[update-proctoring-session] Update failed:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update proctoring session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log proctoring_ended operation if ended_at was set
    if (sanitizedUpdates.ended_at) {
      try {
        await supabase.from('interview_operation_logs').insert({
          operation: 'proctoring_ended',
          status: 'completed',
          session_id: sessionId,
          attempt_id: attemptId || null,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          metadata: { 
            updateFields: Object.keys(sanitizedUpdates),
            integrityScore: sanitizedUpdates.integrity_score || null
          }
        });
      } catch (logErr) {
        console.warn('[update-proctoring-session] Failed to log proctoring_ended:', logErr);
      }
    }

    console.log('[update-proctoring-session] Updated session:', sessionId, 'fields:', Object.keys(sanitizedUpdates));
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[update-proctoring-session] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
