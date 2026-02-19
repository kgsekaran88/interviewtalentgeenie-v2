import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

// Inline email sanitization utilities to avoid cross-file bundling issues
const INVALID_TRAILING_CHARS = /[,;|:'"()[\]{}]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeEmail(email: string): string {
  if (!email) return '';
  let sanitized = email.trim();
  while (INVALID_TRAILING_CHARS.test(sanitized)) {
    sanitized = sanitized.replace(INVALID_TRAILING_CHARS, '').trim();
  }
  sanitized = sanitized.replace(/^[,;|:'"()[\]{}]+/, '').trim();
  return sanitized;
}

function isValidEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email.trim());
}

function sanitizeEmailList(emails: string[]): string[] {
  return emails.map(email => sanitizeEmail(email)).filter(email => isValidEmail(email));
}


// Email template types
type EmailTemplate = 
  | 'assessment_ready'
  | 'partner_application_submitted'
  | 'partner_application_approved'
  | 'partner_application_rejected'
  | 'subscription_reminder'
  | 'plan_limit_warning'
  | 'password_reset'
  | 'password_setup'
  | 'certificate_issued'
  | 'interview_invitation'
  | 'interview_reminder'
  | 'review_request'
  | 'test_email'
  | 'welcome_partner_admin'
  | 'welcome_hr_recruiter'
  | 'welcome_tech_spoc'
  | 'welcome_platform_admin'
  | 'welcome_generic';

interface EmailRequest {
  template: EmailTemplate;
  to: string | string[];
  cc?: string | string[];
  data: Record<string, any>;
  organization_id?: string; // Optional: for org-specific template overrides
}

interface EmailConfig {
  apiKey: string | null;
  fromAddress: string;
  fromName: string;
  enabled: boolean;
}

interface DbTemplate {
  subject: string;
  html_content: string;
}

// Get email configuration from platform_configurations table
// When skipFallback is true, don't use env var fallback (used for testing configuration)
async function getEmailConfig(supabase: any, skipFallback: boolean = false): Promise<EmailConfig> {
  const { data: configs } = await supabase
    .from('platform_configurations')
    .select('key, value')
    .in('key', [
      'email_provider_api_key',
      'email_from_address', 
      'email_from_name',
      'email_enabled'
    ]);

  const configMap: Record<string, string> = {};
  configs?.forEach((c: any) => {
    configMap[c.key] = c.value;
  });

  return {
    // Only use env fallback if skipFallback is false
    apiKey: configMap['email_provider_api_key'] || (skipFallback ? null : Deno.env.get('RESEND_API_KEY')) || null,
    fromAddress: configMap['email_from_address'] || (skipFallback ? '' : 'noreply@talentgeenie.com'),
    fromName: configMap['email_from_name'] || 'TalentGeenie',
    enabled: configMap['email_enabled'] !== 'false'
  };
}

// Get frontend base URL from configuration
async function getFrontendUrl(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('platform_configurations')
    .select('value')
    .eq('key', 'frontend_base_url')
    .single();

  return data?.value || Deno.env.get('FRONTEND_URL') || 'https://app.interviewtalentgeenie.com';
}

// Fetch template from database with org override support
async function getTemplateFromDb(
  supabase: any, 
  templateKey: string, 
  organizationId?: string
): Promise<DbTemplate | null> {
  console.log(`Fetching template: ${templateKey}, orgId: ${organizationId || 'none'}`);
  
  // Try org-specific template first if organizationId provided
  if (organizationId) {
    const { data: orgTemplate, error: orgError } = await supabase
      .from('email_templates')
      .select('subject, html_content')
      .eq('template_key', templateKey)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single();

    if (orgTemplate && !orgError) {
      console.log(`Found org-specific template for ${templateKey}`);
      return orgTemplate;
    }
  }

  // Fall back to platform-wide template
  const { data: platformTemplate, error } = await supabase
    .from('email_templates')
    .select('subject, html_content')
    .eq('template_key', templateKey)
    .is('organization_id', null)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error(`Error fetching platform template for ${templateKey}:`, error);
    return null;
  }

  console.log(`Found platform template for ${templateKey}`);
  return platformTemplate;
}

