import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

// Maximum file sizes (in bytes) - increased for longer interviews
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_SCREEN_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

// Allowed MIME types
const ALLOWED_VIDEO_TYPES = ['video/webm', 'video/mp4', 'video/x-matroska', 'application/octet-stream'];

// Helper to log operations to database
async function logOperation(
  supabase: any,
  operation: string,
  status: 'started' | 'completed' | 'failed',
  params: {
    sessionId?: string;
    attemptId?: string;
    metadata?: Record<string, any>;
    errorCode?: string;
    errorMessage?: string;
    logId?: string;
  }
) {
  try {
    if (params.logId && status !== 'started') {
      const completedAt = new Date().toISOString();
      const { data: logData } = await supabase
        .from('interview_operation_logs')
        .select('started_at')
        .eq('id', params.logId)
        .single();
      
      const durationMs = logData?.started_at 
        ? new Date(completedAt).getTime() - new Date(logData.started_at).getTime()
        : null;

      await supabase
        .from('interview_operation_logs')
        .update({
          status,
          completed_at: completedAt,
          duration_ms: durationMs,
          error_code: params.errorCode || null,
          error_message: params.errorMessage || null,
          metadata: params.metadata || undefined,
        })
        .eq('id', params.logId);
    } else {
      const { data } = await supabase
        .from('interview_operation_logs')
        .insert({
          operation,
          status,
          session_id: params.sessionId || null,
          attempt_id: params.attemptId || null,
          metadata: params.metadata || {},
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      return data?.id;
    }
  } catch (err) {
    console.error('[OperationLog] Failed to log:', err);
  }
  return null;
}

serve(async (req) => {
  const logger = createLogger('upload-proctoring-recording');
  logger.info('Upload request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let operationLogId: string | null = null;
  let sessionId: string | undefined;
  let recordingType: string | undefined;

  try {
    logger.info('Parsing form data...');
    const formData = await req.formData();
    sessionId = formData.get('sessionId') as string;
    recordingType = formData.get('recordingType') as string; // 'video' or 'screen'
    const file = formData.get('file') as File;
    const sessionToken = formData.get('sessionToken') as string | null;
    const attemptId = formData.get('attemptId') as string | null;
    
    // Start operation logging
    const operationType = recordingType === 'video' ? 'video_upload' : 'screen_upload';
    operationLogId = await logOperation(supabase, operationType, 'started', {
      sessionId,
      attemptId: attemptId || undefined,
      metadata: { fileSize: file?.size || 0, fileType: file?.type || 'unknown' }
    });

    logger.info('Upload request parsed', { 
      sessionId, 
      recordingType, 
      hasFile: !!file, 
      fileSize: file?.size || 0,
      fileType: file?.type || 'unknown',
      hasSessionToken: !!sessionToken, 
      attemptId,
      operationLogId
    });

    if (!sessionId || !recordingType || !file) {
      return new Response(
        JSON.stringify({ error: 'sessionId, recordingType, and file are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate recording type
    if (!['video', 'screen'].includes(recordingType)) {
      return new Response(
        JSON.stringify({ error: 'recordingType must be "video" or "screen"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type (allow application/octet-stream for blobs from IndexedDB)
    if (!ALLOWED_VIDEO_TYPES.includes(file.type) && file.type !== '') {
      console.log('File type validation - received:', file.type);
      return new Response(
        JSON.stringify({ error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size
    const maxSize = recordingType === 'video' ? MAX_VIDEO_SIZE : MAX_SCREEN_SIZE;
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: `File size exceeds maximum of ${maxSize / (1024 * 1024 * 1024)}GB` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DUAL AUTHENTICATION: Support both JWT (admin/HR) and session token (candidates)
    let isAuthorized = false;
    let authMethod = 'none';

    // Method 1: Try session token authentication (for candidates)
    if (sessionToken && attemptId) {
      console.log('Attempting session token authentication for candidate');
      
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
          authMethod = 'session_token';
          console.log('Session token authentication successful for candidate');
        } else {
          console.log('Proctoring session does not belong to this attempt');
        }
      } else {
        console.log('Session token validation failed:', attemptError?.message);
      }
    }

    // Method 2: Try JWT authentication (for admin/HR reviewing recordings)
    if (!isAuthorized) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (user && !authError) {
          // Check if user is interview creator or has admin role
          const { data: session } = await supabase
            .from('proctoring_sessions')
            .select(`
              id,
              interview_attempts!inner(
                id,
                interview_id,
                interviews!inner(creator_id)
              )
            `)
            .eq('id', sessionId)
            .maybeSingle();

          if (session) {
            const interview = (session as any).interview_attempts?.interviews;
            if (interview?.creator_id === user.id) {
              isAuthorized = true;
              authMethod = 'jwt_creator';
            } else {
              // Check admin roles
              const { data: userRoles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id);

              const hasAdminAccess = userRoles?.some((r: any) => 
                ['platform_admin', 'partner_admin', 'hr_recruiter'].includes(r.role)
              );
              
              if (hasAdminAccess) {
                isAuthorized = true;
                authMethod = 'jwt_admin';
              }
            }
          }
          console.log('JWT authentication result:', { isAuthorized, authMethod });
        }
      }
    }

    if (!isAuthorized) {
      console.error('Authorization failed for recording upload');
      return new Response(
        JSON.stringify({ error: 'Authentication required. Provide valid session token or JWT.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading ${recordingType} recording for session ${sessionId} (auth: ${authMethod}), size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);

    // Mark upload as started - only set upload_started_at if not already set (prevents race condition)
    await supabase
      .from('proctoring_sessions')
      .update({ 
        upload_status: 'uploading',
        upload_error: null  // Clear any previous error
      })
      .eq('id', sessionId);

    // Set upload_started_at only if not already set (first upload wins)
    await supabase
      .from('proctoring_sessions')
      .update({ upload_started_at: new Date().toISOString() })
      .eq('id', sessionId)
      .is('upload_started_at', null);

    // Upload file to storage
    const fileExtension = file.name?.split('.').pop() || 'webm';
    const filePath = `${sessionId}/${recordingType}-${Date.now()}.${fileExtension}`;
    
    const { error: uploadError } = await supabase.storage
      .from('proctoring-recordings')
      .upload(filePath, file, {
        contentType: file.type || 'video/webm',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      
      // Record the upload failure
      await supabase
        .from('proctoring_sessions')
        .update({ 
          upload_status: 'failed',
          upload_error: `Storage upload failed: ${uploadError.message}`
        })
        .eq('id', sessionId);
      
      return new Response(
        JSON.stringify({ error: 'Failed to upload recording', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`File uploaded successfully: ${filePath}`);

    // Update proctoring session with recording URL and mark upload complete
    const updateField = recordingType === 'video' ? 'video_recording_url' : 'screen_recording_url';
    
    // Check if both recordings are now uploaded
    const { data: currentSession } = await supabase
      .from('proctoring_sessions')
      .select('video_recording_url, screen_recording_url')
      .eq('id', sessionId)
      .single();
    
    const otherField = recordingType === 'video' ? 'screen_recording_url' : 'video_recording_url';
    const otherExists = currentSession && currentSession[otherField];
    const bothUploaded = otherExists || false; // Will be true after this upload if other already exists
    
    // First, update the recording URL
    const { error: updateError } = await supabase
      .from('proctoring_sessions')
      .update({ 
        [updateField]: filePath,
      })
      .eq('id', sessionId);

    if (!updateError) {
      // Then update status - but don't regress from 'completed' to 'uploading'
      if (bothUploaded) {
        await supabase
          .from('proctoring_sessions')
          .update({ 
            upload_status: 'completed',
            upload_completed_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .neq('upload_status', 'completed'); // Don't overwrite if already completed
      } else {
        // Only set to uploading if not already completed
        await supabase
          .from('proctoring_sessions')
          .update({ upload_status: 'uploading' })
          .eq('id', sessionId)
          .neq('upload_status', 'completed');
      }
    }

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update session with recording URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info(`Session updated with ${updateField}: ${filePath}`);
    
    // Log successful completion
    await logOperation(supabase, recordingType === 'video' ? 'video_upload' : 'screen_upload', 'completed', {
      logId: operationLogId || undefined,
      sessionId,
      metadata: { filePath, fileSize: file.size, uploadStatus: bothUploaded ? 'completed' : 'uploading' }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        filePath,
        message: `${recordingType} recording uploaded successfully`,
        uploadStatus: bothUploaded ? 'completed' : 'uploading'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Error in upload-proctoring-recording:', error);
    
    // Log failure
    if (operationLogId) {
      await logOperation(supabase, recordingType === 'video' ? 'video_upload' : 'screen_upload', 'failed', {
        logId: operationLogId,
        sessionId,
        errorCode: 'UPLOAD_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
