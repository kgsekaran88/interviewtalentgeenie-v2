import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Delete Organization - SOFT DELETE with confirmation gate
 * Uses soft_delete_organization_tx for safe, reversible deletion.
 * Requires confirmation phrase "DELETE <org-name>" to proceed.
 * Hard delete only available with force=true AND typed confirmation.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the caller is a platform admin
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

    const { organizationId, deleteUsers = false, confirmation, force = false } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get organization info
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();

    const orgName = org?.name || 'Unknown';

    // ── CONFIRMATION GATE ──
    const expectedConfirmation = `DELETE ${orgName}`;
    if (!confirmation || confirmation !== expectedConfirmation) {
      return new Response(
        JSON.stringify({
          error: 'Confirmation required',
          message: `To delete organization "${orgName}", send confirmation: "${expectedConfirmation}"`,
          requires_confirmation: true,
          organization_name: orgName
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ── SOFT DELETE (default) ──
    if (!force) {
      console.log(`Soft-deleting organization: ${organizationId} (${orgName})`);

      const { data, error } = await supabase.rpc('soft_delete_organization_tx', {
        p_organization_id: organizationId
      });

      if (error) {
        console.error('Soft-delete transaction error:', error);
        return new Response(
          JSON.stringify({ error: error.message, success: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'SOFT_DELETE_ORGANIZATION',
        table_name: 'organizations',
        record_id: organizationId,
        metadata: {
          organization_name: orgName,
          soft_deleted_counts: data?.soft_deleted_counts || {},
          can_restore: true,
          restore_before: data?.restore_before,
          timestamp: new Date().toISOString()
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          method: 'soft_delete',
          message: `Organization "${orgName}" soft-deleted. Can be restored within 30 days.`,
          soft_deleted_counts: data?.soft_deleted_counts || {},
          can_restore: true,
          restore_before: data?.restore_before,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── HARD DELETE (force=true) ── only for permanent purge
    console.log(`HARD-deleting organization: ${organizationId} (${orgName}) [force=true]`);

    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId);

    const memberUserIds = members?.map((m: any) => m.user_id) || [];

    const { data, error } = await supabase.rpc('delete_organization_tx', {
      p_organization_id: organizationId
    });

    if (error) {
      console.error('Hard-delete transaction error:', error);
      return new Response(
        JSON.stringify({ error: error.message, success: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let deletedUsers = 0;
    if (deleteUsers && memberUserIds.length > 0) {
      for (const userId of memberUserIds) {
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'platform_admin')
          .maybeSingle();
        if (adminCheck) continue;

        const { data: otherMemberships } = await supabase
          .from('organization_members')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active');
        if (otherMemberships && otherMemberships.length > 0) continue;

        const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
        if (!deleteUserError) deletedUsers++;
      }
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'HARD_DELETE_ORGANIZATION',
      table_name: 'organizations',
      record_id: organizationId,
      metadata: {
        organization_name: orgName,
        deleted_counts: data?.deleted_counts || {},
        users_deleted: deletedUsers,
        force: true,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        method: 'hard_delete',
        message: `Organization "${orgName}" permanently deleted. THIS CANNOT BE UNDONE.`,
        deleted_counts: data?.deleted_counts || {},
        users_deleted: deletedUsers,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in delete-organization:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
