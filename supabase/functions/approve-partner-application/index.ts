import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendPartnerApprovedEmail } from '../_shared/email-helper.ts';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Approve Partner Application
 * Uses transactional database function for atomicity
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse(
      {
        error: 'Server is missing required configuration for approval.',
        code: 'MISSING_ENV',
        details: 'Required environment variables are not set.',
      },
      500,
    );
  }

  try {
    let payload: any = null;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body', code: 'BAD_JSON' }, 400);
    }

    const applicationId = payload?.applicationId;
    if (!applicationId) {
      return jsonResponse({ error: 'Application ID is required', code: 'MISSING_APPLICATION_ID' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authentication required', code: 'NO_AUTH' }, 401);
    }

    // Client 1: User authentication client (to verify user identity)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user from JWT using the auth client
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      console.error('Auth error:', userErr);
      return jsonResponse({ error: 'Invalid authentication', code: 'INVALID_AUTH' }, 401);
    }

    // Client 2: Service role client (bypasses RLS for privileged operations)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Enforce RBAC: only platform admins can approve
    const { data: roleRows, error: roleErr } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin')
      .limit(1);

    if (roleErr) {
      console.error('Role check error:', roleErr);
      return jsonResponse(
        {
          error: 'Failed to validate permissions.',
          code: roleErr.code || 'ROLE_CHECK_FAILED',
          details: roleErr.details || roleErr.message,
          hint: roleErr.hint,
        },
        500,
      );
    }

    if (!roleRows || roleRows.length === 0) {
      return jsonResponse({ error: 'Access denied', code: 'FORBIDDEN' }, 403);
    }

    console.log('Approving application:', applicationId, 'by:', user.id);

    // Call the transactional database function
    const { data, error } = await supabase.rpc('approve_partner_application_tx', {
      p_application_id: applicationId,
      p_reviewer_id: user.id,
    });

    if (error) {
      console.error('Transaction error:', error);
      return jsonResponse(
        {
          error: error.message || 'Approval transaction failed',
          code: error.code || 'TX_FAILED',
          details: error.details,
          hint: error.hint,
        },
        500,
      );
    }

    if (!data?.success) {
      return jsonResponse(
        { error: 'Approval transaction returned no success flag', code: 'TX_NO_SUCCESS', details: JSON.stringify(data) },
        500,
      );
    }

    // Send approval email (after successful transaction)
    try {
      const emailResult = await sendPartnerApprovedEmail({
        applicantEmail: data.applicant_email,
        applicantName: data.applicant_name || 'Partner',
        organizationName: data.organization_name,
      });
      console.log('Partner approval email sent:', emailResult.sent);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the approval if email fails - transaction already committed
    }

    return jsonResponse({
      success: true,
      organizationName: data.organization_name,
      organizationId: data.organization_id,
    });
  } catch (error: any) {
    console.error('Error in approve-partner-application:', error);
    return jsonResponse(
      {
        error: error?.message || 'Failed to approve application',
        code: 'UNHANDLED',
      },
      500,
    );
  }
});

