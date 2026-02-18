import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Get Proctoring Upload URL
 * 
 * Generates a signed URL for direct-to-storage uploads.
 * This bypasses the edge function memory limits by allowing
 * clients to upload directly to Supabase Storage.
 * 
 * PROGRESSIVE UPLOAD SUPPORT:
 * When progressiveUpload=true, uses a consistent file path so that
 * each upload overwrites the previous one. This allows incremental
 * uploads during the interview while maintaining a single final file.
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
      sessionToken, 
      attemptId,
      progressiveUpload = false,
      chunkIndex = 0,
    } = await req.json();

    console.log('[get-proctoring-upload-url] Request:', { 
      sessionId, 
      recordingType, 
      hasSessionToken: !!sessionToken, 
      attemptId,
      progressiveUpload,
      chunkIndex,
    });

    // Validate required fields
    if (!sessionId || !recordingType) {
      return new Response(
        JSON.stringify({ error: 'sessionId and recordingType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['video', 'screen'].includes(recordingType)) {
      return new Response(
        JSON.stringify({ error: 'recordingType must be "video" or "screen"' }),
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
          console.log('[get-proctoring-upload-url] Session token auth successful');
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
            console.log('[get-proctoring-upload-url] JWT admin auth successful');
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

    // Generate file path
    // For progressive uploads, use a consistent path so files get overwritten
    // For standard uploads, include timestamp for uniqueness
    let filePath: string;
    if (progressiveUpload) {
      // Progressive: Use consistent path - each upload overwrites previous
      // This ensures we always have the latest cumulative data
      filePath = `${sessionId}/${recordingType}-progressive.webm`;
    } else {
      // Standard: Include timestamp for unique final file
      const timestamp = Date.now();
      filePath = `${sessionId}/${recordingType}-${timestamp}.webm`;
    }

    // Create signed upload URL (valid for 1 hour)
    // Use upsert mode to allow overwriting for progressive uploads
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('proctoring-recordings')
      .createSignedUploadUrl(filePath, {
        upsert: progressiveUpload, // Allow overwrite for progressive
      });

    if (signedUrlError) {
      console.error('[get-proctoring-upload-url] Failed to create signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to create upload URL', details: signedUrlError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark upload as starting - only for non-progressive or first progressive chunk
    if (!progressiveUpload || chunkIndex === 0) {
      await supabase
        .from('proctoring_sessions')
        .update({ 
          upload_status: 'uploading',
          upload_error: null
        })
        .eq('id', sessionId);

      // Set upload_started_at only if not already set (first upload wins)
      await supabase
        .from('proctoring_sessions')
        .update({ upload_started_at: new Date().toISOString() })
        .eq('id', sessionId)
        .is('upload_started_at', null);
    }

    // For progressive uploads, track progress metadata
    if (progressiveUpload) {
      const progressField = recordingType === 'video' 
        ? 'video_progressive_chunks' 
        : 'screen_progressive_chunks';
      
      // Update progressive upload tracking in upload_diagnostics
      const { data: session } = await supabase
        .from('proctoring_sessions')
        .select('upload_diagnostics')
        .eq('id', sessionId)
        .single();
      
      const currentDiagnostics = (session?.upload_diagnostics as Record<string, any>) || {};
      await supabase
        .from('proctoring_sessions')
        .update({
          upload_diagnostics: {
            ...currentDiagnostics,
            [progressField]: (currentDiagnostics[progressField] || 0) + 1,
            [`${recordingType}_last_progressive_at`]: new Date().toISOString(),
          }
        })
        .eq('id', sessionId);
    }

    console.log('[get-proctoring-upload-url] Generated signed URL for:', filePath, { progressiveUpload });

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: signedUrlData.signedUrl,
        token: signedUrlData.token,
        filePath,
        expiresIn: 3600, // 1 hour
        progressiveUpload,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-proctoring-upload-url] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
