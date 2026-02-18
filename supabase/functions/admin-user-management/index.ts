import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";

Deno.serve(async (req) => {
  const logger = createLogger('admin-user-management');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Admin user management request started');
    
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ['platform_admin', 'partner_admin']);

    if (authResult.error) {
      logger.warn('Authentication failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.error.includes('required') ? 401 : 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user, supabase } = authResult;
    logger.info('Admin authenticated', { userId: user.id });

    const requestBody = await req.json();
    const action = requestBody.action;

    // Handle create user action
    if (action === 'create') {
      const roleAssignmentSchema = z.object({
        role: z.string(),
        organization_id: z.string().uuid().nullable().optional(),
        created_by_role: z.string().optional()
      });
      
      const createSchema = z.object({
        email: z.string().email('Invalid email format').max(255),
        fullName: z.string().min(1, 'Full name is required').max(200),
        roles: z.array(z.string()).optional(),
        roleAssignments: z.array(roleAssignmentSchema).optional(),
        organizationId: z.string().uuid().nullable().optional()
      });

      const { email, fullName, roles: userRoles, roleAssignments, organizationId } = createSchema.parse(requestBody);
      logger.info('Creating new user', { email, hasRoleAssignments: !!roleAssignments });

      let userId: string;
      let passwordSetupLink: string | null = null;
      let emailSent = false;

      // Check if user already exists in auth
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find((u: { email?: string }) => u.email === email);

      if (existingUser) {
        // User exists in auth, use their ID
        userId = existingUser.id;
        
        // Ensure profile exists (in case trigger failed)
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: userId,
            email: email,
            full_name: fullName
          }, { onConflict: 'id' });

        if (profileError) {
          logger.error('Profile upsert error', profileError, { userId });
        }
        
        logger.info('User already exists, using existing account', { userId, email });
      } else {
        // Create new user with a temporary random password
        const temporaryPassword = crypto.randomUUID();
        
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: false, // Don't auto-confirm, user must set password via link
          user_metadata: { full_name: fullName }
        });

        if (createError) {
          logger.error('Failed to create user', createError, { email });
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        userId = newUser.user.id;

        // Wait for profile trigger and verify profile creation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: profileCheck } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        
        if (!profileCheck) {
          // If trigger failed, create profile manually
          const { error: manualProfileError } = await supabase
            .from("profiles")
            .insert({
              id: userId,
              email: email,
              full_name: fullName
            });
          
          if (manualProfileError) {
            logger.error('Manual profile creation failed', manualProfileError, { userId });
          }
        }
        
        // Send password setup email
        try {
          const emailResponse = await supabase.functions.invoke('send-password-setup', {
            body: {
              userId,
              userEmail: email,
              userName: fullName
            }
          });

          if (emailResponse.error) {
            logger.error('Error sending password setup email', emailResponse.error, { userId });
            passwordSetupLink = emailResponse.data?.setupUrl;
            emailSent = emailResponse.data?.emailSent || false;
          } else {
            logger.info('Password setup email sent successfully', { userId });
            passwordSetupLink = emailResponse.data?.setupUrl;
            emailSent = emailResponse.data?.emailSent !== false;
          }
        } catch (emailError) {
          logger.error('Failed to send password setup email', emailError as Error, { userId });
        }
      }

      // Handle organization membership if organizationId provided
      if (organizationId) {
        const { data: existingMember } = await supabase
          .from("organization_members")
          .select("id, status")
          .eq("user_id", userId)
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (!existingMember) {
          // Create membership as 'pending' - will be activated after password setup
          await supabase
            .from("organization_members")
            .insert({
              organization_id: organizationId,
              user_id: userId,
              status: 'pending',
              invited_by: user.id
            });
        }
        // If member exists, don't change their status - password setup will activate if needed
        logger.info('Organization membership handled', { userId, organizationId });
      }

      // Assign roles with organization scope if roleAssignments provided
      if (roleAssignments && roleAssignments.length > 0) {
        const roleInserts = roleAssignments.map((ra: { role: string; organization_id?: string | null; created_by_role?: string }) => ({
          user_id: userId,
          role: ra.role,
          organization_id: ra.organization_id || null,
          created_by_role: ra.created_by_role || 'platform_admin'
        }));

        // Delete existing roles first (to handle updates)
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        const { error: rolesError } = await supabase
          .from("user_roles")
          .insert(roleInserts);

        if (rolesError) {
          logger.error('Failed to assign roles with org scope', rolesError, { userId, roleAssignments });
        } else {
          logger.info('Roles assigned with organization scope', { userId, roleCount: roleInserts.length });
        }
      } else if (userRoles && userRoles.length > 0) {
        // Fallback to simple role assignment without org scope
        const roleInserts = userRoles.map((role: string) => ({
          user_id: userId,
          role: role
        }));

        const { error: rolesError } = await supabase
          .from("user_roles")
          .upsert(roleInserts, { onConflict: 'user_id,role' });

        if (rolesError) {
          logger.error('Failed to assign roles', rolesError, { userId, roles: userRoles });
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          user: { 
            id: userId, 
            email: email,
            full_name: fullName
          },
          message: emailSent 
            ? 'User created. Password setup email sent.'
            : 'User created. Please share the password setup link manually.',
          passwordSetupLink,
          emailSent
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle delete user action
    if (action === 'delete') {
      const deleteSchema = z.object({
        userId: z.string().uuid('Invalid user ID')
      });

      const { userId } = deleteSchema.parse(requestBody);
      logger.info('Deleting user', { userId });

      // Prevent admin from deleting themselves
      if (userId === user.id) {
        logger.warn('Attempted self-deletion', { userId });
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has any active organization memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id, status, organizations(name)')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (membershipError) {
        logger.error('Failed to check memberships', membershipError, { userId });
        return new Response(
          JSON.stringify({ error: 'Failed to check user memberships' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (memberships && memberships.length > 0) {
        const orgDetails = memberships.map((m: any) => ({
          id: m.organization_id,
          name: m.organizations?.name || 'Unknown Organization'
        }));
        
        logger.warn('User has active organization memberships', { userId, count: memberships.length, organizations: orgDetails });
        return new Response(
          JSON.stringify({ 
            error: 'User has active organization memberships. Please remove user from all organizations first.',
            organizationCount: memberships.length,
            organizations: orgDetails
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for data dependencies that would prevent deletion
      const dataDependencies = [];
      
      // Untag interviews created by this user (set creator_id to null)
      // This ensures new accounts with same email don't see old interviews
      const { error: untagInterviewsError } = await supabase
        .from('interviews')
        .update({ creator_id: null })
        .eq('creator_id', userId);
      
      if (untagInterviewsError) {
        logger.error('Failed to untag interviews from user', untagInterviewsError, { userId });
      } else {
        logger.info('Untagged interviews from user', { userId });
      }

      // Check for learning assessments
      const { data: assessments } = await supabase
        .from('learning_assessments')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      if (assessments && assessments.length > 0) {
        dataDependencies.push('learning assessments');
      }

      // Check for certificates
      const { data: certificates } = await supabase
        .from('certificates')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      if (certificates && certificates.length > 0) {
        dataDependencies.push('certificates');
      }

      // Check for learning assessment attempts
      const { data: attempts } = await supabase
        .from('learning_assessment_attempts')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      if (attempts && attempts.length > 0) {
        dataDependencies.push('assessment attempts');
      }

      if (dataDependencies.length > 0) {
        logger.warn('User has data dependencies', { userId, dependencies: dataDependencies });
        return new Response(
          JSON.stringify({ 
            error: 'Cannot delete user with existing data. User has: ' + dataDependencies.join(', '),
            dependencies: dataDependencies,
            suggestion: 'Consider anonymizing or archiving this data instead of deletion'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Clean up user data in order
      logger.info('Starting comprehensive data cleanup', { userId });
      
      // 1. Delete user roles
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) {
        logger.error('Failed to delete user roles', rolesError, { userId });
      }

      // 2. Delete custom role assignments
      const { error: customRolesError } = await supabase
        .from('user_custom_roles')
        .delete()
        .eq('user_id', userId);

      if (customRolesError) {
        logger.error('Failed to delete custom roles', customRolesError, { userId });
      }

      // 3. Delete notifications
      const { error: notificationsError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (notificationsError) {
        logger.error('Failed to delete notifications', notificationsError, { userId });
      }

      // 4. Delete onboarding progress
      const { error: onboardingError } = await supabase
        .from('onboarding_progress')
        .delete()
        .eq('user_id', userId);

      if (onboardingError) {
        logger.error('Failed to delete onboarding progress', onboardingError, { userId });
      }

      // 5. Delete security events
      const { error: securityError } = await supabase
        .from('security_events')
        .delete()
        .eq('user_id', userId);

      if (securityError) {
        logger.error('Failed to delete security events', securityError, { userId });
      }

      // 6. Delete user topic progress
      const { error: topicProgressError } = await supabase
        .from('user_topic_progress')
        .delete()
        .eq('user_id', userId);

      if (topicProgressError) {
        logger.error('Failed to delete topic progress', topicProgressError, { userId });
      }

      // 7. Delete user badges
      const { error: badgesError } = await supabase
        .from('user_badges')
        .delete()
        .eq('user_id', userId);

      if (badgesError) {
        logger.error('Failed to delete badges', badgesError, { userId });
      }

      // 8. Delete learning payments
      const { error: paymentsError } = await supabase
        .from('learning_payments')
        .delete()
        .eq('user_id', userId);

      if (paymentsError) {
        logger.error('Failed to delete learning payments', paymentsError, { userId });
      }

      // 9. Delete learning subscriptions
      const { error: subscriptionsError } = await supabase
        .from('learning_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (subscriptionsError) {
        logger.error('Failed to delete learning subscriptions', subscriptionsError, { userId });
      }

      // 10. Delete learning assessment usage
      const { error: usageError } = await supabase
        .from('learning_assessment_usage')
        .delete()
        .eq('user_id', userId);

      if (usageError) {
        logger.error('Failed to delete assessment usage', usageError, { userId });
      }

      // 11. Delete password setup invitations
      const { error: passwordInvError } = await supabase
        .from('password_setup_invitations')
        .delete()
        .eq('user_id', userId);

      if (passwordInvError) {
        logger.error('Failed to delete password invitations', passwordInvError, { userId });
      }

      // 12. Delete inactive organization memberships
      const { error: inactiveMembershipsError } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', userId)
        .neq('status', 'active');

      if (inactiveMembershipsError) {
        logger.error('Failed to delete inactive memberships', inactiveMembershipsError, { userId });
      }

      // 13. Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        logger.error('Failed to delete profile', profileError, { userId });
      }

      logger.info('Data cleanup completed, attempting auth deletion', { userId });

      // 14. Finally delete user from auth.users
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) {
        logger.error('Failed to delete user from auth', deleteError, { userId });
        
        // Return detailed error message
        return new Response(
          JSON.stringify({ 
            error: 'Failed to delete user. User may have created content (interviews, assessments, certificates) that must be handled first.',
            details: deleteError.message,
            suggestion: 'Check if user has created interviews, learning assessments, or earned certificates. Consider archiving or transferring ownership of this content before deletion.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      logger.info('User deleted successfully', { userId });
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (action === 'delete-cascade') {
      const cascadeDeleteSchema = z.object({
        userId: z.string().uuid('Invalid user ID')
      });

      const { userId } = cascadeDeleteSchema.parse(requestBody);
      logger.info('Cascade deleting user (with org removal)', { userId });

      // Prevent admin from deleting themselves
      if (userId === user.id) {
        logger.warn('Attempted self-deletion', { userId });
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use transactional database function for atomic cascade deletion
      const { data: txResult, error: txError } = await supabase.rpc('delete_user_cascade_tx', {
        p_user_id: userId,
        p_admin_user_id: user.id
      });

      if (txError) {
        logger.error('Cascade delete transaction failed', txError, { userId });
        
        // Check if it's a data dependency error
        if (txError.message?.includes('Cannot delete')) {
          return new Response(
            JSON.stringify({ 
              error: txError.message,
              dependencies: txError.details || [],
              suggestion: 'Consider anonymizing or archiving this data instead of deletion'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: txError.message || 'Cascade deletion failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      logger.info('Database cascade delete completed', { userId, txResult });

      // Now delete user from auth.users (external call after DB commit)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) {
        logger.error('Failed to delete user from auth after cascade', deleteError, { userId });
        return new Response(
          JSON.stringify({ 
            error: 'User data was removed but auth deletion failed: ' + deleteError.message,
            partialSuccess: true,
            elevations: txResult.elevations || []
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      logger.info('User cascade deleted successfully', { userId, elevations: txResult.elevations });
      return new Response(
        JSON.stringify({ 
          success: true,
          elevations: txResult.elevations || [],
          message: txResult.elevations?.length > 0 
            ? `User deleted. ${txResult.elevations.map((e: any) => `${e.new_admin_email} was elevated to partner admin for ${e.org_name}`).join('. ')}`
            : 'User deleted successfully'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle get user org memberships action (for UI to display before deletion)
    if (action === 'get-user-orgs') {
      const getOrgsSchema = z.object({
        userId: z.string().uuid('Invalid user ID')
      });

      const { userId } = getOrgsSchema.parse(requestBody);
      
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id, status, joined_at, organizations(name)')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (membershipError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch user organizations' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has partner_admin role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      const isPartnerAdmin = userRoles?.some((r: { role: string }) => r.role === 'partner_admin');

      return new Response(
        JSON.stringify({ 
          success: true,
          organizations: (memberships || []).map((m: any) => ({
            id: m.organization_id,
            name: m.organizations?.name || 'Unknown Organization',
            joinedAt: m.joined_at
          })),
          isPartnerAdmin
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle bulk delete users action
    if (action === 'bulk-delete') {
      const bulkDeleteSchema = z.object({
        userIds: z.array(z.string().uuid('Invalid user ID')).min(1, 'At least one user ID required').max(100, 'Cannot delete more than 100 users at once')
      });

      const { userIds } = bulkDeleteSchema.parse(requestBody);

      // Prevent admin from deleting themselves
      if (userIds.includes(user.id)) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results = {
        success: [] as string[],
        failed: [] as { userId: string; error: string }[]
      };

      // Delete users one by one
      for (const targetUserId of userIds) {
        try {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);
          
          if (deleteError) {
            results.failed.push({
              userId: targetUserId,
              error: deleteError.message
            });
          } else {
            results.success.push(targetUserId);
          }
        } catch (err: any) {
          results.failed.push({
            userId: targetUserId,
            error: err?.message || 'Unknown error'
          });
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          deleted: results.success.length,
          failed: results.failed.length,
          details: results
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const logger = createLogger('admin-user-management');
    logger.error('Fatal error in admin-user-management', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
