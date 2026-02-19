import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


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

    const { userId, userEmail, userName, organizationId } = await req.json();

    if (!userId || !userEmail) {
      throw new Error('Missing required fields: userId, userEmail');
    }

    // Get expiry hours from config (default 24 hours)
    const { data: expiryConfig } = await supabase
      .from('platform_configurations')
      .select('value')
      .eq('key', 'password_setup_link_expiry_hours')
      .single();
    
    const expiryHours = parseInt(expiryConfig?.value || '24');

    // ===== STEP 1: Generate token and create invitation =====
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // Store invitation record
    const { error: inviteError } = await supabase
      .from('password_setup_invitations')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
        organization_id: organizationId,
        created_by: req.headers.get('x-user-id')
      });

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      throw new Error('Failed to create password setup invitation');
    }

    // Get frontend base URL from platform configuration
    const { data: frontendConfig } = await supabase
      .from('platform_configurations')
      .select('value')
      .eq('key', 'frontend_base_url')
      .single();

    const frontendUrl = frontendConfig?.value || Deno.env.get('FRONTEND_URL') || 'https://app.interviewtalentgeenie.com';
    const setupUrl = `${frontendUrl}/reset-password/confirm?token=${token}&type=setup`;

    console.log('Password setup URL generated:', setupUrl);

    // ===== STEP 2: Send email using unified send-email service =====
    let emailSent = false;
    let emailError = null;

    try {
      // Import and use the unified email helper
      const { sendPasswordSetupEmail } = await import('../_shared/email-helper.ts');
      
      // Get organization name if available
      let organizationName = undefined;
      if (organizationId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', organizationId)
          .single();
        organizationName = org?.name;
      }

      const emailResult = await sendPasswordSetupEmail({
        userEmail,
        userName,
        organizationName,
        setupUrl,
        expiryHours
      });

      emailSent = emailResult.sent;
      if (!emailResult.success) {
        emailError = emailResult.error;
        console.warn('Email send warning:', emailError);
      }
    } catch (error: any) {
      console.error('Error sending email:', error.message);
      emailError = error.message;
    }

    // ===== STEP 3: ALWAYS return the setupUrl =====
    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        setupUrl,
        expiresAt: expiresAt.toISOString(),
        message: emailSent 
          ? 'Password setup email sent successfully'
          : 'Email service unavailable. Please share the setup link manually.',
        emailError: emailError || undefined
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in send-password-setup:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        emailSent: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
