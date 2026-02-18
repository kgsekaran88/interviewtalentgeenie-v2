import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize user
    // Roles: tech_spoc and partner_admin can bulk approve questions
    const authHeader = req.headers.get("authorization");
    const { user, supabase, error: authError } = await authenticateRequest(
      authHeader,
      ['partner_admin', 'tech_spoc']
    );

    if (authError || !user) {
      console.error('Authorization failed:', authError);
      return new Response(
        JSON.stringify({ error: authError || "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { questionIds } = await req.json();

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "questionIds array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Bulk approving ${questionIds.length} questions by user ${user.id}`);

    // Update all questions to approved
    const { data: updatedQuestions, error: updateError } = await supabase
      .from("question_repository")
      .update({ is_approved: true })
      .in("id", questionIds)
      .select("id, question_text, topic");

    if (updateError) {
      console.error("Error bulk approving questions:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to approve questions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the approval in question_review_workflow
    const reviewRecords = questionIds.map((questionId) => ({
      question_id: questionId,
      reviewer_id: user.id,
      action: "approved",
      comment: "Bulk approved by Tech SPOC",
    }));

    const { error: reviewError } = await supabase
      .from("question_review_workflow")
      .insert(reviewRecords);

    if (reviewError) {
      console.error("Error logging review workflow:", reviewError);
      // Don't fail the request if logging fails
    }

    console.log(`Successfully approved ${updatedQuestions?.length || 0} questions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        approved: updatedQuestions?.length || 0,
        questions: updatedQuestions 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in bulk-approve-questions function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
