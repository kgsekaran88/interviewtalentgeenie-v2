import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';


/**
 * Cleanup All Except Admins - DISABLED FOR SAFETY
 *
 * This function has been disabled to prevent catastrophic data loss.
 * It was responsible for the IntraEdge data wipe incident.
 *
 * If you genuinely need to reset a non-production environment, use:
 *   1. pg_dump backup first: scripts/pg-backup.sh
 *   2. Manual SQL with explicit confirmation
 *   3. The restore-deleted edge function to undo soft-deletes
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Still verify auth so unauthorized callers get a proper 401
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check if user is platform admin
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin');

    if (rolesError || !userRoles || userRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Platform admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // ── FUNCTION DISABLED ──
    // Log the attempt for security monitoring
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'BLOCKED_NUCLEAR_CLEANUP_ATTEMPT',
      table_name: 'system',
      record_id: 'cleanup-all-except-admins',
      metadata: {
        message: 'Attempt to call disabled cleanup-all-except-admins function',
        user_email: user.email,
        timestamp: new Date().toISOString()
      }
    });

    console.warn(`⚠️ BLOCKED: User ${user.email} attempted to call cleanup-all-except-admins`);

    return new Response(
      JSON.stringify({
        error: 'This function has been permanently disabled for safety',
        message: 'The cleanup-all-except-admins function has been disabled to prevent catastrophic data loss. ' +
          'Use individual soft-delete operations (delete-organization, admin-user-management) instead. ' +
          'All deletions are now reversible within 30 days.',
        alternatives: [
          'Use delete-organization to soft-delete specific organizations',
          'Use admin-user-management with action=delete-cascade for individual users',
          'Use restore-deleted to undo any soft-deletions',
          'Run scripts/pg-backup.sh before any destructive operations'
        ],
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      }
    );

  } catch (error) {
    console.error('Error in cleanup-all-except-admins:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
