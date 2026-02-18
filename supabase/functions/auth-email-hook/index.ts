import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthEmailPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change';
    site_url: string;
  };
}

interface EmailTemplate {
  subject: string;
  html_content: string;
}

// Map Supabase auth action types to our template keys
const templateKeyMap: Record<string, string> = {
  'signup': 'auth_email_verification',
  'recovery': 'auth_password_recovery',
  'invite': 'auth_invite',
  'magiclink': 'auth_magic_link',
  'email_change': 'auth_email_change',
};

// Replace template variables with actual data
function replaceVariables(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

// Get email configuration from platform_configurations
async function getEmailConfig(supabase: any): Promise<{ fromAddress: string; fromName: string }> {
  const { data: configs } = await supabase
    .from('platform_configurations')
    .select('key, value')
    .in('key', ['email_from_address', 'email_from_name']);

  const configMap: Record<string, string> = {};
  configs?.forEach((c: any) => {
    configMap[c.key] = c.value;
  });

  return {
    fromAddress: configMap['email_from_address'] || 'admin@talentgeenie.com',
    fromName: configMap['email_from_name'] || 'TalentGeenie',
  };
}

// Fetch template from database
async function getTemplate(supabase: any, templateKey: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('subject, html_content')
    .eq('template_key', templateKey)
    .is('organization_id', null)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error(`Error fetching template ${templateKey}:`, error);
    return null;
  }

  return data;
}

// Fallback templates in case database templates are not found
function getFallbackTemplate(actionType: string, data: Record<string, string>): EmailTemplate {
  const templates: Record<string, EmailTemplate> = {
    'signup': {
      subject: `Welcome to ${data.platform_name} - Verify Your Email`,
      html_content: `<p>Hi ${data.user_name},</p><p>Please verify your email by clicking <a href="${data.verify_url}">here</a>.</p>`,
    },
    'recovery': {
      subject: `Reset Your ${data.platform_name} Password`,
      html_content: `<p>Hi ${data.user_name},</p><p>Reset your password by clicking <a href="${data.verify_url}">here</a>.</p>`,
    },
    'invite': {
      subject: `You've Been Invited to ${data.platform_name}`,
      html_content: `<p>Hi ${data.user_name},</p><p>Accept your invitation by clicking <a href="${data.verify_url}">here</a>.</p>`,
    },
    'magiclink': {
      subject: `Your ${data.platform_name} Login Link`,
      html_content: `<p>Hi ${data.user_name},</p><p>Log in by clicking <a href="${data.verify_url}">here</a>. Code: ${data.otp_code}</p>`,
    },
    'email_change': {
      subject: `Confirm Your New Email - ${data.platform_name}`,
      html_content: `<p>Hi ${data.user_name},</p><p>Confirm your new email by clicking <a href="${data.verify_url}">here</a>.</p>`,
    },
  };

  return templates[actionType] || templates['signup'];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: { message: 'Email service not configured' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: AuthEmailPayload = await req.json();
    
    console.log('Auth email hook triggered:', {
      email: payload.user?.email,
      action_type: payload.email_data?.email_action_type,
    });

    const { user, email_data } = payload;
    const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
    
    // Build verification URL
    const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${email_data.redirect_to || email_data.site_url}`;

    // Get email configuration
    const emailConfig = await getEmailConfig(supabase);

    // Prepare template data
    const templateData: Record<string, string> = {
      platform_name: emailConfig.fromName,
      user_name: userName,
      verify_url: verifyUrl,
      otp_code: email_data.token || '',
      current_year: new Date().getFullYear().toString(),
    };

    // Get template key for this action type
    const templateKey = templateKeyMap[email_data.email_action_type];
    if (!templateKey) {
      console.log('Unknown email action type:', email_data.email_action_type);
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch template from database
    let template = await getTemplate(supabase, templateKey);
    
    // Use fallback if template not found
    if (!template) {
      console.log(`Template ${templateKey} not found in database, using fallback`);
      template = getFallbackTemplate(email_data.email_action_type, templateData);
    }

    // Replace variables in template
    const subject = replaceVariables(template.subject, templateData);
    const html = replaceVariables(template.html_content, templateData);

    // Send the email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${emailConfig.fromName} <${emailConfig.fromAddress}>`,
        to: [user.email],
        subject,
        html,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResult);
      return new Response(
        JSON.stringify({ error: { http_code: resendResponse.status, message: resendResult.message } }),
        { status: resendResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auth email sent successfully:', { 
      email: user.email, 
      template: templateKey,
      messageId: resendResult.id 
    });

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Auth email hook error:', error);
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: errorMessage } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
