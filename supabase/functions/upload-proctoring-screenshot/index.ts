import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Maximum screenshot size (in bytes)
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

serve(async (req) => {
  console.log('=== UPLOAD-PROCTORING-SCREENSHOT CALLED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const sessionId = formData.get('sessionId') as string;
    const screenshotType = formData.get('screenshotType') as string; // 'violation' or 'periodic'
    const file = formData.get('file') as File;
    const sessionToken = formData.get('sessionToken') as string | null;
    const attemptId = formData.get('attemptId') as string | null;
    const timestamp = formData.get('timestamp') as string | null;

    console.log('Screenshot upload request:', { 
      sessionId, 
      screenshotType,
      hasFile: !!file, 
      fileSize: file?.size || 0,
      hasSessionToken: !!sessionToken, 
      attemptId 
    });

    if (!sessionId || !screenshotType || !file) {
      return new Response(
        JSON.stringify({ error: 'sessionId, screenshotType, and file are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate screenshot type
    if (!['violation', 'periodic', 'screen_periodic', 'screen_violation'].includes(screenshotType)) {
      return new Response(
        JSON.stringify({ error: 'screenshotType must be "violation", "periodic", "screen_periodic", or "screen_violation"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) && file.type !== '') {
      return new Response(
        JSON.stringify({ error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size
    if (file.size > MAX_SCREENSHOT_SIZE) {
      return new Response(
        JSON.stringify({ error: `File size exceeds maximum of ${MAX_SCREENSHOT_SIZE / (1024 * 1024)}MB` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DUAL AUTHENTICATION: Support both JWT (admin/HR) and session token (candidates)
    let isAuthorized = false;
    let authMethod = 'none';

    // Method 1: Try session token authentication (for candidates)
    if (sessionToken && attemptId) {
      console.log('Attempting session token authentication for candidate screenshot');
      
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
          console.log('Session token authentication successful for screenshot');
        }
      }
    }

    // Method 2: Try JWT authentication (for admin/HR)
    if (!isAuthorized) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (user && !authError) {
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
        }
      }
    }

    if (!isAuthorized) {
      console.error('Authorization failed for screenshot upload');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate file path based on screenshot type
    const ts = timestamp || Date.now().toString();
    let fileName: string;
    if (screenshotType === 'violation') {
      fileName = `${sessionId}/violation-${ts}.jpg`;
    } else if (screenshotType === 'screen_violation') {
      fileName = `${sessionId}/screen-violation-${ts}.jpg`;
    } else if (screenshotType === 'screen_periodic') {
      // Use provided screenshotPath or generate default
      const providedPath = formData.get('screenshotPath') as string | null;
      fileName = providedPath || `${sessionId}/screen-periodic-${ts}.jpg`;
    } else {
      // Use provided screenshotPath or generate default
      const providedPath = formData.get('screenshotPath') as string | null;
      fileName = providedPath || `${sessionId}/periodic-${ts}.jpg`;
    }
    
    console.log(`Uploading screenshot: ${fileName} (auth: ${authMethod})`);

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('proctoring-recordings')
      .upload(fileName, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Screenshot upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload screenshot', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Screenshot uploaded successfully: ${fileName}`);

    // For periodic screenshots (camera), store the path with timestamp metadata
    if (screenshotType === 'periodic') {
      const capturedAt = formData.get('capturedAt') as string | null;
      const capturedAtSeconds = capturedAt ? parseInt(capturedAt, 10) : null;
      
      const { data: session } = await supabase
        .from('proctoring_sessions')
        .select('periodic_screenshots, periodic_screenshot_timestamps')
        .eq('id', sessionId)
        .single();
      
      const existingScreenshots = (session?.periodic_screenshots as string[]) || [];
      const existingTimestamps = (session?.periodic_screenshot_timestamps as number[]) || [];
      
      const updatedScreenshots = [...existingScreenshots, fileName];
      // Store actual video timestamps (seconds since recording started)
      const updatedTimestamps = [...existingTimestamps, capturedAtSeconds ?? existingTimestamps.length * 60];
      
      await supabase
        .from('proctoring_sessions')
        .update({ 
          periodic_screenshots: updatedScreenshots,
          periodic_screenshot_timestamps: updatedTimestamps
        })
        .eq('id', sessionId);
      
      console.log(`Camera screenshot stored with timestamp: ${capturedAtSeconds ?? 'estimated'}s`);
    }
    
    // For SCREEN periodic screenshots, store in separate columns
    if (screenshotType === 'screen_periodic') {
      const capturedAt = formData.get('capturedAt') as string | null;
      const capturedAtSeconds = capturedAt ? parseInt(capturedAt, 10) : null;
      
      const { data: session } = await supabase
        .from('proctoring_sessions')
        .select('screen_periodic_screenshots, screen_periodic_screenshot_timestamps')
        .eq('id', sessionId)
        .single();
      
      const existingScreenshots = (session?.screen_periodic_screenshots as string[]) || [];
      const existingTimestamps = (session?.screen_periodic_screenshot_timestamps as number[]) || [];
      
      const updatedScreenshots = [...existingScreenshots, fileName];
      const updatedTimestamps = [...existingTimestamps, capturedAtSeconds ?? existingTimestamps.length * 30];
      
      await supabase
        .from('proctoring_sessions')
        .update({ 
          screen_periodic_screenshots: updatedScreenshots,
          screen_periodic_screenshot_timestamps: updatedTimestamps
        })
        .eq('id', sessionId);
      
      console.log(`Screen screenshot stored with timestamp: ${capturedAtSeconds ?? 'estimated'}s`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        filePath: fileName,
        message: `${screenshotType} screenshot uploaded successfully` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in upload-proctoring-screenshot:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
