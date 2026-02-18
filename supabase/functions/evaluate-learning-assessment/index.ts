import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const logger = createLogger('evaluate-learning-assessment');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Starting learning assessment evaluation request');
    
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ['platform_admin']);

    if (authResult.error) {
      logger.warn('Authentication failed', { error: authResult.error });
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.error.includes('required') ? 401 : 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user, supabase } = authResult;
    logger.info('User authenticated', { userId: user.id });

    const inputSchema = z.object({
      attemptId: z.string().uuid('Invalid attempt ID format'),
    });

    const { attemptId } = inputSchema.parse(await req.json());
    logger.info('Evaluating learning assessment attempt', { attemptId });
    
    // Fetch attempt details
    const { data: attempt, error: attemptError } = await supabase
      .from('learning_assessment_attempts')
      .select(`
        *,
        learning_assessments:assessment_id (
          title,
          description
        )
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      logger.error('Attempt not found', attemptError);
      return new Response(JSON.stringify({ error: 'Learning assessment attempt not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch questions
    const { data: questions } = await supabase
      .from('learning_assessment_questions')
      .select('*')
      .eq('assessment_id', attempt.assessment_id)
      .order('order_index');

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found for this assessment' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('Assessment data fetched', { questionsCount: questions.length });

    const answers = attempt.answers || {};
    const assessment = attempt.learning_assessments;

    const prompt = `Evaluate this learning assessment attempt:
Assessment: ${assessment.title}
Description: ${assessment.description}
User Answers: ${JSON.stringify(answers)}

Return JSON:
{
  "overall_score": <0-100>,
  "passed": <boolean>,
  "strengths": ["strength 1", ...],
  "weaknesses": ["weakness 1", ...],
  "topic_scores": {"topic": score},
  "detailed_feedback": "...",
  "recommendations": ["recommendation 1", ...]
}`;

    // Learning evaluation - no org context as it's user-centric
    const evaluationContent = await callAI({
      featureName: 'learning_evaluation',
      prompt: prompt,
      systemPrompt: 'You are an expert learning evaluator. Provide detailed, constructive feedback. Return only valid JSON.',
      userId: user.id
    });

    if (!evaluationContent) {
      throw new Error('No AI provider available or failed to generate content');
    }

    const jsonMatch = evaluationContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from AI response");
    }
    
    const evaluation = JSON.parse(jsonMatch[0]);

    // Update attempt with evaluation results
    const { error: updateError } = await supabase
      .from('learning_assessment_attempts')
      .update({
        score: evaluation.overall_score,
        passed: evaluation.passed,
        status: 'completed',
        completed_at: new Date().toISOString(),
        feedback: {
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          detailed_feedback: evaluation.detailed_feedback,
          recommendations: evaluation.recommendations,
          topic_scores: evaluation.topic_scores
        }
      })
      .eq('id', attemptId);

    if (updateError) {
      logger.error('Failed to update attempt', updateError);
      throw updateError;
    }

    logger.info('Evaluation completed successfully', { attemptId });

    return new Response(JSON.stringify({ 
      success: true, 
      evaluation 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error('Error in evaluate-learning-assessment:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
