import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/config.ts";

// Token estimation helper (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topicId, attemptId } = await req.json();

    console.log('Generating certification questions for topic:', topicId, 'attempt:', attemptId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const gatewayApiKey = Deno.env.get('AI_GATEWAY_API_KEY');

    if (!gatewayApiKey) {
      throw new Error('AI_GATEWAY_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch global configuration
    const { data: configData, error: configError } = await supabase
      .from('certification_global_config')
      .select('config')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (configError) throw configError;
    const config = configData.config as any;

    // Fetch certification topic details
    const { data: topic, error: topicError } = await supabase
      .from('certification_topics')
      .select('*')
      .eq('id', topicId)
      .single();

    if (topicError) throw topicError;

    console.log('Topic:', topic.display_name, 'Provider:', topic.provider);

    // Calculate question breakdown - All questions will be MCQ only
    const totalQuestions = config.question_generation.total_questions;
    const difficultyDistribution = config.question_generation.difficulty_distribution;

    const beginnerCount = Math.round(totalQuestions * difficultyDistribution.beginner / 100);
    const intermediateCount = Math.round(totalQuestions * difficultyDistribution.intermediate / 100);
    const advancedCount = totalQuestions - beginnerCount - intermediateCount;

    console.log('Question breakdown (MCQ only):', { totalQuestions, beginnerCount, intermediateCount, advancedCount });

    // Generate questions using AI
    const syllabusTopics = topic.syllabus_topics || [];
    const generatedQuestions: any[] = [];

    // Generate MCQ questions only - distribute across difficulty levels
    const questionsByDifficulty = [
      { difficulty: 'beginner', count: beginnerCount },
      { difficulty: 'intermediate', count: intermediateCount },
      { difficulty: 'advanced', count: advancedCount }
    ];

    let displayOrder = 1;
    
    for (const { difficulty, count } of questionsByDifficulty) {
      for (let i = 0; i < count; i++) {
        const syllabusTopicName = syllabusTopics[(displayOrder - 1) % syllabusTopics.length];
        
        const prompt = `Generate a ${difficulty} level MCQ question for ${topic.provider} ${topic.display_name} certification on topic: ${syllabusTopicName}.

Return ONLY valid JSON (no markdown):
{
  "question_text": "Question here",
  "options": {"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"},
  "correct_answer": "B",
  "explanation": "Detailed explanation"
}`;

        const startTime = Date.now();
        const requestTokens = estimateTokens(prompt) + 50; // ~50 tokens for system prompt
        
        const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
        const aiResponse = await fetch(AI_GATEWAY_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gatewayApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash-lite', // Cost-optimized: ~70% cheaper for question generation
            messages: [
              { role: 'system', content: 'You are an expert certification exam creator. Return only valid JSON, no markdown.' },
              { role: 'user', content: prompt }
            ],
          }),
        });

        const latencyMs = Date.now() - startTime;

        if (!aiResponse.ok) {
          await logAIUsage({
            featureName: 'certification_question_generation',
            success: false,
            modelUsed: config.ai_settings.model,
            requestTokens,
            latencyMs,
            errorMessage: `AI generation failed: ${aiResponse.status}`,
          });
          throw new Error(`AI generation failed: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        let content = aiData.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const questionData = JSON.parse(content);
        const responseTokens = estimateTokens(content);
        
        // Log successful AI usage
        await logAIUsage({
          featureName: 'certification_question_generation',
          success: true,
          modelUsed: 'gemini-2.5-flash-lite',
          requestTokens,
          responseTokens,
          latencyMs,
        });
        
        generatedQuestions.push({
          id: crypto.randomUUID(),
          question_text: questionData.question_text,
          question_type: 'mcq',
          difficulty,
          topic: syllabusTopicName,
          options: questionData.options,
          correct_answer: questionData.correct_answer,
          explanation: questionData.explanation,
          points: 2,
          display_order: displayOrder++
        });
      }
    }

    console.log('Successfully generated', generatedQuestions.length, 'questions');

    // Store questions in the attempt
    const { error: updateError } = await supabase
      .from('certification_attempts')
      .update({ generated_questions: generatedQuestions })
      .eq('id', attemptId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        questions: generatedQuestions,
        count: generatedQuestions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating questions:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to generate questions' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});