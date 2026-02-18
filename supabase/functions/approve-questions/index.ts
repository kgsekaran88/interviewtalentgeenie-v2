import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { sendEmail } from "../_shared/email-helper.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize user
    // Roles: tech_spoc reviews/approves, partner_admin has full access, hr_recruiter can self-approve
    const authHeader = req.headers.get("Authorization");
    const { user, supabase, error: authError } = await authenticateRequest(
      authHeader,
      ['partner_admin', 'hr_recruiter', 'tech_spoc']
    );

    if (authError || !user) {
      console.error('Authorization failed:', authError);
      return new Response(
        JSON.stringify({ error: authError || "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { interviewId, action, notes } = await req.json();

    if (!interviewId || !action) {
      return new Response(JSON.stringify({ error: "Missing interviewId or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!['approve', 'request_changes'].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action. Must be 'approve' or 'request_changes'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get interview details with organization
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('*, creator:profiles!interviews_creator_id_fkey(id, email, full_name), organization:organizations(id, name)')
      .eq('id', interviewId)
      .single();

    if (interviewError || !interview) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get reviewer details
    const { data: reviewer } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // Update interview based on action
    const updateData: Record<string, any> = {
      review_notes: notes || null,
      tech_spoc_reviewer_id: user.id,
      last_reviewed_by: user.id,
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (action === 'approve') {
      updateData.questions_status = 'approved';
      updateData.questions_approved_at = new Date().toISOString();
      updateData.review_feedback = null; // Clear any previous feedback
    } else {
      updateData.questions_status = 'needs_changes'; // New status for rejection
      updateData.review_feedback = notes || 'Changes requested by reviewer';
    }

    const { error: updateError } = await supabase
      .from('interviews')
      .update(updateData)
      .eq('id', interviewId);

    if (updateError) {
      console.error('Error updating interview:', updateError);
      throw new Error('Failed to update interview status');
    }

    // Notify the interview creator (if not self-approving)
    let emailSent = false;
    if (interview.creator_id !== user.id && interview.creator) {
      const notificationMessage = action === 'approve'
        ? `${reviewer?.full_name || 'Tech SPOC'} has approved questions for "${interview.title}"`
        : `${reviewer?.full_name || 'Tech SPOC'} has requested changes to questions for "${interview.title}"`;

      // Create in-app notification
      try {
        await supabase.rpc('create_notification', {
          p_user_id: interview.creator_id,
          p_organization_id: interview.organization_id,
          p_type: action === 'approve' ? 'questions_approved' : 'changes_requested',
          p_title: action === 'approve' ? 'Questions Approved' : 'Changes Requested',
          p_message: notificationMessage,
          p_link: `/partner/recruiting/interview/${interviewId}`,
          p_metadata: { 
            interviewId, 
            reviewerId: user.id,
            action,
            notes: notes || null
          }
        });
      } catch (notifyErr) {
        console.error('Failed to send notification:', notifyErr);
      }

      // Send email notification
      try {
        const { data: frontendConfig } = await supabase
          .from('platform_configurations')
          .select('value')
          .eq('key', 'frontend_base_url')
          .single();

        const frontendUrl = frontendConfig?.value || Deno.env.get('FRONTEND_URL') || 'https://app.interviewtalentgeenie.com';
        const interviewUrl = `${frontendUrl}/partner/recruiting/interview/${interviewId}`;

        const emailTemplate = action === 'approve' ? 'questions_approved' : 'changes_requested';
        
        const emailResult = await sendEmail({
          template: emailTemplate as any,
          to: interview.creator.email,
          data: {
            recipientName: interview.creator.full_name || 'Team Member',
            reviewerName: reviewer?.full_name || 'Tech SPOC',
            interviewTitle: interview.title,
            organizationName: interview.organization?.name || '',
            reviewNotes: notes || '',
            interviewUrl
          }
        });

        emailSent = emailResult.sent;
        console.log(`Email notification sent: ${emailSent} (template: ${emailTemplate})`);
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: action === 'approve' ? 'QUESTIONS_APPROVED' : 'CHANGES_REQUESTED',
      table_name: 'interviews',
      record_id: interviewId,
      user_id: user.id,
      metadata: {
        previous_status: interview.questions_status,
        new_status: updateData.questions_status,
        notes: notes || null,
        email_sent: emailSent
      }
    });

    return new Response(JSON.stringify({
      success: true,
      message: action === 'approve' 
        ? 'Questions approved successfully'
        : 'Changes requested. HR has been notified.',
      newStatus: updateData.questions_status,
      emailSent
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error in approve-questions:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
