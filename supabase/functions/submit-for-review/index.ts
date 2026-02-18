import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize user
    // Roles: hr_recruiter submits questions for tech_spoc review
    const authHeader = req.headers.get("authorization");
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

    if (!interviewId) {
      return new Response(
        JSON.stringify({ error: "interviewId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Submitting interview ${interviewId} for review by user ${user.id}`);

    // Verify interview exists and user has access
    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select("id, title, organization_id, creator_id")
      .eq("id", interviewId)
      .single();

    if (interviewError || !interview) {
      return new Response(
        JSON.stringify({ error: "Interview not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update interview status to pending_review and optionally assign tech spoc
    const updateData: Record<string, any> = {
      questions_status: 'pending_review',
      submitted_for_review_at: new Date().toISOString(),
      submitted_for_review_by: user.id,
    };

    if (techSpocId) {
      updateData.tech_spoc_reviewer_id = techSpocId;
    }

    const { error: updateError } = await supabase
      .from("interviews")
      .update(updateData)
      .eq("id", interviewId);

    if (updateError) {
      console.error("Error updating interview status:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to submit for review" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If tech spoc assigned, notify them
    if (techSpocId) {
      try {
        await supabase.rpc('create_notification', {
          p_user_id: techSpocId,
          p_organization_id: interview.organization_id,
          p_type: 'review_requested',
          p_title: 'Review Requested',
          p_message: `You have been assigned to review questions for "${interview.title}"`,
          p_link: `/partner/recruiting/interview/${interviewId}`,
          p_metadata: { interviewId, requestedBy: user.id }
        });
      } catch (notifyErr) {
        console.error('Failed to send notification:', notifyErr);
      }
    }

    console.log(`Successfully submitted interview ${interviewId} for review`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Interview submitted for review successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in submit-for-review function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
