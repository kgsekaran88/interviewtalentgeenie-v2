import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const logger = createLogger('detect-bias');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Bias detection request started');
    
    const authHeader = req.headers.get('Authorization');
    // Roles: partner_admin, hr_recruiter, tech_spoc can detect bias in assessments
    const authResult = await authenticateRequest(authHeader, ['partner_admin', 'hr_recruiter', 'tech_spoc']);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.error.includes('required') ? 401 : 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user, supabase, supabaseAuth } = authResult;
    logger.info('User authenticated for bias detection', { userId: user.id });

    const { attemptId } = await req.json();

    if (!attemptId) {
      return new Response(
        JSON.stringify({ error: "attemptId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select(`
        *,
        interview_attempts!inner(
          id,
          candidate_name,
          candidate_email,
          answers,
          interviews!inner(
            id,
            job_description,
            creator_id,
            organization_id
          )
        )
      `)
      .eq("attempt_id", attemptId)
      .single();

    if (assessmentError || !assessment) {
      logger.error("Assessment not found", assessmentError, { attemptId });
      return new Response(
        JSON.stringify({ error: "Assessment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      logger.error('Error fetching user roles (service client)', rolesError, { userId: user.id });
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isCreator = assessment.interview_attempts.interviews.creator_id === user.id;
    const hasAdminRole = userRoles?.some((r: any) => ['platform_admin', 'partner_admin', 'hr_recruiter'].includes(r.role));

    if (!isCreator && !hasAdminRole) {
      logger.warn('Unauthorized bias detection attempt', { userId: user.id, attemptId });
      return new Response(
        JSON.stringify({ error: 'Unauthorized to detect bias for this assessment' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info('Authorization verified for bias detection', { isCreator, hasAdminRole });

    const prompt = `Analyze this interview assessment for potential bias. Review the evaluation, strengths, weaknesses, and hiring decision for any signs of unfair bias.

Job Description: ${assessment.interview_attempts.interviews?.job_description || 'N/A'}

Candidate: ${assessment.interview_attempts.candidate_name}

Overall Score: ${assessment.overall_score}
Hiring Decision: ${assessment.hiring_decision}

Strengths: ${JSON.stringify(assessment.strengths)}
Weaknesses: ${JSON.stringify(assessment.weaknesses)}

Detailed Analysis: ${assessment.detailed_analysis}

Detect bias in these categories:
1. Language Bias (gender-coded language, cultural assumptions)
2. Cultural Bias (assumptions about communication styles, work practices)
3. Technical Bias (overemphasis on specific technologies, frameworks)
4. Affinity Bias (favoritism based on background similarity)
5. Recency Bias (overweighting recent information)

Return JSON:
{
  "bias_score": <0-100, lower is better>,
  "bias_indicators": [
    {
      "type": "language/cultural/technical/affinity/recency",
      "severity": "low/medium/high",
      "description": "...",
      "evidence": "specific quote or pattern"
    }
  ],
  "language_bias": {"detected": boolean, "details": "..."},
  "cultural_bias": {"detected": boolean, "details": "..."},
  "technical_bias": {"detected": boolean, "details": "..."},
  "recommendations": ["actionable recommendation 1", ...]
}`;

    let biasAnalysisContent: string | null = null;

    // Get organization context for usage tracking
    const organizationId = assessment.interview_attempts?.interviews?.organization_id;
    const interviewId = assessment.interview_attempts?.interviews?.id;

    // Use unified AI calling pattern
    try {
      biasAnalysisContent = await callAI({
        featureName: 'bias_detection',
        prompt: prompt,
        systemPrompt: 'You are a fair hiring expert specialized in detecting unconscious bias. Return only valid JSON.',
        organizationId,
        userId: user.id,
        interviewId
      });
    } catch (error) {
      logger.error('Bias detection AI call failed', error);
      throw new Error('Failed to analyze bias. Please check AI configuration.');
    }

    if (!biasAnalysisContent) {
      throw new Error('No content generated from bias analysis');
    }

    const jsonMatch = biasAnalysisContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from AI response");
    }
    
    const biasAnalysis = JSON.parse(jsonMatch[0]);

    const { data: biasResult, error: insertError } = await supabase
      .from("bias_detection_results")
      .insert({
        assessment_id: assessment.id,
        attempt_id: attemptId,
        bias_score: biasAnalysis.bias_score || 0,
        bias_indicators: biasAnalysis.bias_indicators || [],
        language_bias: biasAnalysis.language_bias,
        cultural_bias: biasAnalysis.cultural_bias,
        technical_bias: biasAnalysis.technical_bias,
        recommendations: biasAnalysis.recommendations || [],
        analysis_model: 'ai-model',
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing bias results:", insertError);
      throw insertError;
    }

    console.log(`Bias detection completed for attempt ${attemptId}. Bias score: ${biasAnalysis.bias_score}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        biasResult,
        analysis: biasAnalysis
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in detect-bias function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
