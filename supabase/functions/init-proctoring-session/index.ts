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

  const startTime = Date.now();
  
  try {
    const { attemptId, attemptType, sessionToken } = await req.json();

    console.log('[init-proctoring-session] Request:', { attemptId, attemptType, hasSessionToken: !!sessionToken });

    if (!attemptId || !attemptType) {
      return new Response(
        JSON.stringify({ error: 'Missing attemptId or attemptType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Determine the correct column based on attempt type
    const attemptColumn = 
      attemptType === 'interview' ? 'interview_attempt_id' :
      attemptType === 'learning' ? 'learning_attempt_id' :
      'certification_attempt_id';

    // For interview attempts, validate session token
    if (attemptType === 'interview') {
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: 'Session token required for interview proctoring' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate session token matches the attempt
      const { data: attempt, error: attemptError } = await supabase
        .from('interview_attempts')
        .select('id, session_token, status')
        .eq('id', attemptId)
        .single();

      if (attemptError || !attempt) {
        console.error('[init-proctoring-session] Attempt not found:', attemptError);
        return new Response(
          JSON.stringify({ error: 'Interview attempt not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (attempt.session_token !== sessionToken) {
        console.error('[init-proctoring-session] Invalid session token');
        return new Response(
          JSON.stringify({ error: 'Invalid session token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[init-proctoring-session] Session token validated for attempt:', attemptId);
    }

    // Use ON CONFLICT for idempotent session creation
    // This prevents race conditions where multiple requests create duplicate sessions
    console.log('[init-proctoring-session] Creating or returning existing session for attempt:', attemptId);
    
    // First try to find existing active session
    const { data: existingSession, error: selectError } = await supabase
      .from('proctoring_sessions')
      .select('id')
      .eq(attemptColumn, attemptId)
      .is('ended_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error('[init-proctoring-session] Error checking existing session:', selectError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingSession) {
      console.log('[init-proctoring-session] Found existing session:', existingSession.id);
      return new Response(
        JSON.stringify({ sessionId: existingSession.id, isNew: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new session with unique constraint protection
    // If a concurrent request already created a session, this will fail
    // and we'll return the existing one
    const { data: newSession, error: insertError } = await supabase
      .from('proctoring_sessions')
      .insert({
        [attemptColumn]: attemptId,
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      // Check if this is a unique constraint violation (duplicate active session)
      if (insertError.code === '23505') {
        console.log('[init-proctoring-session] Concurrent session created, fetching it...');
        // Race condition: another request created a session, fetch it
        const { data: concurrentSession } = await supabase
          .from('proctoring_sessions')
          .select('id')
          .eq(attemptColumn, attemptId)
          .is('ended_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (concurrentSession) {
          return new Response(
            JSON.stringify({ sessionId: concurrentSession.id, isNew: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      console.error('[init-proctoring-session] Error creating session:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create proctoring session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[init-proctoring-session] Created session:', newSession.id);
    
    // Log proctoring session start
    try {
      await supabase
        .from('interview_operation_logs')
        .insert({
          operation: 'proctoring_started',
          status: 'completed',
          attempt_id: attemptType === 'interview' ? attemptId : null,
          session_id: newSession.id,
          metadata: { attemptType, isNew: true },
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        });
    } catch (logErr) {
      console.error('[OperationLog] Failed to log proctoring start:', logErr);
    }
    
    return new Response(
      JSON.stringify({ sessionId: newSession.id, isNew: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[init-proctoring-session] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
