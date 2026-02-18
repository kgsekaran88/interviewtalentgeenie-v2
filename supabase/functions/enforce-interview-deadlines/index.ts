import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Enforce Interview Deadlines
 * 
 * This function runs on a schedule (every 2 minutes) to:
 * 1. Find all interview attempts that are past their deadline
 * 2. Auto-submit them with status 'auto_submitted'
 * 3. End any associated proctoring sessions
 * 4. Trigger evaluation
 * 
 * This provides server-side enforcement of time limits, catching cases where
 * the client-side timer failed (browser closed, network issues, etc.)
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[enforce-interview-deadlines] Starting deadline enforcement check...');

  try {
    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find all overdue attempts
    // Criteria: status = 'in_progress' AND deadline_at < NOW()
    const { data: overdueAttempts, error: fetchError } = await supabase
      .from('interview_attempts')
      .select(`
        id,
        interview_id,
        candidate_name,
        candidate_email,
        answers,
        session_token,
        started_at,
        deadline_at,
        interviews:interview_id (
          id,
          title,
          proctoring_enabled
        )
      `)
      .eq('status', 'in_progress')
      .not('deadline_at', 'is', null)
      .lt('deadline_at', new Date().toISOString());

    if (fetchError) {
      console.error('[enforce-interview-deadlines] Error fetching overdue attempts:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch overdue attempts', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!overdueAttempts || overdueAttempts.length === 0) {
      console.log('[enforce-interview-deadlines] No overdue attempts found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No overdue attempts',
          processed: 0,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[enforce-interview-deadlines] Found ${overdueAttempts.length} overdue attempt(s)`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      details: [] as any[]
    };

    // Process each overdue attempt
    for (const attempt of overdueAttempts) {
      const attemptStartTime = Date.now();
      console.log(`[enforce-interview-deadlines] Processing attempt ${attempt.id} for ${attempt.candidate_email}`);

      try {
        // Calculate time taken
        const startedAt = attempt.started_at ? new Date(attempt.started_at) : new Date(attempt.deadline_at);
        const timeTaken = Math.floor((Date.now() - startedAt.getTime()) / 1000);

        // 1. Update the attempt status to auto_submitted
        const { error: updateError } = await supabase
          .from('interview_attempts')
          .update({
            status: 'auto_submitted',
            submitted_at: new Date().toISOString(),
            time_taken: timeTaken
          })
          .eq('id', attempt.id)
          .eq('status', 'in_progress'); // Only update if still in_progress (prevent race conditions)

        if (updateError) {
          throw new Error(`Failed to update attempt: ${updateError.message}`);
        }

        // 2. End any associated proctoring session
        // Note: interviews is returned as an object (single relation via interview_id)
        const interviewData = attempt.interviews as unknown as { id: string; title: string; proctoring_enabled: boolean } | null;
        
        if (interviewData?.proctoring_enabled) {
          const { data: proctoringSession } = await supabase
            .from('proctoring_sessions')
            .select('id, ended_at')
            .eq('interview_attempt_id', attempt.id)
            .is('ended_at', null)
            .maybeSingle();

          if (proctoringSession) {
            console.log(`[enforce-interview-deadlines] Ending proctoring session ${proctoringSession.id}`);
            
            await supabase
              .from('proctoring_sessions')
              .update({
                ended_at: new Date().toISOString(),
                reviewer_notes: 'Session auto-ended due to deadline enforcement',
                updated_at: new Date().toISOString()
              })
              .eq('id', proctoringSession.id);
          }
        }

        // 3. Trigger evaluation (fire and forget)
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
          
          fetch(`${supabaseUrl}/functions/v1/auto-evaluate-trigger`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ attemptId: attempt.id }),
          }).catch(err => {
            console.warn(`[enforce-interview-deadlines] Evaluation trigger failed (non-critical): ${err.message}`);
          });
        } catch (evalErr) {
          console.warn(`[enforce-interview-deadlines] Evaluation trigger error (non-critical):`, evalErr);
        }

        // 4. Log the operation
        await supabase.from('interview_operation_logs').insert({
          operation: 'deadline_enforcement',
          status: 'completed',
          attempt_id: attempt.id,
          started_at: new Date(attemptStartTime).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - attemptStartTime,
          metadata: {
            candidate_email: attempt.candidate_email,
            interview_title: interviewData?.title,
            deadline_at: attempt.deadline_at,
            time_taken: timeTaken
          }
        });

        results.succeeded++;
        results.details.push({
          attempt_id: attempt.id,
          candidate_email: attempt.candidate_email,
          status: 'auto_submitted',
          duration_ms: Date.now() - attemptStartTime
        });

        console.log(`[enforce-interview-deadlines] Successfully auto-submitted attempt ${attempt.id}`);

      } catch (attemptError: any) {
        console.error(`[enforce-interview-deadlines] Failed to process attempt ${attempt.id}:`, attemptError);
        results.failed++;
        results.details.push({
          attempt_id: attempt.id,
          candidate_email: attempt.candidate_email,
          status: 'failed',
          error: attemptError.message
        });

        // Log the failure
        try {
          await supabase.from('interview_operation_logs').insert({
            operation: 'deadline_enforcement',
            status: 'failed',
            attempt_id: attempt.id,
            started_at: new Date(attemptStartTime).toISOString(),
            completed_at: new Date().toISOString(),
            error_message: attemptError.message,
            metadata: {
              candidate_email: attempt.candidate_email
            }
          });
        } catch {
          // Ignore logging errors
        }
      }

      results.processed++;
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[enforce-interview-deadlines] Completed. Processed: ${results.processed}, Succeeded: ${results.succeeded}, Failed: ${results.failed}, Duration: ${totalDuration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        duration_ms: totalDuration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[enforce-interview-deadlines] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
