import { createClient } from "npm:@supabase/supabase-js@2";

// Email template types
export type EmailTemplate = 
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
  | 'candidate_unresponsive'
  | 'review_request'
  | 'test_email'
  | 'welcome_partner_admin'
  | 'welcome_hr_recruiter'
  | 'welcome_tech_spoc'
  | 'welcome_platform_admin'
  | 'welcome_generic';

export interface SendEmailParams {
  template: EmailTemplate;
  to: string | string[];
  cc?: string | string[];
  data: Record<string, any>;
}

export interface SendEmailResult {
  success: boolean;
  sent: boolean;
  messageId?: string;
  message?: string;
  error?: string;
}

/**
 * Get the frontend URL from environment or database config
 * Falls back to the current project's preview URL if not configured
 */
async function getFrontendUrl(): Promise<string> {
  // First check environment variable
  const envUrl = Deno.env.get('FRONTEND_URL');
  if (envUrl) return envUrl;
  
  // Try to get from database configuration
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data } = await supabase
      .from('platform_configurations')
      .select('value')
      .eq('key', 'frontend_base_url')
      .single();
    
    if (data?.value) return data.value;
  } catch (error) {
    console.warn('Could not fetch frontend_base_url from config:', error);
  }
  
  // Final fallback: derive from SUPABASE_URL (current project's preview domain)
  // Use configured frontend URL
  return Deno.env.get('FRONTEND_URL') || 'https://app.interviewtalentgeenie.com';
}

/**
 * Send an email using the unified email service
 * This function invokes the send-email edge function
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    const payload: Record<string, any> = {
      template: params.template,
      to: params.to,
      data: params.data,
    };
    
    // Only include cc if provided
    if (params.cc && (Array.isArray(params.cc) ? params.cc.length > 0 : params.cc)) {
      payload.cc = params.cc;
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error sending email:', error);
    return {
      success: false,
      sent: false,
      error: error.message
    };
  }
}

/**
 * Helper to send assessment ready notification to HR
 */
export async function sendAssessmentReadyEmail(params: {
  hrEmail: string;
  hrName?: string;
  candidateName: string;
  interviewTitle: string;
  attemptId: string;
  overallScore: number;
  recommendation: string;
  organizationName?: string;
}): Promise<SendEmailResult> {
  const frontendUrl = await getFrontendUrl();
  return sendEmail({
    template: 'assessment_ready',
    to: params.hrEmail,
    data: {
      recipient_name: params.hrName,
      candidate_name: params.candidateName,
      interview_title: params.interviewTitle,
      attempt_id: params.attemptId,
      overall_score: params.overallScore,
      recommendation: params.recommendation,
      organization_name: params.organizationName,
      report_url: `${frontendUrl}/assessment/${params.attemptId}`
    }
  });
}

/**
 * Helper to notify platform admin about new partner application
 */
export async function sendPartnerApplicationSubmittedEmail(params: {
  adminEmail: string;
  organizationName: string;
  contactEmail: string;
  industry?: string;
  companySize?: string;
  planName?: string;
}): Promise<SendEmailResult> {
  const frontendUrl = await getFrontendUrl();
  return sendEmail({
    template: 'partner_application_submitted',
    to: params.adminEmail,
    data: {
      organization_name: params.organizationName,
      contact_email: params.contactEmail,
      industry: params.industry,
      company_size: params.companySize,
      plan_name: params.planName,
      review_url: `${frontendUrl}/admin/partner-applications`
    }
  });
}

/**
 * Helper to notify partner about application approval
 */
export async function sendPartnerApprovedEmail(params: {
  applicantEmail: string;
  applicantName?: string;
  organizationName: string;
}): Promise<SendEmailResult> {
  const frontendUrl = await getFrontendUrl();
  return sendEmail({
    template: 'partner_application_approved',
    to: params.applicantEmail,
    data: {
      applicant_name: params.applicantName,
      organization_name: params.organizationName,
      dashboard_url: `${frontendUrl}/dashboard`
    }
  });
}

/**
 * Helper to notify partner about application rejection
 */
export async function sendPartnerRejectedEmail(params: {
  applicantEmail: string;
  applicantName?: string;
  organizationName: string;
  rejectionReason?: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    template: 'partner_application_rejected',
    to: params.applicantEmail,
    data: {
      applicant_name: params.applicantName,
      organization_name: params.organizationName,
      rejection_reason: params.rejectionReason
    }
  });
}

/**
 * Helper to send plan limit warning
 */
export async function sendPlanLimitWarningEmail(params: {
  adminEmail: string;
  recipientName?: string;
  organizationName: string;
  usagePercent: number;
  interviewsUsed: number;
  interviewsLimit: number;
  usersUsed?: number;
  usersLimit?: number;
}): Promise<SendEmailResult> {
  const frontendUrl = await getFrontendUrl();
  return sendEmail({
    template: 'plan_limit_warning',
    to: params.adminEmail,
    data: {
      recipient_name: params.recipientName,
      organization_name: params.organizationName,
      usage_percent: params.usagePercent,
      interviews_used: params.interviewsUsed,
      interviews_limit: params.interviewsLimit,
      users_used: params.usersUsed,
      users_limit: params.usersLimit,
      billing_url: `${frontendUrl}/billing`
    }
  });
}

