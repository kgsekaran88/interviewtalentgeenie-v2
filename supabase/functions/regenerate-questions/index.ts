import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = ['partner_admin', 'hr_recruiter', 'tech_spoc'];

serve(async (req) => {
  const logger = createLogger('regenerate-questions');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize
    const authHeader = req.headers.get("authorization");
    const authResult = await authenticateRequest(authHeader, ALLOWED_ROLES);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authHeader ? 403 : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user, supabase } = authResult;
    const { interviewId } = await req.json();

    logger.info('Regenerating questions for interview', { interviewId, userId: user.id });

    // Get interview details
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('*, experience_level, min_years_experience, questions_status')
      .eq('id', interviewId)
      .single();

    if (fetchError || !interview) {
      logger.error('Interview fetch error', fetchError);
      return new Response(
        JSON.stringify({ error: "Interview not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info('Found interview', { id: interview.id, questions_status: interview.questions_status });

    // Block regeneration if questions are approved or pending review (unless forceRegenerate is true)
    const body = await req.clone().json();
    // Allow regeneration for 'needs_changes' status (Tech SPOC requested changes)
    if ((interview.questions_status === 'approved' || interview.questions_status === 'pending_review') && !body.forceRegenerate) {
      logger.warn('Blocked regeneration - questions already in review/approved status', { 
        interviewId, 
        questions_status: interview.questions_status 
      });
      return new Response(
        JSON.stringify({ 
          error: `Cannot regenerate questions. Questions are ${interview.questions_status === 'approved' ? 'already approved' : 'pending review'}. Use the question bank editor to make changes.`,
          code: 'QUESTIONS_LOCKED',
          questions_status: interview.questions_status
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use transactional database function for atomic cleanup
    const { data: txResult, error: txError } = await supabase.rpc('prepare_question_regeneration_tx', {
      p_interview_id: interviewId
    });

    if (txError) {
      logger.error('Transaction error', txError);
      throw new Error(txError.message || 'Failed to prepare question regeneration');
    }

    logger.info('Question regeneration prepared', { txResult });

    // Create a service role client for internal function calls
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Invoke the generate-questions function using service role (server-to-server)
    const { data: generateData, error: generateError } = await supabaseServiceClient.functions.invoke('generate-questions', {
      body: {
        interviewId: interview.id,
        jobDescription: interview.job_description,
        topics: interview.topic_distribution || {},
        questionCount: interview.question_count,
        questionTypeDistribution: interview.question_type_distribution || {
          mcq: 40,
          scenario: 30,
          coding: 20,
          descriptive: 10
        },
        difficultyDistribution: interview.difficulty_distribution || { easy: 30, medium: 50, hard: 20 },
        categoryDifficultyDistribution: interview.category_difficulty_distribution || null,
        questionBankSize: interview.question_bank_size,
        previewMode: false,
        codingSchema: interview.coding_schema || null,
        requiredQuestionRules: interview.required_question_rules || null,
        experienceLevel: interview.experience_level || null,
        minYearsExperience: interview.min_years_experience || null,
        // Internal flag to bypass auth check
        _internalCall: true,
        _callerUserId: user.id
      }
    });

    if (generateError) {
      logger.error('Error generating questions', generateError);
      throw new Error(generateError.message || 'Failed to generate new questions');
    }

    logger.info('Question generation triggered successfully');
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Questions are being regenerated. This may take a few moments.',
      data: generateData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    const logger = createLogger('regenerate-questions');
    logger.error('Error in regenerate-questions', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
