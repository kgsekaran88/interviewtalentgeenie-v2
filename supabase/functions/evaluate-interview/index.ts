import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { callAI, callAIWithTools } from "../_shared/ai-caller.ts";
import { getAIConfig, logAIUsage } from "../_shared/config.ts";
import { getProctoringConfig, getViolationScore, isViolationEnabled, ProctoringConfig } from "../_shared/proctoring-config.ts";
import { sendAssessmentReadyEmail } from "../_shared/email-helper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to log operations to database
async function logOperation(
  supabase: any,
  operation: string,
  status: 'started' | 'completed' | 'failed',
  params: {
    interviewId?: string;
    attemptId?: string;
    candidateEmail?: string;
    userId?: string;
    metadata?: Record<string, any>;
    errorCode?: string;
    errorMessage?: string;
    errorDetails?: Record<string, any>;
    logId?: string;
  }
) {
  try {
    if (params.logId && status !== 'started') {
      // Update existing log
      const completedAt = new Date().toISOString();
      const { data: logData } = await supabase
        .from('interview_operation_logs')
        .select('started_at')
        .eq('id', params.logId)
        .single();
      
      const durationMs = logData?.started_at 
        ? new Date(completedAt).getTime() - new Date(logData.started_at).getTime()
        : null;

      await supabase
        .from('interview_operation_logs')
        .update({
          status,
          completed_at: completedAt,
          duration_ms: durationMs,
          error_code: params.errorCode || null,
          error_message: params.errorMessage || null,
          error_details: params.errorDetails || null,
          metadata: params.metadata || undefined,
        })
        .eq('id', params.logId);
    } else {
      // Create new log
      const { data } = await supabase
        .from('interview_operation_logs')
        .insert({
          operation,
          status,
          interview_id: params.interviewId || null,
          attempt_id: params.attemptId || null,
          candidate_email: params.candidateEmail || null,
          user_id: params.userId || null,
          metadata: params.metadata || {},
          started_at: new Date().toISOString(),
          completed_at: status !== 'started' ? new Date().toISOString() : null,
        })
        .select('id')
        .single();
      return data?.id;
    }
  } catch (err) {
    console.error('[OperationLog] Failed to log operation:', err);
  }
  return null;
}

