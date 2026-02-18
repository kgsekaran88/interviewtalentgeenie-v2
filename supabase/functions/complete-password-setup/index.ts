import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWelcomeEmail } from "../_shared/email-helper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { token, password } = await req.json();

    if (!token || !password) {
      throw new Error('Missing required fields: token, password');
    }

    // Validate password strength (must match frontend validation)
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (password.length > 72) {
      throw new Error('Password must be less than 72 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    // Find invitation by token
    console.log('Looking up token:', token);
    const { data: invitation, error: inviteError } = await supabase
      .from('password_setup_invitations')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    console.log('Invitation lookup result:', { invitation, inviteError });

    if (inviteError || !invitation) {
      console.error('Invitation not found. Error:', inviteError);
      throw new Error('Invalid or expired setup link');
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error('This setup link has expired. Please contact your administrator for a new one.');
    }

    // Update user password and confirm email (required for login)
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      invitation.user_id,
      { 
        password,
        email_confirm: true  // Confirm email so user can login
      }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Failed to update password');
    }

    // Mark invitation as used
    const { error: markUsedError } = await supabase
      .from('password_setup_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (markUsedError) {
      console.error('Error marking invitation as used:', markUsedError);
    }

    // Activate organization membership after password is set
    if (invitation.organization_id) {
      const { error: memberError } = await supabase
        .from('organization_members')
        .update({ status: 'active' })
        .eq('user_id', invitation.user_id)
        .eq('organization_id', invitation.organization_id)
        .eq('status', 'pending');

      if (memberError) {
        console.error('Error activating organization membership:', memberError);
        // Don't throw - password was already set successfully
      }
    }

    // Get user's primary role and profile for welcome email
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', invitation.user_id)
      .neq('role', 'guest')
      .limit(1);

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', invitation.user_id)
      .single();

    // Get organization name if applicable
    let organizationName: string | undefined;
    if (invitation.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', invitation.organization_id)
        .single();
      organizationName = org?.name;
    }

    // Send welcome email based on role
    if (userRoles && userRoles.length > 0 && profile) {
      const primaryRole = userRoles[0].role;
      try {
        const emailResult = await sendWelcomeEmail({
          userEmail: profile.email,
          userName: profile.full_name,
          role: primaryRole,
          organizationName,
          skipForPartnerApproval: false
        });
        console.log('Welcome email sent:', emailResult.sent);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the password setup if email fails
      }
    }

    // Log audit
    await supabase
      .from('audit_logs')
      .insert({
        action: 'PASSWORD_SETUP_COMPLETED',
        table_name: 'password_setup_invitations',
        record_id: invitation.id,
        user_id: invitation.user_id,
        metadata: {
          invitation_id: invitation.id,
          completed_at: new Date().toISOString(),
          organization_activated: !!invitation.organization_id,
          welcome_email_sent: true
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password set successfully. You can now log in.',
        userId: invitation.user_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in complete-password-setup:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});