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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Find the verification token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .is('verified_at', null)
      .single();

    if (tokenError || !tokenRecord) {
      console.error('Token not found or already used:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification link' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Verification link has expired. Please request a new one.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Mark token as verified
    await supabase
      .from('email_verification_tokens')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // Update profile to mark email as verified
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', tokenRecord.user_id);

    if (profileError) {
      console.error('Failed to update profile:', profileError);
    }

    // Confirm the user's email in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      tokenRecord.user_id,
      { email_confirm: true }
    );

    if (authError) {
      console.error('Failed to confirm user email in auth:', authError);
    }

    // Log the verification
    await supabase.from('audit_logs').insert({
      action: 'EMAIL_VERIFIED',
      table_name: 'profiles',
      record_id: tokenRecord.user_id,
      user_id: tokenRecord.user_id,
      metadata: { email: tokenRecord.email },
    });

    console.log('Email verified successfully:', { userId: tokenRecord.user_id, email: tokenRecord.email });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email verified successfully',
        userId: tokenRecord.user_id,
        email: tokenRecord.email 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Verify email token error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
