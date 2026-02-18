import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Confirm Proctoring Upload
 * 
 * Called after a direct-to-storage upload completes.
 * Updates the proctoring_sessions table with the recording URL.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { sessionId, recordingType, filePath, sessionToken, attemptId, fileSize } = await req.json();

    console.log('[confirm-proctoring-upload] Request:', { sessionId, recordingType, filePath, fileSize });

    // Validate required fields
    if (!sessionId || !recordingType || !filePath) {
      return new Response(
        JSON.stringify({ error: 'sessionId, recordingType, and filePath are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AUTHENTICATION: Verify session token for candidates
    let isAuthorized = false;

    if (sessionToken && attemptId) {
      const { data: attempt } = await supabase
        .from('interview_attempts')
        .select('id, session_token')
        .eq('id', attemptId)
        .eq('session_token', sessionToken)
        .maybeSingle();

      if (attempt) {
        const { data: proctoringSession } = await supabase
          .from('proctoring_sessions')
          .select('id')
          .eq('id', sessionId)
          .eq('interview_attempt_id', attemptId)
          .maybeSingle();

        if (proctoringSession) {
          isAuthorized = true;
        }
      }
    }

    // Also try JWT auth
    if (!isAuthorized) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          if (userRoles?.some((r: any) => ['platform_admin', 'partner_admin', 'hr_recruiter'].includes(r.role))) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify file exists in storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('proctoring-recordings')
      .list(sessionId, { search: filePath.split('/').pop() });

    if (fileError || !fileData || fileData.length === 0) {
      console.error('[confirm-proctoring-upload] File not found in storage:', filePath);
      return new Response(
        JSON.stringify({ error: 'Upload file not found in storage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ATOMIC UPDATE: Use a single update with conditional logic
    // This prevents race conditions when video and screen uploads complete simultaneously
    const updateField = recordingType === 'video' ? 'video_recording_url' : 'screen_recording_url';
    const otherField = recordingType === 'video' ? 'screen_recording_url' : 'video_recording_url';

    // First, update our recording URL
    const { data: updatedSession, error: updateError } = await supabase
      .from('proctoring_sessions')
      .update({
        [updateField]: filePath,
      })
      .eq('id', sessionId)
      .select('video_recording_url, screen_recording_url')
      .single();

    if (updateError) {
      console.error('[confirm-proctoring-upload] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Now check if BOTH are present (using the freshly updated data)
    const bothUploaded = !!updatedSession?.video_recording_url && !!updatedSession?.screen_recording_url;

    // If both are uploaded, update status to completed
    // Use conditional update to handle race - only update if not already completed
    if (bothUploaded) {
      const { error: statusError } = await supabase
        .from('proctoring_sessions')
        .update({
          upload_status: 'completed',
          upload_completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .neq('upload_status', 'completed'); // Only update if not already completed

      if (statusError) {
        console.warn('[confirm-proctoring-upload] Status update warning (may be race):', statusError);
        // Non-fatal - the other request may have already set it
      }

      // CRITICAL: Update interview_attempts status when both uploads are complete
      if (attemptId) {
        const { error: attemptUpdateError } = await supabase
          .from('interview_attempts')
          .update({ status: 'submitted' })
          .eq('id', attemptId)
          .eq('status', 'pending_upload'); // Only update if still pending

        if (attemptUpdateError) {
          console.warn('[confirm-proctoring-upload] Attempt status update warning:', attemptUpdateError);
        } else {
          console.log('[confirm-proctoring-upload] Updated attempt status to submitted:', attemptId);
        }
      }
    }

    console.log('[confirm-proctoring-upload] Success:', { filePath, bothUploaded });

    return new Response(
      JSON.stringify({
        success: true,
        filePath,
        uploadStatus: bothUploaded ? 'completed' : 'uploading',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[confirm-proctoring-upload] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
