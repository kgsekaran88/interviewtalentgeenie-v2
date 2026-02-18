import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAI } from '../_shared/ai-caller.ts';
import { authenticateRequest } from '../_shared/auth-utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let operationLogId: string | null = null;
  
  try {
    // Authenticate and authorize user
    // Roles: hr_recruiter creates interviews, tech_spoc reviews/regenerates questions
    const authHeader = req.headers.get('Authorization');
    const { user, supabase, error: authError } = await authenticateRequest(
      authHeader,
      ['partner_admin', 'hr_recruiter', 'tech_spoc']
    );

    if (authError || !user) {
      console.error('Authorization failed:', authError);
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { questionId, interviewId, feedback } = await req.json();

    if (!questionId || !interviewId) {
      throw new Error('Missing questionId or interviewId');
    }

    console.log('Regenerating question:', { questionId, interviewId, userId: user.id, hasFeedback: !!feedback });

    // Log operation start
    try {
      const { data: logData } = await supabase
        .from('interview_operation_logs')
        .insert({
          operation: 'question_regeneration',
          status: 'started',
          interview_id: interviewId,
          user_id: user.id,
          metadata: { questionId, hasFeedback: !!feedback },
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      operationLogId = logData?.id || null;
    } catch (logErr) {
      console.error('[OperationLog] Failed to start log:', logErr);
    }

    // Get the old question details including question_text for feedback context
    const { data: oldQuestion, error: fetchError } = await supabase
      .from('questions')
      .select('topic, difficulty, question_type, order_index, question_text')
      .eq('id', questionId)
      .single();

    if (fetchError || !oldQuestion) {
      throw new Error('Question not found');
    }

    // Get interview details including organization_id for usage tracking
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('job_description, title, organization_id, creator_id')
      .eq('id', interviewId)
      .single();

    if (interviewError || !interview) {
      throw new Error('Interview not found');
    }

    const organizationId = interview.organization_id;
    const interviewCreatorId = interview.creator_id || user.id;

    // Build the prompt
    let prompt = `You are an expert technical interviewer creating assessment questions.

Generate exactly ONE new ${oldQuestion.question_type.toUpperCase()} question for the topic "${oldQuestion.topic}" at ${oldQuestion.difficulty} difficulty level.

Job Description Context:
${interview.job_description}

The question should be different from the previous one but maintain the same difficulty and topic.`;

    // Add feedback context if provided
    if (feedback && feedback.trim()) {
      prompt += `

IMPORTANT: The reviewer provided this feedback about the previous question:
"${feedback}"

Previous question that needs to be replaced:
"${oldQuestion.question_text}"

Please generate a new question that addresses this feedback while maintaining the same topic and difficulty level.`;
    }

    prompt += `

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "question_text": "The question text",
  "options": ${oldQuestion.question_type === 'mcq' ? '["Option A", "Option B", "Option C", "Option D"]' : 'null'},
  "correct_answer": "The correct answer",
  "explanation": "Brief explanation of why the answer is correct",
  "topic": "${oldQuestion.topic}",
  "difficulty": "${oldQuestion.difficulty}",
  "question_type": "${oldQuestion.question_type}"
}`;

    console.log('Calling AI for question regeneration...');

    const aiResponse = await callAI({
      featureName: 'question_regeneration',
      prompt: prompt,
      systemPrompt: 'You are an expert technical interviewer creating assessment questions. Return only valid JSON.',
      organizationId: organizationId,
      userId: user.id,
      interviewId: interviewId,
    });

    if (!aiResponse) {
      throw new Error('Empty response from AI');
    }

    // Parse the AI response
    let newQuestion;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      newQuestion = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate required fields
    if (!newQuestion.question_text || !newQuestion.correct_answer) {
      throw new Error('AI response missing required fields');
    }

    // Update the question in the database (only existing columns)
    const { data: updatedQuestion, error: updateError } = await supabase
      .from('questions')
      .update({
        question_text: newQuestion.question_text,
        options: newQuestion.options,
        correct_answer: newQuestion.correct_answer,
        version: (oldQuestion as any).version ? ((oldQuestion as any).version + 1) : 1,
      })
      .eq('id', questionId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update question: ${updateError.message}`);
    }

    // Update interview status to indicate questions need re-review
    await supabase
      .from('interviews')
      .update({ 
        questions_status: 'pending_review',
        updated_at: new Date().toISOString()
      })
      .eq('id', interviewId);

    // Log AI usage
    try {
      await supabase.from('ai_usage_logs').insert({
        feature_name: 'question_regeneration',
        success: true,
        user_id: user.id,
        organization_id: organizationId,
        interview_id: interviewId,
        model_used: 'gemini-2.5-flash',
        latency_ms: Date.now() - startTime,
      });
    } catch (usageErr) {
      console.error('Failed to log AI usage:', usageErr);
    }

    // Log operation completion
    if (operationLogId) {
      try {
        await supabase
          .from('interview_operation_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
          })
          .eq('id', operationLogId);
      } catch (logErr) {
        console.error('[OperationLog] Failed to complete log:', logErr);
      }
    }

    console.log('Question regenerated successfully:', questionId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        question: updatedQuestion,
        message: 'Question regenerated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error regenerating question:', error);

    // Log operation failure
    if (operationLogId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      try {
        await supabase
          .from('interview_operation_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', operationLogId);
      } catch (logErr) {
        console.error('[OperationLog] Failed to log error:', logErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