// Replace template variables with actual data
// Supports: {{variable}}, {{#if variable}}...{{/if}}, {{#if variable}}...{{else}}...{{/if}}
// Uses iterative processing to handle nested conditionals correctly
function replaceVariables(template: string, data: Record<string, any>): string {
  let result = template;

  // Process conditionals iteratively until no more matches
  // This handles nested conditionals correctly by processing innermost first
  let maxIterations = 50; // Safety limit to prevent infinite loops
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    let changed = false;
    
    // Handle conditional blocks with else: {{#if variable}}...{{else}}...{{/if}}
    // Use a non-greedy match that finds the INNERMOST if-else-endif block
    const ifElseRegex = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{else\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;
    const newResultIfElse = result.replace(ifElseRegex, (match, variable, ifContent, elseContent) => {
      changed = true;
      const value = data[variable];
      const isTruthy = value !== undefined && value !== null && value !== '' && value !== false;
      return isTruthy ? ifContent : elseContent;
    });
    
    if (newResultIfElse !== result) {
      result = newResultIfElse;
      continue; // Process again in case there are more nested blocks
    }

    // Handle simple conditional blocks without else: {{#if variable}}...{{/if}}
    // Use a non-greedy match that finds the INNERMOST if-endif block
    const ifOnlyRegex = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;
    const newResultIfOnly = result.replace(ifOnlyRegex, (match, variable, content) => {
      changed = true;
      const value = data[variable];
      const isTruthy = value !== undefined && value !== null && value !== '' && value !== false;
      return isTruthy ? content : '';
    });
    
    if (newResultIfOnly !== result) {
      result = newResultIfOnly;
      continue; // Process again in case there are more nested blocks
    }
    
    // No more changes, exit loop
    if (!changed) break;
  }

  // Replace all {{variable}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return ''; // Remove unreplaced placeholders to avoid showing {{variable}} in emails
  });
  
  // Final cleanup: remove any orphaned {{/if}}, {{else}}, or {{#if ...}} tags
  // This handles edge cases where template syntax might be malformed
  result = result.replace(/\{\{\/if\}\}/g, '');
  result = result.replace(/\{\{else\}\}/g, '');
  result = result.replace(/\{\{#if\s+\w+\}\}/g, '');

  return result;
}

// Fallback templates (used if database template not found)
function getFallbackTemplate(template: EmailTemplate, data: Record<string, any>, frontendUrl: string, fromName: string): { subject: string; html: string } {
  // Simple fallback for critical templates
  const fallbacks: Record<string, () => { subject: string; html: string }> = {
    test_email: () => ({
      subject: `Test Email from ${fromName}`,
      html: `<html><body><h1>Test Email</h1><p>This is a test email from ${fromName}. Sent at ${data.sent_at || new Date().toISOString()}.</p></body></html>`
    }),
    interview_invitation: () => ({
      subject: `Interview Invitation: ${data.interview_title || 'Assessment'}`,
      html: `<html><body>
        <h1>Interview Invitation</h1>
        <p>Hi ${data.candidate_name || 'there'},</p>
        <p>You have been invited to complete an interview assessment for <strong>${data.interview_title || 'the position'}</strong>.</p>
        <p><a href="${data.share_link}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Interview Now</a></p>
      </body></html>`
    }),
    interview_reminder: () => ({
      subject: `Reminder ${data.reminder_number || 1}: Interview Invitation - ${data.interview_title || 'Assessment'}`,
      html: `<html><body>
        <h1>Friendly Reminder</h1>
        <p>Hi ${data.candidate_name || 'there'},</p>
        <p><strong>Reminder ${data.reminder_number || 1} of 3:</strong> You have a pending interview invitation.</p>
        <p>This is a reminder that you have been invited to complete an interview assessment for <strong>${data.interview_title || 'the position'}</strong>.</p>
        <p><a href="${data.share_link}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Interview Now</a></p>
      </body></html>`
    }),
    password_setup: () => ({
      subject: `Complete Your Account Setup - ${fromName}`,
      html: `<html><body>
        <h1>Welcome to ${fromName}</h1>
        <p>Hi ${data.user_name || 'there'},</p>
        <p>Please set up your password by clicking the link below.</p>
        <p><a href="${data.setup_url}">Set Up Password</a></p>
        <p>This link will expire in ${data.expiry_hours || 24} hours.</p>
      </body></html>`
    }),
  };

  const fallbackFn = fallbacks[template];
  if (fallbackFn) {
    return fallbackFn();
  }

  // Generic fallback
  return {
    subject: `Notification from ${fromName}`,
    html: `<html><body><h1>Notification</h1><p>You have a new notification from ${fromName}.</p></body></html>`
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { template, to, cc, data, organization_id }: EmailRequest = await req.json();
    
    console.log(`Processing email request: template=${template}, to=${Array.isArray(to) ? to.join(', ') : to}`);
    
    // For test emails, skip fallback to only test the actual configuration
    const isTestEmail = template === 'test_email';
    
    // Get email configuration (skip fallback for test emails)
    const emailConfig = await getEmailConfig(supabase, isTestEmail);
    const frontendUrl = await getFrontendUrl(supabase);
    
    if (!emailConfig.enabled) {
      console.log('Email sending is disabled');
      return new Response(
        JSON.stringify({ 
          success: true, 
          sent: false,
          message: 'Email sending is disabled' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!emailConfig.apiKey) {
      console.log('No email API key configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          sent: false,
          error: 'Email API key not configured' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Prepare data with common variables
    const templateData = {
      ...data,
      platform_name: emailConfig.fromName,
      frontend_url: frontendUrl,
    };

    // Get template from database
    const dbTemplate = await getTemplateFromDb(supabase, template, organization_id);
    
    let subject: string;
    let html: string;

    if (dbTemplate) {
      // Use database template
      subject = replaceVariables(dbTemplate.subject, templateData);
      html = replaceVariables(dbTemplate.html_content, templateData);
      console.log(`Using database template for ${template}`);
    } else {
      // Use fallback template
      console.log(`No database template found for ${template}, using fallback`);
      const fallback = getFallbackTemplate(template, templateData, frontendUrl, emailConfig.fromName);
      subject = fallback.subject;
      html = fallback.html;
    }

    // Send email via Resend
    // CRITICAL: Sanitize all email addresses to prevent delivery failures from trailing special characters
    const rawRecipients = Array.isArray(to) ? to : [to];
    const rawCcRecipients = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    
    // Sanitize and validate recipients
    const recipients: string[] = [];
    const invalidRecipients: string[] = [];
    for (const email of rawRecipients) {
      const sanitized = sanitizeEmail(email);
      if (isValidEmail(sanitized)) {
        recipients.push(sanitized);
        if (email !== sanitized) {
          console.warn(`[send-email] Sanitized recipient email: "${email}" -> "${sanitized}"`);
        }
      } else {
        console.error(`[send-email] Invalid recipient email after sanitization: "${email}" -> "${sanitized}"`);
        invalidRecipients.push(email);
      }
    }
    
    // Sanitize CC recipients
    const ccRecipients = sanitizeEmailList(rawCcRecipients);
    if (rawCcRecipients.length !== ccRecipients.length) {
      console.warn(`[send-email] Filtered ${rawCcRecipients.length - ccRecipients.length} invalid CC emails`);
    }
    
    // If no valid recipients after sanitization, return error
    if (recipients.length === 0) {
      console.error('[send-email] No valid recipients after sanitization');
      return new Response(
        JSON.stringify({ 
          success: false, 
          sent: false,
          error: `Invalid email address(es): ${invalidRecipients.join(', ')}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    console.log(`Sending email to ${recipients.length} recipient(s)${ccRecipients.length > 0 ? ` with ${ccRecipients.length} CC` : ''} with subject: ${subject}`);
    
    // Log each email attempt to email_logs
    const logEmails = async (sent: boolean, messageId?: string, errorMessage?: string, provider: string = 'resend') => {
      for (const recipient of recipients) {
        await supabase.from('email_logs').insert({
          template,
          recipient_email: recipient,
          recipient_name: data.recipient_name || data.candidate_name || data.user_name,
          subject,
          sent,
          sent_at: sent ? new Date().toISOString() : null,
          error_message: errorMessage,
          message_id: messageId,
          metadata: { 
            ...data,
            cc_recipients: ccRecipients.length > 0 ? ccRecipients : undefined
          },
          organization_id: organization_id || null,
          user_id: data.user_id || null,
          provider: provider
        });
      }
    };
    
    // Build Resend payload
    const resendPayload: Record<string, any> = {
      from: `${emailConfig.fromName} <${emailConfig.fromAddress}>`,
      to: recipients,
      subject: subject,
      html: html,
    };
    
    // Add CC if provided
    if (ccRecipients.length > 0) {
      resendPayload.cc = ccRecipients;
    }
    
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    const resendResult = await resendResponse.json();
    
    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResult);
      
      // Log failed attempt to email_logs with provider
      await logEmails(false, undefined, resendResult.message || 'Unknown error', 'resend');
      
      // Also log to audit_logs for backward compatibility
      await supabase.from('audit_logs').insert({
        action: 'email_send_failed',
        table_name: 'email_templates',
        metadata: {
          template,
          to: recipients,
          error: resendResult.message || 'Unknown error',
          organization_id,
        }
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          sent: false,
          error: resendResult.message || 'Failed to send email' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    console.log('Email sent successfully:', resendResult);
    
    // Log successful send to email_logs with provider
    await logEmails(true, resendResult.id, undefined, 'resend');
    
    // Also log to audit_logs for backward compatibility
    await supabase.from('audit_logs').insert({
      action: 'email_sent',
      table_name: 'email_templates',
      metadata: {
        template,
        to: recipients,
        message_id: resendResult.id,
        organization_id,
      }
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: true,
        messageId: resendResult.id,
        message: 'Email sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-email function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        sent: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
