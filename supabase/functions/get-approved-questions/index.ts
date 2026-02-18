import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const logger = createLogger('get-approved-questions');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Fetching approved questions');
    
    const authHeader = req.headers.get("authorization");
    // Roles: partner_admin, hr_recruiter, tech_spoc can view approved questions
    const authResult = await authenticateRequest(authHeader, ['partner_admin', 'hr_recruiter', 'tech_spoc']);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.error.includes('required') ? 401 : 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user, supabase } = authResult;
    logger.info('User authenticated for fetching questions', { userId: user.id });

    const { 
      topic, 
      difficulty, 
      questionType, 
      limit = 50,
      organizationId 
    } = await req.json();

    logger.info('Fetching approved questions with filters', { topic, difficulty, questionType, organizationId });

    let query = supabase
      .from("question_repository")
      .select("id, question_text, question_type, topic, difficulty, options, correct_answer, explanation, tags, created_at")
      .eq("is_approved", true);

    // Apply filters
    if (topic) {
      query = query.eq("topic", topic);
    }
    if (difficulty) {
      query = query.eq("difficulty", difficulty);
    }
    if (questionType) {
      query = query.eq("question_type", questionType);
    }
    if (organizationId) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      query = query.is("organization_id", null); // Only global questions
    }

    const { data: questions, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching approved questions', error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch questions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info('Successfully fetched approved questions', { count: questions?.length || 0 });

    return new Response(
      JSON.stringify({ questions: questions || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const logger = createLogger('get-approved-questions');
    logger.error('Fatal error in get-approved-questions', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
