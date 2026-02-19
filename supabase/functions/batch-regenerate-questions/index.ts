import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active interviews with insufficient questions
    const { data: interviews, error: fetchError } = await supabase
      .from('interviews')
      .select('id, title, question_count, question_bank_size, job_description, topic_distribution, question_type_distribution, difficulty_distribution, category_difficulty_distribution, coding_schema, experience_level, min_years_experience, questions_status')
      .in('status', ['active', 'pending_review']);

    if (fetchError) {
      console.error('Error fetching interviews:', fetchError);
      throw new Error('Failed to fetch interviews');
    }

    console.log(`Found ${interviews?.length || 0} active interviews to check`);

    const results: { interviewId: string; title: string; status: string; message: string }[] = [];

    for (const interview of interviews || []) {
      // Skip interviews with approved or pending_review questions
      // to prevent overwriting Tech SPOC reviewed content
      if (interview.questions_status === 'approved' || interview.questions_status === 'pending_review') {
        console.log(`Interview "${interview.title}": skipping - questions are ${interview.questions_status}`);
        results.push({
          interviewId: interview.id,
          title: interview.title,
          status: 'skipped',
          message: `Questions are ${interview.questions_status} - not regenerating to preserve review`
        });
        continue;
      }

      // Count current questions
      const { count: currentCount } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('interview_id', interview.id);

      const targetCount = interview.question_bank_size || interview.question_count || 25;
      const questionsNeeded = targetCount - (currentCount || 0);

      console.log(`Interview "${interview.title}": has ${currentCount}, needs ${targetCount}, missing ${questionsNeeded}`);

      if (questionsNeeded <= 0) {
        results.push({
          interviewId: interview.id,
          title: interview.title,
          status: 'skipped',
          message: `Already has ${currentCount} questions (target: ${targetCount})`
        });
        continue;
      }

      try {
        // Call generate-questions to add missing questions
        const { data: generateData, error: generateError } = await supabase.functions.invoke('generate-questions', {
          body: {
            interviewId: interview.id,
            jobDescription: interview.job_description,
            topics: interview.topic_distribution || {},
            questionCount: questionsNeeded,
            questionTypeDistribution: interview.question_type_distribution || {
              mcq: 40,
              scenario: 30,
              coding: 20,
              descriptive: 10
            },
            difficultyDistribution: interview.difficulty_distribution || { easy: 30, medium: 50, hard: 20 },
            categoryDifficultyDistribution: interview.category_difficulty_distribution || null,
            questionBankSize: targetCount,
            previewMode: false,
            codingSchema: interview.coding_schema || null,
            experienceLevel: interview.experience_level || null,
            minYearsExperience: interview.min_years_experience || null,
            _internalCall: true,
            _callerUserId: 'system-batch-regen'
          }
        });

        if (generateError) {
          console.error(`Error generating questions for ${interview.title}:`, generateError);
          results.push({
            interviewId: interview.id,
            title: interview.title,
            status: 'error',
            message: generateError.message || 'Generation failed'
          });
        } else {
          results.push({
            interviewId: interview.id,
            title: interview.title,
            status: 'success',
            message: `Generating ${questionsNeeded} questions`
          });
        }
      } catch (err) {
        console.error(`Exception for ${interview.title}:`, err);
        results.push({
          interviewId: interview.id,
          title: interview.title,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalInterviews: interviews?.length || 0,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Batch regeneration error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
