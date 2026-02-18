import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = ['partner_admin', 'hr_recruiter'];

serve(async (req) => {
  const logger = createLogger('create-from-template');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ALLOWED_ROLES);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authHeader ? 403 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user, supabase } = authResult;
    const { template_id, title, job_description, customizations } = await req.json();

    logger.info('Creating interview from template', { template_id, userId: user.id });

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('interview_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) throw new Error('Template not found');

    // Apply customizations or use template defaults
    const questionDistribution = customizations?.question_distribution || template.question_distribution;
    const difficultyDistribution = customizations?.difficulty_distribution || template.difficulty_distribution;
    const categoryDifficultyDistribution = customizations?.category_difficulty_distribution || null;
    const timeLimit = customizations?.time_limit || template.recommended_time_limit;

    // Calculate total question count
    const totalQuestions = Object.values(questionDistribution).reduce((sum: number, val: any) => sum + val, 0);

    // Normalize question distribution to percentages for storage
    const questionTypeDistribution = {
      mcq: Math.round((questionDistribution.mcq || 0) / totalQuestions * 100),
      scenario: Math.round((questionDistribution.scenario || 0) / totalQuestions * 100),
      coding: Math.round((questionDistribution.coding || 0) / totalQuestions * 100),
      descriptive: Math.round((questionDistribution.descriptive || 0) / totalQuestions * 100)
    };

    // Generate share link
    const shareLink = crypto.randomUUID().split('-')[0];

    // Create interview with distribution configs
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .insert({
        title: title || template.name,
        job_description,
        role_type: template.role_type,
        seniority_level: template.seniority_level,
        question_count: totalQuestions,
        time_limit: timeLimit,
        status: 'draft',
        share_link: shareLink,
        creator_id: user.id,
        template_id: template_id,
        question_type_distribution: questionTypeDistribution,
        category_difficulty_distribution: categoryDifficultyDistribution,
        difficulty_distribution: difficultyDistribution
      })
      .select()
      .single();

    if (interviewError) throw interviewError;

    // Helper function to determine allowed languages based on topic/skill
    const getAllowedLanguages = (topic: string, questionText: string, questionType: string): string[] | null => {
      if (questionType !== 'coding') {
        return null;
      }
      
      const topicLower = topic.toLowerCase();
      const textLower = questionText.toLowerCase();
      const combinedText = topicLower + ' ' + textLower;
      
      // Java explicitly in topic (but not JavaScript)
      if ((topicLower.includes('java') && !topicLower.includes('javascript')) ||
          topicLower.includes('spring boot') || topicLower.includes('spring framework') ||
          topicLower.includes('hibernate') || topicLower.includes('maven') || topicLower.includes('gradle')) {
        return ['java'];
      }
      
      // Python explicitly in topic
      if (topicLower.includes('python') || topicLower.includes('django') || topicLower.includes('flask') ||
          topicLower.includes('fastapi') || topicLower.includes('pandas') || topicLower.includes('numpy')) {
        return ['python'];
      }
      
      // JavaScript/TypeScript explicitly in topic
      if (topicLower.includes('javascript') || topicLower.includes('typescript') ||
          topicLower.includes('react') || topicLower.includes('node.js') || topicLower.includes('nodejs') ||
          topicLower.includes('angular') || topicLower.includes('vue')) {
        return ['javascript', 'typescript'];
      }
      
      // Go explicitly in topic
      if (topicLower.includes('golang') || topicLower === 'go' || topicLower.includes(' go ')) {
        return ['go'];
      }
      
      // SQL explicitly in topic
      if (topicLower.includes('sql') || topicLower.includes('database') || topicLower.includes('mysql') ||
          topicLower.includes('postgresql') || topicLower.includes('oracle db')) {
        return ['sql'];
      }
      
      // PySpark/Spark explicitly in topic
      if (topicLower.includes('pyspark') || topicLower.includes('spark') || topicLower.includes('databricks')) {
        return ['python'];
      }
      
      // Framework-specific patterns in question text
      if (combinedText.includes('pyspark') || combinedText.includes('sparkcontext') ||
          combinedText.includes('sparksession') || combinedText.includes('rdd')) {
        return ['python'];
      }
      
      // SQL-specific patterns
      if ((combinedText.includes('sql') && (combinedText.includes('query') || combinedText.includes('statement'))) ||
          (combinedText.includes('select') && combinedText.includes('from') && combinedText.includes('where')) ||
          combinedText.includes('create table') || combinedText.includes('insert into') ||
          combinedText.includes('sql query') || combinedText.includes('write a query')) {
        return ['sql'];
      }
      
      // JavaScript framework patterns
      if (combinedText.includes('react') || combinedText.includes('vue') || combinedText.includes('angular') || 
          combinedText.includes('next.js') || combinedText.includes('nextjs') || combinedText.includes('nodejs') ||
          combinedText.includes('express') || combinedText.includes('jsx') || combinedText.includes('npm install')) {
        return ['javascript', 'typescript'];
      }
      
      // Python framework patterns
      if (combinedText.includes('django') || combinedText.includes('flask') || combinedText.includes('fastapi') ||
          combinedText.includes('pandas') || combinedText.includes('numpy') || combinedText.includes('scipy') ||
          combinedText.includes('pytorch') || combinedText.includes('tensorflow') || combinedText.includes('pip install')) {
        return ['python'];
      }
      
      // Java framework patterns
      if (combinedText.includes('spring') || combinedText.includes('hibernate') || 
          combinedText.includes('maven') || combinedText.includes('gradle') || combinedText.includes('.java')) {
        return ['java'];
      }
      
      // Go-specific patterns
      if (combinedText.includes('golang') || combinedText.includes('goroutine') || combinedText.includes('go func')) {
        return ['go'];
      }
      
      // General algorithm/data structure questions - allow multiple languages
      return ['javascript', 'python', 'java'];
    };

    // Fetch questions from question repository based on template criteria
    const questionsToFetch = [];
    
    for (const [type, count] of Object.entries(questionDistribution)) {
      for (const [difficulty, diffCount] of Object.entries(difficultyDistribution)) {
        const numToFetch = Math.round((count as number) * (diffCount as number) / 100);
        if (numToFetch > 0) {
          questionsToFetch.push({ type, difficulty, count: numToFetch });
        }
      }
    }

    // Fetch and create questions
    for (const criteria of questionsToFetch) {
      // Try to get from repository first
      const { data: repoQuestions } = await supabase
        .from('question_repository')
        .select('*')
        .eq('question_type', criteria.type)
        .eq('difficulty', criteria.difficulty)
        .eq('status', 'approved')
        .limit(criteria.count);

      if (repoQuestions && repoQuestions.length > 0) {
        // Use repository questions
        const questionsToInsert = repoQuestions.map((q: any, idx: number) => ({
          interview_id: interview.id,
          question_text: q.question_text,
          question_type: q.question_type,
          difficulty: q.difficulty,
          topic: q.topic,
          options: q.options,
          correct_answer: q.correct_answer,
          order_index: idx,
          allowed_languages: getAllowedLanguages(q.topic || '', q.question_text || '', q.question_type)
        }));

        await supabase.from('questions').insert(questionsToInsert);
      } else {
        // Generate new questions using AI
        const prompt = `Generate ${criteria.count} ${criteria.difficulty} ${criteria.type} interview questions for a ${template.role_type} at ${template.seniority_level} level.

Role: ${template.role_type}
Level: ${template.seniority_level}
Question Type: ${criteria.type}
Difficulty: ${criteria.difficulty}
Job Description: ${job_description}

Return JSON array:
[{
  "question_text": "...",
  "question_type": "${criteria.type}",
  "difficulty": "${criteria.difficulty}",
  "topic": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "A"
}]`;

        try {
          // Use unified AI calling pattern with automatic token logging
          const aiContent = await callAI({
            featureName: 'template_question_generation',
            prompt: prompt,
            systemPrompt: 'You are an expert technical interviewer and question designer. Return only valid JSON.',
            userId: user.id,
          });
          
          const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const generatedQuestions = JSON.parse(jsonMatch[0]);
            
            const questionsToInsert = generatedQuestions.map((q: any, idx: number) => ({
              interview_id: interview.id,
              ...q,
              order_index: idx,
              allowed_languages: getAllowedLanguages(q.topic || '', q.question_text || '', q.question_type || criteria.type)
            }));

            await supabase.from('questions').insert(questionsToInsert);
          }
        } catch (aiError) {
          console.error('Failed to generate questions with AI:', aiError);
        }
      }
    }

    // Update template usage count
    await supabase
      .from('interview_templates')
      .update({ usage_count: (template.usage_count || 0) + 1 })
      .eq('id', template_id);

    // Log activity
    await supabase
      .from('activity_feed')
      .insert({
        organization_id: null,
        actor_id: user.id,
        action: 'created',
        entity_type: 'interview',
        entity_id: interview.id,
        metadata: {
          template_id,
          template_name: template.name
        }
      });

    logger.info('Interview created from template', { interviewId: interview.id });

    return new Response(
      JSON.stringify({
        success: true,
        interview,
        message: 'Interview created successfully from template'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const logger = createLogger('create-from-template');
    logger.error('Error in create-from-template', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
