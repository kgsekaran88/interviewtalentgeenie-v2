import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Starting cleanup of all data except platform admins...');

    // Get all platform admin user IDs
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'platform_admin');

    const adminUserIds = adminRoles?.map(r => r.user_id) || [];
    console.log(`Found ${adminUserIds.length} platform admin users to preserve`);

    const deletedCounts: Record<string, number> = {};

    // Delete data in reverse dependency order
    
    // 1. Interview-related data
    const tables = [
      'ai_usage_logs',
      'ai_health_monitoring',
      'ai_health_checks',
      'ai_health_alerts',
      'ai_feature_alerts',
      'proctoring_violations',
      'proctoring_sessions',
      'bias_detection_results',
      'candidate_performance_index',
      'assessments',
      'responses',
      'interview_attempts',
      'attempt_questions',
      'questions',
      'interviews',
      'ats_sync_logs',
      'ats_candidates',
      'ats_integrations',
      'certificates',
      'learning_assessment_attempts',
      'learning_assessments',
      'learning_module_progress',
      'learning_recommendations',
      'learning_skills_assessments',
      'user_badges',
      'subscription_usage',
      'invoices',
      'organization_subscriptions',
      'organizations',
      'test_results',
      'test_runs',
      'test_cases',
      'chatbot_knowledge',
      'consent_records',
      'data_deletion_requests',
      'approval_workflows',
      'activity_feed',
      'collaboration_threads',
      'comparative_analytics',
      'analytics_snapshots',
      'generated_reports'
    ];

    for (const table of tables) {
      try {
        const { error: deleteError, count } = await supabase
          .from(table)
          .delete({ count: 'exact' })
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deleteError) {
          console.error(`Error deleting from ${table}:`, deleteError);
        } else {
          deletedCounts[table] = count || 0;
          console.log(`Deleted ${count || 0} rows from ${table}`);
        }
      } catch (error) {
        console.error(`Failed to delete from ${table}:`, error);
      }
    }

    // Delete audit logs for non-admin users
    const { error: auditDeleteError, count: auditCount } = await supabase
      .from('audit_logs')
      .delete({ count: 'exact' })
      .not('user_id', 'in', `(${adminUserIds.map(id => `'${id}'`).join(',')})`)
      .not('user_id', 'is', null);

    if (!auditDeleteError) {
      deletedCounts['audit_logs'] = auditCount || 0;
      console.log(`Deleted ${auditCount || 0} audit logs for non-admin users`);
    }

    // Delete non-admin user roles (keep platform admins)
    const { error: rolesDeleteError, count: rolesCount } = await supabase
      .from('user_roles')
      .delete({ count: 'exact' })
      .not('user_id', 'in', `(${adminUserIds.map(id => `'${id}'`).join(',')})`)
      .neq('role', 'platform_admin');

    if (!rolesDeleteError) {
      deletedCounts['user_roles'] = rolesCount || 0;
      console.log(`Deleted ${rolesCount || 0} non-admin user roles`);
    }

    // Delete profiles for non-admin users
    const { error: profilesDeleteError, count: profilesCount } = await supabase
      .from('profiles')
      .delete({ count: 'exact' })
      .not('id', 'in', `(${adminUserIds.map(id => `'${id}'`).join(',')})`);

    if (!profilesDeleteError) {
      deletedCounts['profiles'] = profilesCount || 0;
      console.log(`Deleted ${profilesCount || 0} non-admin profiles`);
    }

    // Delete organization memberships for non-admin users
    const { error: membersDeleteError, count: membersCount } = await supabase
      .from('organization_members')
      .delete({ count: 'exact' })
      .not('user_id', 'in', `(${adminUserIds.map(id => `'${id}'`).join(',')})`);

    if (!membersDeleteError) {
      deletedCounts['organization_members'] = membersCount || 0;
      console.log(`Deleted ${membersCount || 0} non-admin organization memberships`);
    }

    // Delete non-admin users from auth.users (via admin API)
    const { data: allUsers, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
    } else {
      let deletedUsers = 0;
      for (const authUser of allUsers.users) {
        if (!adminUserIds.includes(authUser.id)) {
          const { error: deleteUserError } = await supabase.auth.admin.deleteUser(authUser.id);
          if (!deleteUserError) {
            deletedUsers++;
          } else {
            console.error(`Failed to delete user ${authUser.id}:`, deleteUserError);
          }
        }
      }
      deletedCounts['auth_users'] = deletedUsers;
      console.log(`Deleted ${deletedUsers} non-admin users`);
    }

    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);

    console.log('Cleanup completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'All data except platform admins deleted successfully',
        deleted_counts: deletedCounts,
        total_deleted: totalDeleted,
        preserved_admins: adminUserIds.length,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in cleanup-all-except-admins:', error);
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
