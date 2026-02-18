import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Get Chunk Upload URL
 * 
 * Generates a signed URL for uploading individual recording chunks.
 * Each chunk is stored as a separate .part file that will be merged later.
 * 
 * Path format: {sessionId}/{recordingType}/chunk_NNN.part
 * Example: abc123/video/chunk_000.part
 * 
 * This enables progressive uploads during the interview:
 * - Each 10-second chunk uploads immediately as its own file
 * - No overwriting - each chunk is a unique file
 * - On submission, merge-proctoring-chunks concatenates them
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { 
      sessionId, 
      recordingType, 
      chunkIndex,
      sessionToken, 
      attemptId,
      isTest, // Flag for pre-interview validation test
    } = await req.json();

    console.log('[get-chunk-upload-url] Request:', { 
      sessionId, 
      recordingType, 
      chunkIndex,
      hasSessionToken: !!sessionToken, 
      attemptId,
      isTest,
    });

    // Handle test validation requests (pre-interview upload connectivity test)
    if (isTest && sessionId === 'test-validation' && chunkIndex === -1) {
      console.log('[get-chunk-upload-url] Handling test validation request');
      
      // Generate a test file path that won't interfere with real recordings
      const testFilePath = `test-validation/${Date.now()}/test.bin`;
      
      // Create signed upload URL for test
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proctoring-recordings')
        .createSignedUploadUrl(testFilePath);

      if (uploadError || !uploadData) {
        console.error('[get-chunk-upload-url] Test upload URL error:', uploadError);
        return new Response(
          JSON.stringify({ error: 'Failed to create test upload URL', details: uploadError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          signedUrl: uploadData.signedUrl,
          token: uploadData.token,
          path: testFilePath,
          isTest: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields for real uploads
    if (!sessionId || !recordingType || chunkIndex === undefined) {
      return new Response(
        JSON.stringify({ error: 'sessionId, recordingType, and chunkIndex are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['video', 'screen'].includes(recordingType)) {
      return new Response(
        JSON.stringify({ error: 'recordingType must be "video" or "screen"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof chunkIndex !== 'number' || chunkIndex < 0 || chunkIndex > 999) {
      return new Response(
        JSON.stringify({ error: 'chunkIndex must be a number between 0 and 999' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AUTHENTICATION: Verify session token for candidates
    let isAuthorized = false;

    if (sessionToken && attemptId) {
      const { data: attempt, error: attemptError } = await supabase
        .from('interview_attempts')
        .select('id, session_token, status')
        .eq('id', attemptId)
        .eq('session_token', sessionToken)
        .maybeSingle();

      if (attempt && !attemptError) {
        // Verify the proctoring session belongs to this attempt
        const { data: proctoringSession } = await supabase
          .from('proctoring_sessions')
          .select('id, interview_attempt_id')
          .eq('id', sessionId)
          .eq('interview_attempt_id', attemptId)
          .maybeSingle();

        if (proctoringSession) {
          isAuthorized = true;
          console.log('[get-chunk-upload-url] Session token auth successful');
        }
      }
    }

    // Also try JWT auth for admin/HR
    if (!isAuthorized) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (user && !authError) {
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          const hasAdminAccess = userRoles?.some((r: any) => 
            ['platform_admin', 'partner_admin', 'hr_recruiter'].includes(r.role)
          );

          if (hasAdminAccess) {
            isAuthorized = true;
            console.log('[get-chunk-upload-url] JWT admin auth successful');
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

    // Generate chunk file path with zero-padded index for correct sorting
    const paddedIndex = chunkIndex.toString().padStart(3, '0');
    const filePath = `${sessionId}/${recordingType}/chunk_${paddedIndex}.part`;

    // Create signed upload URL (valid for 10 minutes)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('proctoring-recordings')
      .createSignedUploadUrl(filePath);

    if (signedUrlError) {
      console.error('[get-chunk-upload-url] Failed to create signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to create upload URL', details: signedUrlError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update upload tracking on first chunk
    if (chunkIndex === 0) {
      await supabase
        .from('proctoring_sessions')
        .update({ 
          upload_status: 'uploading',
          upload_error: null,
        })
        .eq('id', sessionId);

      // Set upload_started_at only if not already set
      await supabase
        .from('proctoring_sessions')
        .update({ upload_started_at: new Date().toISOString() })
        .eq('id', sessionId)
        .is('upload_started_at', null);
    }

    // Track chunk upload in diagnostics
    const { data: session } = await supabase
      .from('proctoring_sessions')
      .select('upload_diagnostics')
      .eq('id', sessionId)
      .single();
    
    const currentDiagnostics = (session?.upload_diagnostics as Record<string, any>) || {};
    const chunkCountField = `${recordingType}_chunks_requested`;
    
    await supabase
      .from('proctoring_sessions')
      .update({
        upload_diagnostics: {
          ...currentDiagnostics,
          [chunkCountField]: (currentDiagnostics[chunkCountField] || 0) + 1,
          [`${recordingType}_last_chunk_at`]: new Date().toISOString(),
          [`${recordingType}_last_chunk_index`]: chunkIndex,
          upload_mode: 'chunked',
        }
      })
      .eq('id', sessionId);

    console.log('[get-chunk-upload-url] Generated signed URL for:', filePath);

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: signedUrlData.signedUrl,
        token: signedUrlData.token,
        filePath,
        chunkIndex,
        expiresIn: 600, // 10 minutes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-chunk-upload-url] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