/**
 * Helper to send password setup email
 */
export async function sendPasswordSetupEmail(params: {
  userEmail: string;
  userName?: string;
  organizationName?: string;
  setupUrl: string;
  expiryHours?: number;
}): Promise<SendEmailResult> {
  return sendEmail({
    template: 'password_setup',
    to: params.userEmail,
    data: {
      user_name: params.userName,
      recipient_name: params.userName || 'there',
      organization_name: params.organizationName || 'TalentGeenie',
      setup_url: params.setupUrl,
      setup_link: params.setupUrl, // Template uses setup_link
      expiry_hours: params.expiryHours || 24
    }
  });
}

/**
 * Helper to send certificate issued notification
 */
export async function sendCertificateIssuedEmail(params: {
  candidateEmail: string;
  candidateName: string;
  certificationName: string;
  certificateNumber: string;
  score: number;
  issuedDate: string;
  expiryDate: string;
  verificationCode: string;
}): Promise<SendEmailResult> {
  const frontendUrl = await getFrontendUrl();
  return sendEmail({
    template: 'certificate_issued',
    to: params.candidateEmail,
    data: {
      candidate_name: params.candidateName,
      certification_name: params.certificationName,
      certificate_number: params.certificateNumber,
      score: params.score,
      issued_date: params.issuedDate,
      expiry_date: params.expiryDate,
      verification_code: params.verificationCode,
      certificate_url: `${frontendUrl}/verify-certificate?code=${params.verificationCode}`
    }
  });
}

/**
 * Helper to send interview invitation email
 */
export async function sendInterviewInvitationEmail(params: {
  candidateEmail: string;
  candidateName?: string;
  interviewTitle: string;
  organizationName?: string;
  questionCount: number;
  timeLimit?: number;
  shareLink: string;
  ccEmails?: string[];
}): Promise<SendEmailResult> {
  return sendEmail({
    template: 'interview_invitation',
    to: params.candidateEmail,
    cc: params.ccEmails,
    data: {
      candidate_name: params.candidateName,
      interview_title: params.interviewTitle,
      organization_name: params.organizationName,
      question_count: params.questionCount,
      time_limit: params.timeLimit,
      share_link: params.shareLink,
      is_initial: true,
      is_reminder: false
    }
  });
}

/**
 * Helper to send interview reminder email (for manual resends after first invitation)
 */
export async function sendInterviewReminderEmail(params: {
  candidateEmail: string;
  candidateName?: string;
  interviewTitle: string;
  organizationName?: string;
  questionCount: number;
  timeLimit?: number;
  shareLink: string;
  ccEmails?: string[];
  reminderNumber?: number;
}): Promise<SendEmailResult> {
  return sendEmail({
    template: 'interview_reminder',
    to: params.candidateEmail,
    cc: params.ccEmails,
    data: {
      candidate_name: params.candidateName,
      interview_title: params.interviewTitle,
      organization_name: params.organizationName,
      question_count: params.questionCount,
      time_limit: params.timeLimit,
      share_link: params.shareLink,
      reminder_number: params.reminderNumber || 1
    }
  });
}

// Role to template mapping
const ROLE_WELCOME_TEMPLATES: Record<string, EmailTemplate> = {
  'platform_admin': 'welcome_platform_admin',
  'partner_admin': 'welcome_partner_admin',
  'hr_recruiter': 'welcome_hr_recruiter',
  'tech_spoc': 'welcome_tech_spoc',
};

// Role to dashboard URL mapping
const ROLE_DASHBOARD_URLS: Record<string, string> = {
  'platform_admin': '/admin',
  'partner_admin': '/dashboard',
  'hr_recruiter': '/dashboard',
  'tech_spoc': '/dashboard',
  'guest': '/dashboard',
};

/**
 * Helper to send role-specific welcome email
 * Use skipForPartnerApproval=true when role is assigned via partner approval flow
 */
export async function sendWelcomeEmail(params: {
  userEmail: string;
  userName?: string;
  role: string;
  organizationName?: string;
  skipForPartnerApproval?: boolean;
}): Promise<SendEmailResult> {
  // Skip if this is part of partner approval flow (they already get partner_application_approved email)
  if (params.skipForPartnerApproval) {
    console.log('Skipping welcome email - partner approval flow sends its own email');
    return { success: true, sent: false, message: 'Skipped - partner approval email sent instead' };
  }
  
  const frontendUrl = await getFrontendUrl();
  const template = ROLE_WELCOME_TEMPLATES[params.role] || 'welcome_generic';
  const dashboardPath = ROLE_DASHBOARD_URLS[params.role] || '/dashboard';
  
  return sendEmail({
    template,
    to: params.userEmail,
    data: {
      user_name: params.userName,
      organization_name: params.organizationName,
      dashboard_url: `${frontendUrl}${dashboardPath}`
    }
  });
}
