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

    // ═══════════════════════════════════════════
    // CREATE USER (unchanged)
    // ═══════════════════════════════════════════
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
        userId = existingUser.id;
        
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
        const temporaryPassword = crypto.randomUUID();
        
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: false,
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

        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: profileCheck } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        
        if (!profileCheck) {
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

      if (organizationId) {
        const { data: existingMember } = await supabase
          .from("organization_members")
          .select("id, status")
          .eq("user_id", userId)
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (!existingMember) {
          await supabase
            .from("organization_members")
            .insert({
              organization_id: organizationId,
              user_id: userId,
              status: 'pending',
              invited_by: user.id
            });
        }
        logger.info('Organization membership handled', { userId, organizationId });
      }

      if (roleAssignments && roleAssignments.length > 0) {
        const roleInserts = roleAssignments.map((ra: { role: string; organization_id?: string | null; created_by_role?: string }) => ({
          user_id: userId,
          role: ra.role,
          organization_id: ra.organization_id || null,
          created_by_role: ra.created_by_role || 'platform_admin'
        }));

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

    // ═══════════════════════════════════════════
    // DELETE USER - now uses SOFT DELETE
    // ═══════════════════════════════════════════
    if (action === 'delete') {
      const deleteSchema = z.object({
        userId: z.string().uuid('Invalid user ID')
      });

      const { userId } = deleteSchema.parse(requestBody);
      logger.info('Soft-deleting user', { userId });

      if (userId === user.id) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use soft_delete_user_tx instead of hard delete
      const { data: txResult, error: txError } = await supabase.rpc('soft_delete_user_tx', {
        p_user_id: userId,
        p_admin_user_id: user.id
      });

      if (txError) {
        logger.error('Soft delete failed', txError, { userId });
        return new Response(
          JSON.stringify({ error: txError.message || 'Soft delete failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Disable the auth user (don't delete — allows restore)
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: '876000h' // ~100 years = effectively disabled
      });

      if (updateAuthError) {
        logger.warn('Failed to disable auth user (soft-delete still succeeded)', { userId, error: updateAuthError.message });
      }

      logger.info('User soft-deleted successfully', { userId, email: txResult?.user_email });
      return new Response(
        JSON.stringify({
          success: true,
          method: 'soft_delete',
          message: `User "${txResult?.user_email}" soft-deleted. Can be restored within 30 days.`,
          can_restore: true,
          restore_before: txResult?.restore_before,
          elevations: txResult?.elevations || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════
    // DELETE CASCADE - now uses SOFT DELETE
    // ═══════════════════════════════════════════
    if (action === 'delete-cascade') {
      const cascadeDeleteSchema = z.object({
        userId: z.string().uuid('Invalid user ID')
      });

      const { userId } = cascadeDeleteSchema.parse(requestBody);
      logger.info('Soft-deleting user with cascade', { userId });

      if (userId === user.id) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use soft_delete_user_tx (handles partner admin elevation)
      const { data: txResult, error: txError } = await supabase.rpc('soft_delete_user_tx', {
        p_user_id: userId,
        p_admin_user_id: user.id
      });

      if (txError) {
        logger.error('Cascade soft delete failed', txError, { userId });
        
        if (txError.message?.includes('Cannot delete') || txError.message?.includes('not found')) {
          return new Response(
            JSON.stringify({ error: txError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: txError.message || 'Cascade soft deletion failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Disable auth user (ban instead of delete)
      const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: '876000h'
      });

      if (banError) {
        logger.warn('Failed to ban auth user after cascade soft-delete', { userId, error: banError.message });
      }

      logger.info('User cascade soft-deleted successfully', { userId, elevations: txResult?.elevations });
      return new Response(
        JSON.stringify({ 
          success: true,
          method: 'soft_delete',
          message: txResult?.elevations?.length > 0 
            ? `User soft-deleted. ${txResult.elevations.map((e: any) => `${e.new_admin_email} was elevated to partner admin for ${e.org_name}`).join('. ')}`
            : 'User soft-deleted. Can be restored within 30 days.',
          can_restore: true,
          restore_before: txResult?.restore_before,
          elevations: txResult?.elevations || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════
    // GET USER ORGS (unchanged)
    // ═══════════════════════════════════════════
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

    // ═══════════════════════════════════════════
    // BULK DELETE - FIXED: now uses soft delete + proper cleanup
    // Previously had a BUG: deleted auth users but left orphaned records
    // ═══════════════════════════════════════════
    if (action === 'bulk-delete') {
      const bulkDeleteSchema = z.object({
        userIds: z.array(z.string().uuid('Invalid user ID')).min(1, 'At least one user ID required').max(100, 'Cannot delete more than 100 users at once')
      });

      const { userIds } = bulkDeleteSchema.parse(requestBody);

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

      // FIXED: Use soft_delete_user_tx for each user (not just auth deletion)
      for (const targetUserId of userIds) {
        try {
          // Soft-delete user data via transaction
          const { data: txResult, error: txError } = await supabase.rpc('soft_delete_user_tx', {
            p_user_id: targetUserId,
            p_admin_user_id: user.id
          });

          if (txError) {
            results.failed.push({
              userId: targetUserId,
              error: txError.message
            });
            continue;
          }

          // Ban auth user (don't delete — allows restore)
          const { error: banError } = await supabase.auth.admin.updateUserById(targetUserId, {
            ban_duration: '876000h'
          });

          if (banError) {
            logger.warn('Failed to ban auth user during bulk soft-delete', { userId: targetUserId });
          }

          results.success.push(targetUserId);
        } catch (err: any) {
          results.failed.push({
            userId: targetUserId,
            error: err?.message || 'Unknown error'
          });
        }
      }

      // Audit log for bulk operation
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'BULK_SOFT_DELETE_USERS',
        table_name: 'profiles',
        record_id: 'bulk',
        metadata: {
          total_requested: userIds.length,
          successful: results.success.length,
          failed: results.failed.length,
          user_ids: userIds,
          timestamp: new Date().toISOString()
        }
      });

      return new Response(
        JSON.stringify({ 
          success: true,
          method: 'soft_delete',
          deleted: results.success.length,
          failed: results.failed.length,
          can_restore: true,
          message: `${results.success.length} users soft-deleted. Can be restored within 30 days.`,
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
