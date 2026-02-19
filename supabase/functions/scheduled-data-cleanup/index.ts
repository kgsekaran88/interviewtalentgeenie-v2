import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';


/**
 * Scheduled Data Cleanup Edge Function
 * 
 * Executes data retention cleanup based on configured policies.
 * Designed to be called daily via external cron service or manual trigger.
 * 
 * Data cleaned:
 * - Proctoring recordings: 90 days
 * - Audit logs: 365 days (1 year)
 * - Email logs: 180 days (6 months)
 * - Notifications: 90 days (read only)
 * 
 * SECURITY: Requires platform_admin role OR service role key for scheduled execution
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[scheduled-data-cleanup] Starting data retention cleanup...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Check for authorization
    const authHeader = req.headers.get('Authorization');
    let isAuthorized = false;

    // Allow service role key (for scheduled/cron calls)
    if (authHeader?.includes(supabaseServiceKey)) {
      isAuthorized = true;
      console.log('[scheduled-data-cleanup] Authorized via service role key');
    } else if (authHeader) {
      // Check if user is platform_admin
      const supabaseClient = createClient(supabaseUrl, authHeader.replace('Bearer ', ''));
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      
      if (!userError && user) {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: roles } = await adminClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'platform_admin')
          .single();
        
        if (roles) {
          isAuthorized = true;
          console.log('[scheduled-data-cleanup] Authorized via platform_admin role');
        }
      }
    }

    // For scheduled calls without auth, check for a secret header
    const scheduledSecret = req.headers.get('x-scheduled-secret');
    const expectedSecret = Deno.env.get('SCHEDULED_CLEANUP_SECRET');
    if (scheduledSecret && expectedSecret && scheduledSecret === expectedSecret) {
      isAuthorized = true;
      console.log('[scheduled-data-cleanup] Authorized via scheduled secret');
    }

    if (!isAuthorized) {
      console.error('[scheduled-data-cleanup] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Requires platform_admin role or valid service key.' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create admin client for cleanup operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, flag any stuck upload attempts (pending > 30 minutes)
    console.log('[scheduled-data-cleanup] Checking for stuck upload attempts...');
    const { data: stuckData, error: stuckError } = await supabase.rpc('flag_stuck_upload_attempts');
    
    if (stuckError) {
      console.warn('[scheduled-data-cleanup] Error flagging stuck uploads:', stuckError);
    } else if (stuckData && stuckData.length > 0 && stuckData[0].attempts_flagged > 0) {
      console.log('[scheduled-data-cleanup] Flagged stuck uploads:', stuckData[0]);
    }

    // Execute the database cleanup function
    const { data, error } = await supabase.rpc('execute_data_retention_cleanup');

    if (error) {
      console.error('[scheduled-data-cleanup] Database function error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          duration_ms: Date.now() - startTime
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Clean up orphaned proctoring chunks (.part files)
    console.log('[scheduled-data-cleanup] Cleaning up proctoring chunks...');
    let chunksCleanupResult = { chunksDeleted: 0, bytesFreedMB: '0' };
    
    try {
      const cleanupResponse = await fetch(
        `${supabaseUrl}/functions/v1/cleanup-proctoring-chunks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ dryRun: false, maxSessions: 200 }),
        }
      );
      
      if (cleanupResponse.ok) {
        const cleanupData = await cleanupResponse.json();
        chunksCleanupResult = {
          chunksDeleted: cleanupData.stats?.chunksDeleted || 0,
          bytesFreedMB: cleanupData.stats?.bytesFreedMB || '0',
        };
        console.log('[scheduled-data-cleanup] Chunks cleanup result:', chunksCleanupResult);
      } else {
        console.warn('[scheduled-data-cleanup] Chunks cleanup failed:', await cleanupResponse.text());
      }
    } catch (chunkErr) {
      console.warn('[scheduled-data-cleanup] Chunks cleanup error:', chunkErr);
    }

    const duration = Date.now() - startTime;
    console.log('[scheduled-data-cleanup] Cleanup completed successfully:', {
      ...data,
      duration_ms: duration
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: data,
        stuck_uploads_flagged: stuckData?.[0]?.attempts_flagged || 0,
        chunks_cleanup: chunksCleanupResult,
        duration_ms: duration,
        message: `Data retention cleanup completed. Deleted ${data?.total_deleted || 0} records. Flagged ${stuckData?.[0]?.attempts_flagged || 0} stuck uploads. Freed ${chunksCleanupResult.bytesFreedMB} MB from ${chunksCleanupResult.chunksDeleted} chunk files.`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('[scheduled-data-cleanup] Unexpected error:', err);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error occurred',
        duration_ms: duration
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
