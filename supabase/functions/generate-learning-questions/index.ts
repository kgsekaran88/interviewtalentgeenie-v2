import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAI } from "../_shared/ai-caller.ts";

console.log("Generate Learning Questions function started");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  let assessmentId: string | undefined;

  try {
    const requestBody = await req.json();
    assessmentId = requestBody.assessmentId;
    const {
      topicDescription,
      questionCount,
      difficultyDistribution,
      questionTypeDistribution
    } = requestBody;

    console.log('Generating questions for assessment:', assessmentId);

    // Calculate question counts by type
    const mcqCount = Math.round((questionCount * questionTypeDistribution.mcq) / 100);
    const descriptiveCount = Math.round((questionCount * questionTypeDistribution.descriptive) / 100);
    const codingCount = questionCount - mcqCount - descriptiveCount;

    // Build AI prompt
    const prompt = `Generate ${questionCount} learning assessment questions based on the following topic:

Topic: ${topicDescription}

Question Distribution:
- ${mcqCount} Multiple Choice Questions (4 options each)
- ${descriptiveCount} Descriptive/Conceptual Questions
- ${codingCount} Coding/Problem-Solving Questions

Difficulty Distribution:
- Easy: ${difficultyDistribution.easy}%
- Medium: ${difficultyDistribution.medium}%
- Hard: ${difficultyDistribution.hard}%

For each question, provide:
1. question_text: The question statement
2. question_type: "mcq", "descriptive", or "coding"
3. difficulty: "easy", "medium", or "hard"
4. topic: Main topic/subtopic name
5. options: Array of 4 options (for MCQ only)
6. correct_answer: The correct answer
7. explanation: Detailed explanation of the answer
8. hints: 2-3 helpful hints for practice mode (as a single string)

Return ONLY a valid JSON array of question objects. No markdown, no code blocks.`;

    // Learning questions generation - no org context as it's user-centric
    const content = await callAI({
      featureName: 'question_generation',
      prompt: prompt,
      systemPrompt: 'You are an expert at creating learning assessment questions. Return ONLY valid JSON arrays.'
    });

    if (!content) {
      throw new Error('No AI provider available or failed to generate content');
    }
    
    console.log('AI response received, parsing questions...');

    // Parse JSON response
    let questions;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI response as JSON');
    }

    if (!Array.isArray(questions)) {
      throw new Error('AI response is not an array');
    }

    // Insert questions into database
    const questionsToInsert = questions.map((q: any, index: number) => ({
      assessment_id: assessmentId,
      question_text: q.question_text,
      question_type: q.question_type,
      topic: q.topic || 'General',
      difficulty: q.difficulty,
      options: q.options ? JSON.stringify(q.options) : null,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      hints: q.hints || null,
      order_index: index,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('learning_assessment_questions')
      .insert(questionsToInsert);

    if (insertError) {
      console.error('Error inserting questions:', insertError);
      
      // Update assessment status to failed
      await supabaseAdmin
        .from('learning_assessments')
        .update({ status: 'failed' })
        .eq('id', assessmentId);
      
      throw insertError;
    }

    // Update assessment status to published
    await supabaseAdmin
      .from('learning_assessments')
      .update({ status: 'published' })
      .eq('id', assessmentId);

    console.log(`Successfully generated ${questions.length} questions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        questionCount: questions.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in generate-learning-questions:', error);
    
    // Update assessment status to failed if assessmentId is available
    if (assessmentId) {
      await supabaseAdmin
        .from('learning_assessments')
        .update({ status: 'failed' })
        .eq('id', assessmentId);
    }
    
    return new Response(
      JSON.stringify({ error: error?.message || 'An error occurred' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
