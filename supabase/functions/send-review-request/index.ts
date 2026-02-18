import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize user
    // Roles: hr_recruiter sends review requests to tech_spoc
    const authHeader = req.headers.get("Authorization");
    const { user, supabase, error: authError } = await authenticateRequest(
      authHeader,
      ['partner_admin', 'hr_recruiter']
    );

    if (authError || !user) {
      console.error('Authorization failed:', authError);
      return new Response(
        JSON.stringify({ error: authError || "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { interviewId, techSpocId } = await req.json();

    if (!interviewId || !techSpocId) {
      return new Response(JSON.stringify({ error: "Missing interviewId or techSpocId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get interview details
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('*, organization:organizations(id, name)')
      .eq('id', interviewId)
      .single();

    if (interviewError || !interview) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tech spoc details
    const { data: techSpoc, error: techSpocError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', techSpocId)
      .single();

    if (techSpocError || !techSpoc) {
      return new Response(JSON.stringify({ error: "Tech SPOC not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get requester details
    const { data: requester } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // Update interview with review status
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        questions_status: 'pending_review',
        tech_spoc_reviewer_id: techSpocId,
        review_requested_at: new Date().toISOString(),
      })
      .eq('id', interviewId);

    if (updateError) {
      console.error('Error updating interview:', updateError);
      throw new Error('Failed to update interview status');
    }

    // Create notification for tech spoc
    await supabase.rpc('create_notification', {
      p_user_id: techSpocId,
      p_organization_id: interview.organization_id,
      p_type: 'review_request',
      p_title: 'Questions Review Requested',
      p_message: `${requester?.full_name || user.email} has requested you to review questions for "${interview.title}"`,
      p_link: `/partner/recruiting/interview/${interviewId}/preview`,
      p_metadata: { interviewId, requesterId: user.id }
    });

    // Try to send email notification using unified email service
    let emailSent = false;
    try {
      const { sendEmail } = await import('../_shared/email-helper.ts');
      
      const { data: frontendConfig } = await supabase
        .from('platform_configurations')
        .select('value')
        .eq('key', 'frontend_base_url')
        .single();

      const frontendUrl = frontendConfig?.value || Deno.env.get('FRONTEND_URL') || 'https://app.interviewtalentgeenie.com';
      const reviewUrl = `${frontendUrl}/partner/recruiting/interview/${interviewId}/preview`;

      const emailResult = await sendEmail({
        template: 'review_request' as any,
        to: techSpoc.email,
        data: {
          recipientName: techSpoc.full_name,
          requesterName: requester?.full_name || 'A team member',
          interviewTitle: interview.title,
          organizationName: interview.organization?.name || 'N/A',
          reviewUrl
        }
      });

      emailSent = emailResult.sent;
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'REVIEW_REQUEST_SENT',
      table_name: 'interviews',
      record_id: interviewId,
      user_id: user.id,
      metadata: {
        tech_spoc_id: techSpocId,
        email_sent: emailSent,
      }
    });

    return new Response(JSON.stringify({
      success: true,
      message: emailSent 
        ? 'Review request sent and tech SPOC notified via email'
        : 'Review request sent (email service not configured)',
      emailSent
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error in send-review-request:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
