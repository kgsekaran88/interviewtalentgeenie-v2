import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';


/**
 * Restore Deleted Records
 * Platform admin function to:
 * - List soft-deleted organizations, interviews, users
 * - Restore specific soft-deleted entities
 * - Purge expired soft-deleted records (past retention period)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
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

    // Platform admin only
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin');

    if (!userRoles || userRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Platform admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { action, entityType, entityId, retentionDays } = await req.json();

    // ── LIST soft-deleted records ──
    if (action === 'list') {
      const { data, error } = await supabase.rpc('list_soft_deleted', {
        p_entity_type: entityType || 'all'
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, deleted_records: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── RESTORE a specific entity ──
    if (action === 'restore') {
      if (!entityType || !entityId) {
        return new Response(
          JSON.stringify({ error: 'entityType and entityId are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      let rpcName: string;
      let rpcParams: Record<string, any>;

      switch (entityType) {
        case 'organization':
          rpcName = 'restore_organization_tx';
          rpcParams = { p_organization_id: entityId };
          break;
        case 'interview':
          rpcName = 'restore_interview_tx';
          rpcParams = { p_interview_id: entityId };
          break;
        case 'user':
          rpcName = 'restore_user_tx';
          rpcParams = { p_user_id: entityId };
          break;
        default:
          return new Response(
            JSON.stringify({ error: 'entityType must be organization, interview, or user' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
      }

      const { data, error } = await supabase.rpc(rpcName, rpcParams);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // If restoring a user, unban their auth account
      if (entityType === 'user') {
        const { error: unbanError } = await supabase.auth.admin.updateUserById(entityId, {
          ban_duration: 'none'
        });
        if (unbanError) {
          console.warn('Failed to unban auth user during restore:', unbanError);
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: `RESTORE_${entityType.toUpperCase()}`,
        table_name: entityType === 'user' ? 'profiles' : `${entityType}s`,
        record_id: entityId,
        metadata: {
          restore_result: data,
          timestamp: new Date().toISOString()
        }
      });

      return new Response(
        JSON.stringify({ success: true, restored: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── PURGE expired soft-deleted records ──
    if (action === 'purge') {
      const days = retentionDays || 30;

      const { data, error } = await supabase.rpc('purge_soft_deleted', {
        p_retention_days: days
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'PURGE_SOFT_DELETED',
        table_name: 'system',
        record_id: 'purge',
        metadata: {
          retention_days: days,
          purge_result: data,
          timestamp: new Date().toISOString()
        }
      });

      return new Response(
        JSON.stringify({ success: true, purged: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: list, restore, or purge' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Error in restore-deleted:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
