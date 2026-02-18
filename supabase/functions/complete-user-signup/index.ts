import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendWelcomeEmail } from '../_shared/email-helper.ts';

console.log('complete-user-signup function starting');

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client to verify user
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing post-signup for user:', user.id);

    // Create service client for privileged operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const errors: string[] = [];
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';

    // 1. Create profile (if not exists) with email_verified = false
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          email: user.email,
          email_verified: false  // New users must verify their email
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        errors.push(`Profile: ${profileError.message}`);
      } else {
        console.log('Profile created/updated successfully with email_verified=false');
      }
    } catch (error) {
      console.error('Profile creation exception:', error);
      errors.push(`Profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 2. Assign guest role (check first, then insert if not exists)
    let isNewUser = false;
    try {
      // First check if user already has a role
      const { data: existingRoles, error: checkError } = await supabase
        .from('user_roles')
        .select('id, role')
        .eq('user_id', user.id);

      if (checkError) {
        console.error('Role check error:', checkError);
        errors.push(`Role check: ${checkError.message}`);
      } else if (!existingRoles || existingRoles.length === 0) {
        isNewUser = true; // This is a new user, will send welcome email
        // No roles exist, insert guest role with explicit null for organization_id
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            role: 'guest',
            organization_id: null,
            assigned_by: null
          });

        if (roleError) {
          // Check if it's a duplicate error (race condition)
          if (roleError.code === '23505') {
            console.log('Role already exists (race condition), skipping welcome email...');
            isNewUser = false; // Already processed by another call
          } else {
            console.error('Role assignment error:', roleError);
            errors.push(`Role: ${roleError.message}`);
          }
        } else {
          console.log('Guest role assigned successfully');
        }
      } else {
        console.log('User already has roles:', existingRoles.map(r => r.role).join(', '), '- skipping welcome email');
      }
    } catch (error) {
      console.error('Role assignment exception:', error);
      errors.push(`Role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 3. Initialize onboarding progress (if not exists)
    try {
      // Check if onboarding progress exists
      const { data: existingProgress } = await supabase
        .from('onboarding_progress')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingProgress) {
        const { error: onboardingError } = await supabase
          .from('onboarding_progress')
          .insert({ user_id: user.id });

        if (onboardingError) {
          // Ignore duplicate errors
          if (onboardingError.code !== '23505') {
            console.error('Onboarding initialization error:', onboardingError);
            errors.push(`Onboarding: ${onboardingError.message}`);
          }
        } else {
          console.log('Onboarding progress initialized successfully');
        }
      } else {
        console.log('Onboarding progress already exists');
      }
    } catch (error) {
      console.error('Onboarding initialization exception:', error);
      errors.push(`Onboarding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 4. Send verification email ONLY for truly new users (prevents duplicate emails)
    if (isNewUser) {
      try {
        console.log('Sending verification email to new self-registered user:', user.email);
        
        // Call the send-verification-email function
        const verificationResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-verification-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              userId: user.id,
              email: user.email,
              userName: fullName,
            }),
          }
        );

        if (verificationResponse.ok) {
          console.log('Verification email sent successfully');
        } else {
          const errorData = await verificationResponse.json();
          console.error('Verification email error:', errorData);
        }
      } catch (emailError) {
        console.error('Verification email error (non-blocking):', emailError);
      }
    } else {
      console.log('Skipping verification email - user already existed or was processed by another call');
    }

    // Return success even if some operations failed (signup should not be blocked)
    return new Response(
      JSON.stringify({ 
        success: true,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0 
          ? 'User created but some post-signup operations failed'
          : 'User signup completed successfully'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in complete-user-signup:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
