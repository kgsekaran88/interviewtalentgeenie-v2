import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


interface ProctoringViolation {
  id?: string;
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
  videoTimestamp?: number;
  screenshotUrl?: string;
  metadata?: any;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, attemptId, sessionToken, attemptType, violation, counterUpdates } = await req.json();

    console.log('[log-proctoring-violation] Request:', { 
      sessionId, 
      attemptId,
      attemptType,
      hasSessionToken: !!sessionToken,
      violationType: violation?.type,
      counterUpdates: counterUpdates ? Object.keys(counterUpdates) : []
    });

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId' }),
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
          JSON.stringify({ error: 'Session token required for interview proctoring' }),
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
        console.error('[log-proctoring-violation] Attempt not found:', attemptError);
        return new Response(
          JSON.stringify({ error: 'Interview attempt not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (attempt.session_token !== sessionToken) {
        console.error('[log-proctoring-violation] Invalid session token');
        return new Response(
          JSON.stringify({ error: 'Invalid session token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the session belongs to this attempt
      const { data: session, error: sessionError } = await supabase
        .from('proctoring_sessions')
        .select('id, interview_attempt_id, detailed_violations')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        console.error('[log-proctoring-violation] Session not found:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Proctoring session not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (session.interview_attempt_id !== attemptId) {
        console.error('[log-proctoring-violation] Session does not belong to this attempt');
        return new Response(
          JSON.stringify({ error: 'Session does not belong to this attempt' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[log-proctoring-violation] Session token validated');
    }

    // Fetch current session data
    const { data: currentSession, error: fetchError } = await supabase
      .from('proctoring_sessions')
      .select('detailed_violations, multiple_person_detections, multiple_voice_detections, tab_switch_count, look_away_count, copy_attempt_count')
      .eq('id', sessionId)
      .single();

    if (fetchError) {
      console.error('[log-proctoring-violation] Failed to fetch session:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch session data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare updates
    const updates: Record<string, any> = {};

    // Add violation to detailed_violations array
    if (violation) {
      const existingViolations = currentSession.detailed_violations || [];
      const violationWithId: ProctoringViolation = {
        ...violation,
        id: violation.id || `${violation.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      updates.detailed_violations = [...existingViolations, violationWithId];
    }

    // Apply counter updates
    if (counterUpdates) {
      const allowedCounters = [
        'multiple_person_detections',
        'multiple_voice_detections', 
        'tab_switch_count',
        'look_away_count',
        'copy_attempt_count'
      ];

      for (const [key, increment] of Object.entries(counterUpdates)) {
        if (allowedCounters.includes(key) && typeof increment === 'number') {
          const currentValue = currentSession[key as keyof typeof currentSession] || 0;
          updates[key] = (currentValue as number) + increment;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No updates to apply' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform the update
    const { error: updateError } = await supabase
      .from('proctoring_sessions')
      .update(updates)
      .eq('id', sessionId);

    if (updateError) {
      console.error('[log-proctoring-violation] Update failed:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to log violation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[log-proctoring-violation] Logged violation:', violation?.type, 'for session:', sessionId);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[log-proctoring-violation] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
