import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';


interface SendVerificationRequest {
  userId: string;
  email: string;
  userName?: string;
}

// Get email configuration from platform_configurations table
async function getEmailConfig(supabase: any): Promise<{ apiKey: string | null; fromAddress: string; fromName: string }> {
  const { data: configs } = await supabase
    .from('platform_configurations')
    .select('key, value')
    .in('key', ['email_provider_api_key', 'email_from_address', 'email_from_name']);

  const configMap: Record<string, string> = {};
  configs?.forEach((c: { key: string; value: string }) => {
    configMap[c.key] = c.value;
  });

  return {
    apiKey: configMap['email_provider_api_key'] || Deno.env.get('RESEND_API_KEY') || null,
    fromAddress: configMap['email_from_address'] || 'admin@talentgeenie.com',
    fromName: configMap['email_from_name'] || 'TalentGeenie',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email configuration from database first
    const emailConfig = await getEmailConfig(supabase);
    const resendApiKey = emailConfig.apiKey;

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured in database or environment');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Using email config from database, API key present:', !!resendApiKey);

    const { userId, email, userName }: SendVerificationRequest = await req.json();

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: 'userId and email are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Generate verification token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    
    // Get verification link expiry (default 24 hours)
    const { data: expiryConfig } = await supabase
      .from('platform_configurations')
      .select('value')
      .eq('key', 'email_verification_expiry_hours')
      .single();
    
    const expiryHours = parseInt(expiryConfig?.value || '24', 10);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Invalidate any existing tokens for this user
    await supabase
      .from('email_verification_tokens')
      .update({ verified_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('verified_at', null);

    // Create new verification token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        email: email,
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('Failed to create verification token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create verification token' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get frontend URL
    const { data: frontendConfig } = await supabase
      .from('platform_configurations')
      .select('value')
      .eq('key', 'frontend_base_url')
      .single();
    
    const frontendUrl = frontendConfig?.value || Deno.env.get('FRONTEND_URL') || 'https://interviewai.talentgeenie.com';
    const verifyUrl = `${frontendUrl}/auth/verify-email?token=${token}`;

    const fromAddress = emailConfig.fromAddress;
    const fromName = emailConfig.fromName;

    // Get email template
    const { data: template } = await supabase
      .from('email_templates')
      .select('subject, html_content')
      .eq('template_key', 'auth_email_verification')
      .is('organization_id', null)
      .eq('is_active', true)
      .single();

    const displayName = userName || email.split('@')[0];
    
    // Template variables
    const templateData: Record<string, string> = {
      platform_name: fromName,
      user_name: displayName,
      verify_url: verifyUrl,
      confirmation_url: verifyUrl, // Also support {{confirmation_url}} placeholder
      user_email: email,
      current_year: new Date().getFullYear().toString(),
      expiry_hours: expiryHours.toString(),
    };

    // Replace template variables
    let subject = template?.subject || `Welcome to ${fromName} - Verify Your Email`;
    let htmlContent = template?.html_content || getDefaultTemplate(templateData);

    for (const [key, value] of Object.entries(templateData)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(regex, value);
      htmlContent = htmlContent.replace(regex, value);
    }

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [email],
        subject,
        html: htmlContent,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResult);
      return new Response(
        JSON.stringify({ error: resendResult.message || 'Failed to send email' }),
        { status: resendResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Log the email
    await supabase.from('email_logs').insert({
      template_key: 'auth_email_verification',
      recipient_email: email,
      subject,
      status: 'sent',
      provider: 'resend',
      metadata: { userId, messageId: resendResult.id },
    });

    console.log('Verification email sent:', { email, messageId: resendResult.id });

    return new Response(
      JSON.stringify({ success: true, messageId: resendResult.id }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Send verification email error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

function getDefaultTemplate(data: Record<string, string>): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">${data.platform_name}</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Verify Your Email Address</h2>
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Hi ${data.user_name},
                  </p>
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    Thanks for signing up for ${data.platform_name}! Please verify your email address by clicking the button below.
                  </p>
                  
                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 10px 0 30px;">
                        <a href="${data.verify_url}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                          Verify Email Address
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
                    This link will expire in ${data.expiry_hours} hours.
                  </p>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                    If you didn't create an account, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px 40px; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${data.current_year} ${data.platform_name}. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