serve(async (req) => {
  const logger = createLogger('evaluate-interview');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let operationLogId: string | null = null;
  let attemptId: string | undefined;

  try {
    logger.info('Starting interview evaluation request');
    
    const authHeader = req.headers.get('Authorization');
    
    let supabase;
    let userId: string | null = null;
    
    // Check if this is a service role call (internal/automated)
    const token = authHeader?.replace('Bearer ', '');
    const isServiceRoleCall = token === supabaseServiceKey;
    
    if (isServiceRoleCall) {
      // Internal service call - use service role directly
      logger.info('Service role authentication detected (internal call)');
      supabase = createClient(supabaseUrl, supabaseServiceKey);
      userId = 'service-role';
    } else {
      // User authentication - validate roles (platform_admin has implicit access via auth-utils)
      const authResult = await authenticateRequest(authHeader, ['partner_admin', 'hr_recruiter', 'tech_spoc']);

      if (authResult.error) {
        logger.warn('Authentication failed', { error: authResult.error });
        return new Response(JSON.stringify({ error: authResult.error }), {
          status: authResult.error.includes('required') ? 401 : 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      supabase = authResult.supabase;
      userId = authResult.user.id;
    }
    
    logger.info('Authentication successful', { userId });

    const inputSchema = z.object({
      attemptId: z.string().uuid('Invalid attempt ID format'),
      includeVideoAnalysis: z.boolean().optional().default(false),
    });

    const parsed = inputSchema.parse(await req.json());
    attemptId = parsed.attemptId;
    const includeVideoAnalysis = parsed.includeVideoAnalysis;
    
    // DEDUPLICATION: Check for existing in-progress evaluations and clean up stale ones
    const STALE_THRESHOLD_MINUTES = 3; // Consider evaluations stuck if older than 3 minutes
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    // Check for any in-progress evaluation for this attempt
    const { data: existingEvals } = await serviceSupabase
      .from('interview_operation_logs')
      .select('id, started_at, status')
      .eq('attempt_id', attemptId)
      .eq('operation', 'evaluation')
      .eq('status', 'started');
    
    if (existingEvals && existingEvals.length > 0) {
      // Clean up stale evaluations (stuck for more than threshold)
      const staleEvals = existingEvals.filter((e: any) => e.started_at < staleThreshold);
      const activeEvals = existingEvals.filter((e: any) => e.started_at >= staleThreshold);
      
      // Mark stale evaluations as failed
      if (staleEvals.length > 0) {
        logger.info('Cleaning up stale evaluations', { count: staleEvals.length });
        for (const stale of staleEvals) {
          await serviceSupabase
            .from('interview_operation_logs')
            .update({ 
              status: 'failed', 
              completed_at: new Date().toISOString(),
              error_message: 'Evaluation timed out or was abandoned'
            })
            .eq('id', stale.id);
        }
      }
      
      // If there's an active evaluation still running, return early
      if (activeEvals.length > 0) {
        logger.warn('Evaluation already in progress', { attemptId, activeCount: activeEvals.length });
        return new Response(JSON.stringify({ 
          error: 'Evaluation already in progress. Please wait for it to complete.',
          inProgress: true,
          startedAt: activeEvals[0].started_at
        }), {
          status: 409, // Conflict
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Start operation logging
    operationLogId = await logOperation(serviceSupabase, 'evaluation', 'started', {
      attemptId,
      userId: userId || undefined,
      metadata: { includeVideoAnalysis }
    });
    
    logger.info('Evaluating attempt', { attemptId, includeVideoAnalysis, operationLogId });
    
    const { data: attempt, error: attemptError } = await supabase
      .from('interview_attempts')
      .select(`
        *,
        interviews:interview_id (
          job_description,
          creator_id,
          organization_id
        )
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      logger.error('Attempt not found', attemptError);
      return new Response(JSON.stringify({ error: 'Interview attempt not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch only the questions shown to the candidate (from attempt_questions)
    const { data: attemptQuestions } = await supabase
      .from('attempt_questions')
      .select('question_id, questions(*)')
      .eq('attempt_id', attemptId)
      .order('display_order');
    
    const questions = attemptQuestions?.map((aq: any) => aq.questions) || [];

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found for this interview' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('Interview data fetched', { questionsCount: questions.length });

    const answers = attempt.answers || {};
    const interview = attempt.interviews;
    
    // Extract organization context for usage tracking
    const organizationId = interview?.organization_id;
    const interviewCreatorId = interview?.creator_id;

    // Count answered vs total questions
    const totalQuestions = questions.length;
    const answeredQuestions = Object.values(answers).filter((a: any) => 
      a && typeof a === 'string' && a.trim().length > 0
    ).length;
    const unansweredCount = totalQuestions - answeredQuestions;

    // Build detailed Q&A for better evaluation
    const questionAnswerPairs = questions.map((q: any) => ({
      question_id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      topic: q.topic,
      difficulty: q.difficulty,
      correct_answer: q.correct_answer,
      candidate_answer: answers[q.id] || null,
      options: q.options || []
    }));

    // STEP 1: Evaluate answers - use AI for descriptive/scenario/coding, programmatic for MCQ only
    const topicStats: Record<string, { correct: number; total: number; partialPoints: number }> = {};
    const questionResults: Record<string, { correct: boolean; partial: boolean; points: number; maxPoints: number }> = {};

    // Separate questions by type for processing
    const aiEvaluatedQuestions = questionAnswerPairs.filter((qa: any) => 
      qa.question_type === 'descriptive' || qa.question_type === 'scenario' || qa.question_type === 'coding'
    );
    const mcqQuestions = questionAnswerPairs.filter((qa: any) => 
      qa.question_type === 'mcq'
    );

    // Track per-question scores with reasoning for the assessment report
    const questionScores: Record<string, { score: number; maxScore: number; reasoning: string; isCorrect: boolean }> = {};

    // Process MCQ questions programmatically (exact match)
    for (const qa of mcqQuestions) {
      const topic = qa.topic || 'General';
      if (!topicStats[topic]) {
        topicStats[topic] = { correct: 0, total: 0, partialPoints: 0 };
      }
      topicStats[topic].total += 1;

      const candidateAnswer = qa.candidate_answer?.toString().trim().toLowerCase() || '';
      const correctAnswer = qa.correct_answer?.toString().trim().toLowerCase() || '';
      
      const isCorrect = candidateAnswer && candidateAnswer === correctAnswer;
      
      if (isCorrect) {
        topicStats[topic].correct += 1;
        topicStats[topic].partialPoints += 1;
      }
      
      questionResults[qa.question_id] = {
        correct: isCorrect,
        partial: false,
        points: isCorrect ? 1 : 0,
        maxPoints: 1
      };

      // Store MCQ score with reasoning
      questionScores[qa.question_id] = {
        score: isCorrect ? 1 : 0,
        maxScore: 1,
        isCorrect,
        reasoning: isCorrect 
          ? 'Correct answer selected' 
          : candidateAnswer 
            ? `Incorrect. Expected: "${qa.correct_answer}"` 
            : 'No answer provided'
      };
    }

    // Use AI to evaluate descriptive/scenario/coding questions for partial credit
    if (aiEvaluatedQuestions.length > 0) {
      // Separate coding questions for specialized evaluation
      const codingQuestions = aiEvaluatedQuestions.filter((qa: any) => qa.question_type === 'coding');
      const descriptiveQuestions = aiEvaluatedQuestions.filter((qa: any) => qa.question_type !== 'coding');
      
      // Evaluate coding questions with specialized AI prompt using tool calling
      if (codingQuestions.length > 0) {
        logger.info('Evaluating coding questions with AI tool calling', { count: codingQuestions.length });
        
        const codingEvalPrompt = `You are an expert code reviewer. Evaluate each coding answer with STRICT QUALITY STANDARDS.

SCORING CRITERIA (be strict - only award 100% for excellent code):

1.0 (100%) = EXCELLENT - Must meet ALL criteria:
   - Logically correct and produces expected output
   - Clean, readable code with good naming conventions
   - Efficient algorithm/approach (optimal or near-optimal time/space complexity)
   - Follows best practices for the language
   - Handles edge cases appropriately
   - Well-structured and maintainable

0.7 (70%) = CORRECT BUT NOT OPTIMAL:
   - Logically correct and produces expected output
   - BUT has one or more issues:
     * Inefficient approach (suboptimal complexity)
     * Poor variable naming or code readability
     * Missing edge case handling
     * Not following language best practices
     * Verbose or unnecessarily complex solution

0.5 (50%) = PARTIALLY CORRECT:
   - Core logic is mostly right but has bugs
   - OR produces correct output only for basic cases
   - OR missing significant parts of the solution
   - Shows understanding but incomplete implementation

0.25 (25%) = MINIMAL CREDIT:
   - Shows some relevant knowledge
   - Significant logical errors
   - Only partially addresses the problem
   - Major bugs that would prevent execution

0.0 (0%) = INCORRECT:
   - Fundamentally wrong approach
   - No valid logic
   - Empty or no answer provided
   - Completely off-topic

For SQL specifically:
- Different syntax achieving same result is fine (INNER JOIN vs comma join)
- But inefficient queries (missing indexes, unnecessary subqueries, N+1 patterns) get 70% max
- Column order doesn't affect correctness

Questions to evaluate:
${codingQuestions.map((qa: any, i: number) => `
Question ${i + 1} (ID: ${qa.question_id}, Topic: ${qa.topic}):
Q: ${qa.question_text}
Expected Answer/Solution: ${qa.correct_answer}
Candidate's Answer: ${qa.candidate_answer || 'No answer provided'}
`).join('\n')}`;

        try {
          // Use tool calling for guaranteed structured output
          interface CodingEvalResult {
            evaluations: Array<{
              question_id: string;
              score: number;
              reasoning: string;
            }>;
          }
          
          const codingScores = await callAIWithTools<CodingEvalResult>({
            featureName: 'coding_evaluation',
            prompt: codingEvalPrompt,
            systemPrompt: 'You are an expert code reviewer evaluating solutions for functional correctness. Focus on whether the code achieves the correct result, not exact syntax match.',
            tools: [{
              type: 'function',
              function: {
                name: 'submit_coding_scores',
                description: 'Submit the evaluation scores for coding questions',
                parameters: {
                  type: 'object',
                  properties: {
                    evaluations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          question_id: { type: 'string', description: 'The UUID of the question' },
                          score: { type: 'number', description: 'Score from 0 to 1 (0, 0.25, 0.5, 0.7, or 1.0)' },
                          reasoning: { type: 'string', description: 'Brief explanation of the score' }
                        },
                        required: ['question_id', 'score', 'reasoning'],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ['evaluations'],
                  additionalProperties: false
                }
              }
            }],
            toolChoice: { type: 'function', function: { name: 'submit_coding_scores' } },
            organizationId,
            userId: interviewCreatorId,
            interviewId: attempt.interview_id
          });

          if (codingScores?.evaluations) {
            for (let i = 0; i < codingQuestions.length; i++) {
              const qa = codingQuestions[i];
              const topic = qa.topic || 'General';
              if (!topicStats[topic]) {
                topicStats[topic] = { correct: 0, total: 0, partialPoints: 0 };
              }
              topicStats[topic].total += 1;

              const scoreResult = codingScores.evaluations[i] || codingScores.evaluations.find((s: any) => s.question_id === qa.question_id);
              const score = scoreResult?.score ?? 0;

              const isCorrect = score >= 1.0;
              const isPartial = score > 0 && score < 1.0;

              if (isCorrect) {
                topicStats[topic].correct += 1;
              }
              topicStats[topic].partialPoints += score;

              questionResults[qa.question_id] = {
                correct: isCorrect,
                partial: isPartial,
                points: score,
                maxPoints: 1
              };

              // Store coding question score with AI reasoning
              questionScores[qa.question_id] = {
                score,
                maxScore: 1,
                isCorrect,
                reasoning: scoreResult?.reasoning || (isCorrect ? 'Excellent solution' : 'See detailed analysis')
              };
              
              logger.info('Coding question scored', { 
                questionId: qa.question_id, 
                topic, 
                score,
                reasoning: scoreResult?.reasoning 
              });
            }
          }
        } catch (codingError) {
          logger.error('AI coding evaluation failed, falling back to normalized comparison', codingError);
          // Fallback to normalized string comparison
          for (const qa of codingQuestions) {
            const topic = qa.topic || 'General';
            if (!topicStats[topic]) {
              topicStats[topic] = { correct: 0, total: 0, partialPoints: 0 };
            }
            topicStats[topic].total += 1;

            const candidateAnswer = qa.candidate_answer?.toString().trim().toLowerCase() || '';
            const correctAnswer = qa.correct_answer?.toString().trim().toLowerCase() || '';
            
            // Enhanced normalization for fallback
            const normalizeCode = (code: string) => code
              .replace(/\s+/g, ' ')
              .replace(/;/g, '')
              .replace(/,\s*/g, ',')
              .replace(/\(\s*/g, '(')
              .replace(/\s*\)/g, ')')
              .trim();
            
            const isCorrect = candidateAnswer && normalizeCode(candidateAnswer) === normalizeCode(correctAnswer);
            
            if (isCorrect) {
              topicStats[topic].correct += 1;
              topicStats[topic].partialPoints += 1;
            }

            questionResults[qa.question_id] = {
              correct: isCorrect,
              partial: false,
              points: isCorrect ? 1 : 0,
              maxPoints: 1
            };

            // Store fallback coding score
            questionScores[qa.question_id] = {
              score: isCorrect ? 1 : 0,
              maxScore: 1,
              isCorrect,
              reasoning: isCorrect ? 'Code matches expected output' : 'Code does not match expected output'
            };
          }
        }
      }
      
      // Evaluate descriptive/scenario questions using tool calling
      if (descriptiveQuestions.length > 0) {
        logger.info('Evaluating descriptive/scenario questions with AI tool calling', { count: descriptiveQuestions.length });
        
        const descriptiveEvalPrompt = `Evaluate each descriptive/scenario answer for correctness. Consider partial credit for answers that demonstrate understanding but may be incomplete or use different wording.

For each question, provide a score:
- 1.0 = Fully correct (covers all key concepts)
- 0.5 = Partially correct (demonstrates understanding but missing some key points or has minor errors)
- 0.0 = Incorrect (fundamentally wrong or no answer)

Questions to evaluate:
${descriptiveQuestions.map((qa: any, i: number) => `
Question ${i + 1} (ID: ${qa.question_id}, Topic: ${qa.topic}):
Q: ${qa.question_text}
Expected Answer: ${qa.correct_answer}
Candidate's Answer: ${qa.candidate_answer || 'No answer provided'}
`).join('\n')}`;

        try {
          // Use tool calling for guaranteed structured output
          interface DescriptiveEvalResult {
            evaluations: Array<{
              question_id: string;
              score: number;
              reasoning: string;
            }>;
          }
          
          const descriptiveScores = await callAIWithTools<DescriptiveEvalResult>({
            featureName: 'descriptive_evaluation',
            prompt: descriptiveEvalPrompt,
            systemPrompt: 'You are an expert technical evaluator. Assess answers fairly, giving partial credit when deserved.',
            tools: [{
              type: 'function',
              function: {
                name: 'submit_descriptive_scores',
                description: 'Submit the evaluation scores for descriptive/scenario questions',
                parameters: {
                  type: 'object',
                  properties: {
                    evaluations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          question_id: { type: 'string', description: 'The UUID of the question' },
                          score: { type: 'number', description: 'Score: 0, 0.5, or 1.0' },
                          reasoning: { type: 'string', description: 'Brief explanation of the score' }
                        },
                        required: ['question_id', 'score', 'reasoning'],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ['evaluations'],
                  additionalProperties: false
                }
              }
            }],
            toolChoice: { type: 'function', function: { name: 'submit_descriptive_scores' } },
            organizationId,
            userId: interviewCreatorId,
            interviewId: attempt.interview_id
          });

          if (descriptiveScores?.evaluations) {
            for (let i = 0; i < descriptiveQuestions.length; i++) {
              const qa = descriptiveQuestions[i];
              const topic = qa.topic || 'General';
              if (!topicStats[topic]) {
                topicStats[topic] = { correct: 0, total: 0, partialPoints: 0 };
              }
              topicStats[topic].total += 1;

              // Find matching score from AI response
              const scoreResult = descriptiveScores.evaluations[i] || descriptiveScores.evaluations.find((s: any) => s.question_id === qa.question_id);
              const score = scoreResult?.score ?? 0;

              const isCorrect = score >= 1.0;
              const isPartial = score > 0 && score < 1.0;

              if (isCorrect) {
                topicStats[topic].correct += 1;
              }
              topicStats[topic].partialPoints += score;

              questionResults[qa.question_id] = {
                correct: isCorrect,
                partial: isPartial,
                points: score,
                maxPoints: 1
              };

              // Store descriptive question score with AI reasoning
              questionScores[qa.question_id] = {
                score,
                maxScore: 1,
                isCorrect,
                reasoning: scoreResult?.reasoning || (isCorrect ? 'Fully correct answer' : isPartial ? 'Partially correct' : 'Incorrect or no answer')
              };
              
              logger.info('Descriptive question scored', { 
                questionId: qa.question_id, 
                topic, 
                score,
                reasoning: scoreResult?.reasoning 
              });
            }
          }
        } catch (descriptiveError) {
          logger.error('AI descriptive evaluation failed, falling back to basic matching', descriptiveError);
          // Fallback to basic evaluation
          for (const qa of descriptiveQuestions) {
            const topic = qa.topic || 'General';
            if (!topicStats[topic]) {
              topicStats[topic] = { correct: 0, total: 0, partialPoints: 0 };
            }
            topicStats[topic].total += 1;

            const candidateAnswer = qa.candidate_answer?.toString().trim().toLowerCase() || '';
            const correctAnswer = qa.correct_answer?.toString().trim().toLowerCase() || '';
            
            // Basic keyword matching as fallback
            const correctTerms = correctAnswer.split(/\s+/).filter((t: string) => t.length > 4);
            const matchedTerms = correctTerms.filter((term: string) => candidateAnswer.includes(term));
            const matchRatio = correctTerms.length > 0 ? matchedTerms.length / correctTerms.length : 0;
            
            const score = matchRatio >= 0.7 ? 1 : matchRatio >= 0.4 ? 0.5 : 0;
            const isCorrect = score >= 1.0;
            
            if (isCorrect) {
              topicStats[topic].correct += 1;
            }
            topicStats[topic].partialPoints += score;

            questionResults[qa.question_id] = {
              correct: isCorrect,
              partial: score === 0.5,
              points: score,
              maxPoints: 1
            };

            // Store fallback score
            questionScores[qa.question_id] = {
              score,
              maxScore: 1,
              isCorrect,
              reasoning: isCorrect ? 'Correct answer' : score === 0.5 ? 'Partially correct' : 'Incorrect or no answer'
            };
          }
      }
    }
  }

    // Calculate topic scores as percentages (using partial points for accurate scoring)
    const calculatedTopicScores: Record<string, number> = {};
    for (const [topic, stats] of Object.entries(topicStats)) {
      calculatedTopicScores[topic] = stats.total > 0 
        ? Math.round((stats.partialPoints / stats.total) * 100) 
        : 0;
    }

    // Calculate overall score from partial points (weighted by question count)
    let totalPartialPoints = 0;
    let totalQuestionCount = 0;
    for (const stats of Object.values(topicStats)) {
      totalPartialPoints += stats.partialPoints;
      totalQuestionCount += stats.total;
    }
    const calculatedOverallScore = totalQuestionCount > 0 
      ? Math.round((totalPartialPoints / totalQuestionCount) * 100) 
      : 0;

    logger.info('Programmatic score calculation', { 
      topicStats, 
      calculatedTopicScores, 
      calculatedOverallScore,
      totalPartialPoints,
      totalQuestionCount
    });

    // STEP 2: Use AI with tool calling for qualitative analysis (strengths, weaknesses, hiring decision)
    const prompt = `You are an expert technical interviewer providing constructive and encouraging qualitative analysis of a candidate's interview.

Job Description: ${interview.job_description}
Candidate: ${attempt.candidate_name}
Total Questions: ${totalQuestions}
Score: ${calculatedOverallScore}% (with partial credit for partially correct answers)
Overall Score: ${calculatedOverallScore}%

TOPIC PERFORMANCE (already calculated):
${Object.entries(calculatedTopicScores).map(([topic, score]) => `- ${topic}: ${score}%`).join('\n')}

QUESTIONS AND ANSWERS:
${JSON.stringify(questionAnswerPairs, null, 2)}

IMPORTANT GUIDELINES:
- Focus ONLY on technical skills and knowledge demonstrated in the answers
- DO NOT mention anything about proctoring, integrity, violations, monitoring, or behavioral observations
- Frame feedback in a positive, growth-oriented manner
- Even areas for improvement should be phrased constructively as opportunities for growth

Based on the candidate's answers and the pre-calculated scores, provide:
1. Key strengths demonstrated (3-5 specific technical/knowledge strengths shown in answers)
2. Areas for improvement (1-2 constructive growth opportunities based on answers, phrased positively)
3. Hiring recommendation based on overall performance
4. Detailed analysis paragraph (positive tone, focusing on demonstrated skills and potential)`;

    interface EvaluationResult {
      hiring_decision: 'strongly_recommend' | 'recommend' | 'consider' | 'not_recommend';
      strengths: string[];
      weaknesses: string[];
      detailed_analysis: string;
    }

    let evaluation: EvaluationResult;

    // Use tool calling for guaranteed structured output
    try {
      evaluation = await callAIWithTools<EvaluationResult>({
        featureName: 'interview_evaluation',
        prompt: prompt,
        systemPrompt: 'You are an expert technical interviewer providing constructive, encouraging feedback. Focus only on technical skills demonstrated in answers. Never mention proctoring, integrity monitoring, violations, or behavioral observations. Frame all feedback positively.',
        tools: [{
          type: 'function',
          function: {
            name: 'submit_evaluation',
            description: 'Submit the qualitative evaluation of the interview',
            parameters: {
              type: 'object',
              properties: {
                hiring_decision: { 
                  type: 'string', 
                  enum: ['strongly_recommend', 'recommend', 'consider', 'not_recommend'],
                  description: 'The hiring recommendation' 
                },
                strengths: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'List of 3-5 specific technical/knowledge strengths demonstrated in answers' 
                },
                weaknesses: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'List of 1-2 constructive growth opportunities based on answers, phrased positively' 
                },
                detailed_analysis: { 
                  type: 'string', 
                  description: 'A detailed paragraph with positive tone analyzing technical skills demonstrated and growth potential. Do not mention proctoring or violations.' 
                }
              },
              required: ['hiring_decision', 'strengths', 'weaknesses', 'detailed_analysis'],
              additionalProperties: false
            }
          }
        }],
        toolChoice: { type: 'function', function: { name: 'submit_evaluation' } },
        organizationId,
        userId: interviewCreatorId,
        interviewId: attempt.interview_id
      });
      
      // Limit weaknesses to max 2 items
      if (evaluation.weaknesses && evaluation.weaknesses.length > 2) {
        evaluation.weaknesses = evaluation.weaknesses.slice(0, 2);
      }
      
      logger.info('Evaluation generated via tool calling', { 
        hiringDecision: evaluation.hiring_decision,
        strengthsCount: evaluation.strengths?.length,
        weaknessesCount: evaluation.weaknesses?.length
      });
    } catch (error) {
      logger.error('AI evaluation with tool calling failed', error);
      throw new Error('Failed to generate evaluation. Please try again.');
    }

    // Build final evaluation object with calculated scores
    const finalEvaluation = {
      ...evaluation,
      overall_score: calculatedOverallScore,
      topic_scores: calculatedTopicScores,
      integrity_score: 100 // Will be updated below
    };
    
    logger.info('Final scores applied', { 
      overallScore: finalEvaluation.overall_score, 
      topicScores: finalEvaluation.topic_scores 
    });

    // Fetch integrity score for combined hiring decision
    // ALWAYS calculate from detailed_violations using configurable scores
    let integrityScore = 100; // Default if no proctoring session
    
    // Get configurable proctoring settings (organizationId already extracted earlier)
    const proctoringConfig = await getProctoringConfig(supabase, organizationId);
    logger.info('Using proctoring config', { organizationId, minPassingScore: proctoringConfig.min_passing_score });
    
    try {
      const { data: proctoringSession } = await supabase
        .from('proctoring_sessions')
        .select('integrity_score, detailed_violations, ignored_violations, multiple_person_detections, multiple_voice_detections, tab_switch_count, look_away_count, copy_attempt_count')
        .eq('interview_attempt_id', attemptId)
        .maybeSingle();
      
      // CRITICAL: Use stored integrity_score as fallback if available
      // This ensures we use the pre-calculated score if detailed_violations processing fails
      const storedIntegrityScore = proctoringSession?.integrity_score;

      if (proctoringSession) {
        const detailedViolations = proctoringSession.detailed_violations || [];
        // Get the list of ignored violation types (set by reviewers)
        const ignoredViolations: string[] = Array.isArray(proctoringSession.ignored_violations) 
          ? proctoringSession.ignored_violations 
          : [];
        
        // Derive accurate counts from detailed_violations
        const derivedCounts: Record<string, number> = {};
        
        if (Array.isArray(detailedViolations)) {
          // Calculate integrity score using configurable scores per violation
          integrityScore = 100;
          
          // Get the interview duration (time_taken in seconds) to filter out post-recording violations
          // Add a small buffer (30 seconds) to account for any timing differences
          const interviewDurationSeconds = attempt.time_taken || null;
          const violationCutoffSeconds = interviewDurationSeconds ? interviewDurationSeconds + 30 : null;
          
          let skippedPostRecordingCount = 0;
          let skippedIgnoredCount = 0;
          
          for (const v of detailedViolations) {
            // CRITICAL: Skip violations that have been ignored by reviewers
            const violationType = (v.type || '').toLowerCase().replace(/-/g, '_');
            if (ignoredViolations.includes(v.type) || ignoredViolations.includes(violationType)) {
              skippedIgnoredCount++;
              continue;
            }
            
            // CRITICAL: Skip violations that occurred after the interview recording ended
            // videoTimestamp is in seconds since recording started
            if (violationCutoffSeconds !== null && v.videoTimestamp !== undefined && v.videoTimestamp > violationCutoffSeconds) {
              skippedPostRecordingCount++;
              continue;
            }
            
            const type = (v.type || '').toLowerCase().replace(/-/g, '_');
            
            // Check if this violation type is enabled
            if (!isViolationEnabled(proctoringConfig, type)) {
              continue;
            }
            
            // Get configurable deduction score for this violation type
            const deduction = getViolationScore(proctoringConfig, type);
            integrityScore -= deduction;
            
            // Track counts for legacy columns
            if (type.includes('phone')) derivedCounts.phone_detected = (derivedCounts.phone_detected || 0) + 1;
            else if (type.includes('prohibited_object')) derivedCounts.prohibited_object = (derivedCounts.prohibited_object || 0) + 1;
            else if (type.includes('multiple_person') || type.includes('different_person')) derivedCounts.multiple_person = (derivedCounts.multiple_person || 0) + 1;
            else if (type.includes('multiple_voice') || type.includes('multiple_speaker')) derivedCounts.multiple_voice = (derivedCounts.multiple_voice || 0) + 1;
            else if (type.includes('tab_switch')) derivedCounts.tab_switch = (derivedCounts.tab_switch || 0) + 1;
            else if (type.includes('look_away') || type.includes('looking_away')) derivedCounts.look_away = (derivedCounts.look_away || 0) + 1;
            else if (type.includes('copy') && !type.includes('screen')) derivedCounts.copy_attempt = (derivedCounts.copy_attempt || 0) + 1;
          }
          
          if (skippedPostRecordingCount > 0 || skippedIgnoredCount > 0) {
            logger.info('Skipped violations during integrity calculation', { 
              skippedPostRecording: skippedPostRecordingCount,
              skippedIgnored: skippedIgnoredCount,
              ignoredViolationTypes: ignoredViolations,
              interviewDuration: interviewDurationSeconds,
              cutoffSeconds: violationCutoffSeconds
            });
          }
          
          integrityScore = Math.max(0, Math.min(100, integrityScore));
        }

        // Update proctoring_sessions with corrected counts and score
        await supabase
          .from('proctoring_sessions')
          .update({ 
            integrity_score: integrityScore,
            multiple_person_detections: derivedCounts.multiple_person || 0,
            multiple_voice_detections: derivedCounts.multiple_voice || 0,
            tab_switch_count: derivedCounts.tab_switch || 0,
            look_away_count: derivedCounts.look_away || 0,
            copy_attempt_count: derivedCounts.copy_attempt || 0,
          })
          .eq('interview_attempt_id', attemptId);
          
        logger.info('Integrity score calculated from detailed_violations with configurable scores', {
          derivedCounts,
          detailedViolationsCount: detailedViolations.length,
          ignoredViolationsCount: ignoredViolations.length,
          finalIntegrityScore: integrityScore
        });
      }
      
      // CRITICAL FALLBACK: If calculated integrity is still 100 but stored score exists and is lower,
      // use the stored score. This handles cases where detailed_violations processing fails.
      if (integrityScore === 100 && storedIntegrityScore !== null && storedIntegrityScore !== undefined && storedIntegrityScore < 100) {
        logger.warn('Using stored integrity score as fallback - calculated score was 100 but stored was different', {
          calculated: integrityScore,
          stored: storedIntegrityScore
        });
        integrityScore = storedIntegrityScore;
      }
      
      // Also fallback if no detailed_violations were processed but session has a score
      if (integrityScore === 100 && storedIntegrityScore !== null && storedIntegrityScore !== undefined) {
        integrityScore = storedIntegrityScore;
        logger.info('Using stored integrity score', { storedIntegrityScore });
      }
    } catch (intError) {
      logger.warn('Could not calculate integrity score from detailed_violations', intError);
      // CRITICAL: Try to get stored integrity score as last resort
      try {
        const { data: fallbackSession } = await supabase
          .from('proctoring_sessions')
          .select('integrity_score')
          .eq('interview_attempt_id', attemptId)
          .maybeSingle();
        
        if (fallbackSession?.integrity_score !== null && fallbackSession?.integrity_score !== undefined) {
          integrityScore = fallbackSession.integrity_score;
          logger.info('Used fallback stored integrity score after calculation error', { integrityScore });
        }
      } catch (fallbackError) {
        logger.error('Failed to get fallback integrity score', fallbackError);
      }
    }

    // Combined score: 70% technical, 30% integrity
    const combinedScore = Math.round((calculatedOverallScore * 0.7) + (integrityScore * 0.3));
    
    logger.info('Combined score calculation', { 
      technicalScore: calculatedOverallScore, 
      integrityScore, 
      combinedScore 
    });

    // Hiring decision based on technical score and integrity thresholds
    // Rules:
    // - Technical < 60% → Reject
    // - Integrity < 50% → Reject (severe violation)
    // - Integrity 51-70% → Consider (conditional recommend - needs manual review)
    // - Technical >= 60% with integrity > 70%: 60-74% = Consider, 75-89% = Recommend, 90%+ = Strongly Recommend
    
    const hasSevereIntegrityViolation = integrityScore < 50;
    const needsManualReview = integrityScore >= 51 && integrityScore <= 70;
    const technicalScore = calculatedOverallScore;
    
    // Hiring decision logic - integrity affects decision but NOT the technical feedback
    // Integrity concerns are handled separately in proctoring reports
    if (hasSevereIntegrityViolation) {
      // Severe integrity issues = automatic rejection regardless of technical score
      finalEvaluation.hiring_decision = 'not_recommend';
      // Note: DO NOT add integrity-related comments to weaknesses - handled in proctoring report
    } else if (technicalScore < 60) {
      // Technical score below threshold = rejection
      finalEvaluation.hiring_decision = 'not_recommend';
      finalEvaluation.weaknesses = finalEvaluation.weaknesses || [];
      finalEvaluation.weaknesses.unshift(`Technical score (${technicalScore}%) below minimum threshold of 60%`);
    } else if (needsManualReview) {
      // Integrity concerns require manual review - Conditional Recommend
      finalEvaluation.hiring_decision = 'consider';
      // Note: DO NOT add integrity-related comments to weaknesses - handled in proctoring report
    } else {
      // Good integrity (>70%), apply technical score thresholds
      if (technicalScore >= 90) {
        finalEvaluation.hiring_decision = 'strongly_recommend';
      } else if (technicalScore >= 75) {
        finalEvaluation.hiring_decision = 'recommend';
      } else {
        // 60-74%
        finalEvaluation.hiring_decision = 'consider';
      }
    }

    // Add note about unanswered questions if applicable
    if (unansweredCount > 0) {
      finalEvaluation.weaknesses = finalEvaluation.weaknesses || [];
      finalEvaluation.weaknesses.unshift(`Did not answer ${unansweredCount} of ${totalQuestions} questions`);
    }

    // Normalize hiring_decision to standardized new values
    // Database now accepts: "strongly_recommend", "recommend", "consider", "not_recommended"
    let normalizedDecision = finalEvaluation.hiring_decision?.toLowerCase().trim().replace(/\s+/g, '_');
    
    // Map AI output variations to standardized values
    const decisionMap: Record<string, string> = {
      // New values (pass through)
      'strongly_recommend': 'strongly_recommend',
      'recommend': 'recommend',
      'consider': 'consider',
      'not_recommended': 'not_recommended',
      // Old/legacy values (map to new)
      'strongly_recommended': 'strongly_recommend',
      'strong_recommend': 'strongly_recommend',
      'strong_hire': 'strongly_recommend',
      'recommended': 'recommend',
      'hire': 'recommend',
      'maybe': 'consider',
      'not_recommend': 'not_recommended',
      'reject': 'not_recommended',
      'no_hire': 'not_recommended',
      'do_not_hire': 'not_recommended',
    };
    
    normalizedDecision = decisionMap[normalizedDecision] || 'consider';
    
    // Validate against allowed values
    const validDecisions = ['strongly_recommend', 'recommend', 'consider', 'not_recommended'];
    if (!validDecisions.includes(normalizedDecision)) {
      logger.warn('Unrecognized hiring decision, defaulting to consider', { original: finalEvaluation.hiring_decision });
      normalizedDecision = 'consider';
    }

    // Use transactional database function for atomic assessment + CPI creation
    const { data: txResult, error: txError } = await supabase.rpc('save_interview_evaluation_tx', {
      p_attempt_id: attemptId,
      p_overall_score: finalEvaluation.overall_score,
      p_hiring_decision: normalizedDecision,
      p_strengths: finalEvaluation.strengths || [],
      p_weaknesses: finalEvaluation.weaknesses || [],
      p_topic_scores: finalEvaluation.topic_scores || {},
      p_detailed_analysis: finalEvaluation.detailed_analysis || '',
      p_technical_score: technicalScore || calculatedOverallScore,
      p_problem_solving_score: calculatedOverallScore,
      p_integrity_score: integrityScore,
      p_candidate_name: attempt.candidate_name,
      p_candidate_email: attempt.candidate_email,
      p_top_skills: finalEvaluation.strengths?.slice(0, 5) || [],
      p_weak_skills: finalEvaluation.weaknesses?.slice(0, 5) || [],
      p_violations_detected: 0,
      p_question_scores: questionScores
    });

    if (txError) {
      logger.error('Transaction error saving evaluation', txError);
      throw new Error(txError.message || 'Failed to save evaluation');
    }

    logger.info('Evaluation saved via transaction', { attemptId, cpiScore: txResult?.cpi_score });

    // CRITICAL: Compute integrity score if not already set by frontend
    // This handles cases where page closes before proctoring cleanup completes
    // Uses severity-based scoring from detailed_violations for accurate calculation
    try {
      const { data: proctoringSession } = await supabase
        .from('proctoring_sessions')
        .select('id, integrity_score, detailed_violations, ended_at')
        .eq('interview_attempt_id', attemptId)
        .maybeSingle();

      if (proctoringSession && proctoringSession.integrity_score === null) {
        // Calculate integrity score from detailed_violations severity
        const violations = (proctoringSession.detailed_violations as any[]) || [];
        const highSeverityCount = violations.filter((v: any) => v?.severity === 'high').length;
        const mediumSeverityCount = violations.filter((v: any) => v?.severity === 'medium').length;
        const lowSeverityCount = violations.filter((v: any) => v?.severity === 'low').length;

        let integrityScore = 100;
        if (violations.length > 0) {
          integrityScore = Math.max(
            0,
            100
            - (highSeverityCount * 15)   // Phone, prohibited objects, multiple persons
            - (mediumSeverityCount * 8)  // Tab switches
            - (lowSeverityCount * 3)     // Look aways, minor violations
          );
        }

        const shouldFlag = integrityScore < 70 || highSeverityCount > 0;

        logger.info('Computing integrity score from detailed violations', {
          sessionId: proctoringSession.id,
          violationCount: violations.length,
          highSeverityCount,
          mediumSeverityCount,
          lowSeverityCount,
          integrityScore,
          flagged: shouldFlag
        });

        await supabase
          .from('proctoring_sessions')
          .update({
            integrity_score: integrityScore,
            flagged_for_review: shouldFlag,
            ended_at: proctoringSession.ended_at || new Date().toISOString()
          })
          .eq('id', proctoringSession.id);

        logger.info('Integrity score computed and saved', { integrityScore });
      }
    } catch (integrityError) {
      logger.error('Error computing integrity score', integrityError);
      // Don't fail evaluation if integrity calculation fails
    }

    logger.info('Evaluation completed successfully', { attemptId });

    // CRITICAL: Run proctoring video analysis BEFORE returning report
    // This ensures the report has complete violation data including AI analysis
    // Only run if explicitly requested (after upload completes) OR if videos are already uploaded
    let proctoringAnalysisResult = null;
    try {
      // Check if videos are uploaded before attempting analysis
      const { data: currentSession } = await supabase
        .from('proctoring_sessions')
        .select('video_recording_url, screen_recording_url')
        .eq('interview_attempt_id', attemptId)
        .maybeSingle();
      
      const hasVideos = currentSession?.video_recording_url || currentSession?.screen_recording_url;
      
      if (includeVideoAnalysis || hasVideos) {
        logger.info('Running post-interview proctoring analysis', { 
          attemptId, 
          includeVideoAnalysis, 
          hasVideos,
          videoUrl: currentSession?.video_recording_url ? 'present' : 'missing',
          screenUrl: currentSession?.screen_recording_url ? 'present' : 'missing'
        });
        
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-proctoring-video', {
          body: { attemptId, attemptType: 'interview' }
        });
        
        if (analysisError) {
          logger.error('Proctoring analysis failed', analysisError);
        } else {
          proctoringAnalysisResult = analysisData;
          logger.info('Post-interview proctoring analysis completed', {
            integrityScore: analysisData?.integrityScore,
            totalViolations: analysisData?.totalViolations,
            newAIViolations: analysisData?.newAIViolations
          });
          
          // Update the integrity score in the evaluation if video analysis found issues
          if (analysisData?.integrityScore !== undefined && analysisData.integrityScore !== finalEvaluation.integrity_score) {
            // Re-fetch and recalculate hiring decision based on updated integrity
            const updatedIntegrityScore = analysisData.integrityScore;
            let updatedDecision = finalEvaluation.hiring_decision;
            
            // Apply integrity-based decision rules
            if (updatedIntegrityScore < 50) {
              updatedDecision = 'not_recommend';
              logger.info('Updated decision due to low integrity score from video analysis', { updatedIntegrityScore });
            } else if (updatedIntegrityScore < 70 && updatedDecision !== 'not_recommend') {
              updatedDecision = 'consider';
              logger.info('Updated decision to consider due to integrity concerns from video analysis', { updatedIntegrityScore });
            }
            
            // Update assessment with new decision if changed (but DON'T add integrity comments to detailed_analysis)
            // Integrity findings are kept separate in proctoring reports
            if (updatedDecision !== finalEvaluation.hiring_decision) {
              await supabase
                .from('assessments')
                .update({
                  hiring_decision: updatedDecision
                })
                .eq('attempt_id', attemptId);
              
              finalEvaluation.hiring_decision = updatedDecision;
            }
          }
        }
      } else {
        logger.info('Skipping video analysis - no videos uploaded yet and not explicitly requested', { 
          attemptId, 
          includeVideoAnalysis 
        });
      }
    } catch (proctoringError) {
      logger.error('Failed to run proctoring analysis', proctoringError);
      // Don't fail evaluation if proctoring analysis fails - report still available
    }

    // Auto-trigger CPI calculation after evaluation
    try {
      logger.info('Auto-triggering CPI calculation', { attemptId });
      await supabase.functions.invoke('calculate-cpi', {
        body: { attemptId }
      });
      logger.info('CPI calculation triggered successfully');
    } catch (cpiError) {
      logger.error('Failed to trigger CPI calculation', cpiError);
      // Don't fail evaluation if CPI calculation fails
    }

    // Send notifications to HR who sent invite + all partner admins
    try {
      // Get the invitation to find who invited the candidate
      const { data: invitation } = await supabase
        .from('interview_invitations')
        .select('invited_by')
        .eq('attempt_id', attemptId)
        .single();

      const invitedByUserId = invitation?.invited_by || interview.creator_id;
      
      // Collect unique user IDs to notify (avoid duplicates)
      const usersToNotify = new Set<string>();
      usersToNotify.add(invitedByUserId);

      // Get all partner admins for this organization
      let partnerAdminIds: string[] = [];
      if (interview.organization_id) {
        const { data: orgMembers } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', interview.organization_id)
          .eq('role', 'partner_admin');
        
        partnerAdminIds = orgMembers?.map((m: { user_id: string }) => m.user_id) || [];
        partnerAdminIds.forEach(id => usersToNotify.add(id));
      }

      logger.info('Notifying users about submission', { 
        invitedBy: invitedByUserId, 
        partnerAdmins: partnerAdminIds.length,
        totalUsers: usersToNotify.size 
      });

      // Send in-app notifications to all relevant users
      for (const userId of usersToNotify) {
        await supabase.rpc('create_notification', {
          p_user_id: userId,
          p_organization_id: interview.organization_id,
          p_type: 'candidate_submission',
          p_title: 'New Candidate Submission',
          p_message: `${attempt.candidate_name} has completed the interview "${interview.job_description?.substring(0, 50)}..."`,
          p_link: `/partner/recruiting/assessment/${attemptId}`,
          p_metadata: { attemptId, candidateName: attempt.candidate_name, score: finalEvaluation.overall_score }
        });

        await supabase.rpc('create_notification', {
          p_user_id: userId,
          p_organization_id: interview.organization_id,
          p_type: 'report_ready',
          p_title: 'Assessment Report Ready',
          p_message: `The assessment report for ${attempt.candidate_name} is ready to view (Score: ${finalEvaluation.overall_score}/100)`,
          p_link: `/partner/recruiting/assessment/${attemptId}`,
          p_metadata: { attemptId, candidateName: attempt.candidate_name, score: finalEvaluation.overall_score, decision: finalEvaluation.hiring_decision }
        });
      }

      logger.info('In-app notifications sent', { attemptId, notifiedCount: usersToNotify.size });
    } catch (notifError) {
      logger.error('Failed to send in-app notifications', notifError);
      // Don't fail the evaluation if notifications fail
    }

    // Send assessment ready emails to HR who invited + all partner admins
    try {
      // Get the invitation to find who invited the candidate
      const { data: invitation } = await supabase
        .from('interview_invitations')
        .select('invited_by')
        .eq('attempt_id', attemptId)
        .single();

      const invitedByUserId = invitation?.invited_by || interview.creator_id;
      
      // Collect unique user IDs to email
      const usersToEmail = new Set<string>();
      usersToEmail.add(invitedByUserId);

      // Get organization name and partner admins
      let organizationName: string | undefined;
      if (interview.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', interview.organization_id)
          .single();
        organizationName = org?.name;

        // Get all partner admins
        const { data: orgMembers } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', interview.organization_id)
          .eq('role', 'partner_admin');
        
        orgMembers?.forEach((m: { user_id: string }) => usersToEmail.add(m.user_id));
      }

      // Get profiles for all users to email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', Array.from(usersToEmail));

      const interviewTitle = attempt.interviews?.title || 
        (interview.job_description?.substring(0, 50) + '...');

      // Send emails to all relevant users
      for (const profile of (profiles || [])) {
        if (profile.email) {
          const emailResult = await sendAssessmentReadyEmail({
            hrEmail: profile.email,
            hrName: profile.full_name,
            candidateName: attempt.candidate_name,
            interviewTitle,
            attemptId,
            overallScore: finalEvaluation.overall_score,
            recommendation: finalEvaluation.hiring_decision.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            organizationName: organizationName || 'TalentGeenie'
          });
          
          logger.info('Assessment ready email sent', { 
            sent: emailResult.sent, 
            to: profile.email,
            error: emailResult.error 
          });
        }
      }
      
      logger.info('All assessment emails sent', { emailCount: profiles?.length || 0 });
    } catch (emailError) {
      logger.error('Failed to send assessment ready emails', emailError);
      // Don't fail the evaluation if email fails
    }

    // Log successful completion
    await logOperation(serviceSupabase, 'evaluation', 'completed', {
      logId: operationLogId || undefined,
      attemptId,
      metadata: { 
        overallScore: finalEvaluation.overall_score, 
        hiringDecision: finalEvaluation.hiring_decision,
        integrityScore 
      }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      evaluation: finalEvaluation 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error('Error in evaluate-interview:', error);
    
    // Log failure
    await logOperation(serviceSupabase, 'evaluation', 'failed', {
      logId: operationLogId || undefined,
      attemptId,
      errorCode: 'EVALUATION_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: { stack: error instanceof Error ? error.stack : undefined }
    });
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
