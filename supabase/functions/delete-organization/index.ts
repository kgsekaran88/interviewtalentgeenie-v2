import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Delete Organization
 * Uses transactional database function for atomicity
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

    const { organizationId, deleteUsers = false } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Starting transactional deletion of organization: ${organizationId}`);

    // Get organization info for logging before deletion
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();

    const orgName = org?.name || 'Unknown';

    // Get member IDs before deletion (for optional user deletion)
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId);

    const memberUserIds = members?.map(m => m.user_id) || [];

    // Call the transactional database function
    const { data, error } = await supabase.rpc('delete_organization_tx', {
      p_organization_id: organizationId
    });

    if (error) {
      console.error('Transaction error:', error);
      return new Response(
        JSON.stringify({ error: error.message, success: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Organization deletion transaction completed:', data);

    // Optionally delete auth users who were members (after transaction)
    let deletedUsers = 0;
    if (deleteUsers && memberUserIds.length > 0) {
      for (const userId of memberUserIds) {
        // Check if user is a platform admin - don't delete them
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'platform_admin')
          .maybeSingle();

        if (adminCheck) {
          console.log(`Skipping platform admin user: ${userId}`);
          continue;
        }

        // Check if user is member of any other organization
        const { data: otherMemberships } = await supabase
          .from('organization_members')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active');

        if (otherMemberships && otherMemberships.length > 0) {
          console.log(`User ${userId} is member of other orgs, skipping deletion`);
          continue;
        }

        // Delete auth user (profile already deleted by transaction)
        const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
        if (!deleteUserError) {
          deletedUsers++;
        } else {
          console.error(`Failed to delete user ${userId}:`, deleteUserError);
        }
      }
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'DELETE_ORGANIZATION_COMPLETE',
      table_name: 'organizations',
      record_id: organizationId,
      metadata: {
        organization_name: orgName,
        deleted_counts: data?.deleted_counts || {},
        users_deleted: deletedUsers,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Organization "${orgName}" and all related data deleted successfully`,
        deleted_counts: data?.deleted_counts || {},
        users_deleted: deletedUsers,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in delete-organization:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
