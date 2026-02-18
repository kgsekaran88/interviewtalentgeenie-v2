import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAIConfig, logAIUsage } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";

// Token estimation helper (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = ['partner_admin', 'hr_recruiter', 'tech_spoc'];

serve(async (req) => {
  const logger = createLogger('add-questions');
  
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
    logger.info('User authorized for add-questions', { userId: user.id });

    const { 
      interviewId, 
      additionalQuestions = 50,
      questionTypeDistribution: inputTypeDistribution,
      difficultyDistribution: inputDifficultyDistribution,
      categoryDifficultyDistribution: inputCategoryDifficultyDistribution
    } = await req.json();

    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('id, job_description, coding_schema, creator_id, organization_id, question_type_distribution, category_difficulty_distribution, difficulty_distribution, experience_level, min_years_experience')
      .eq('id', interviewId)
      .single();

    if (fetchError || !interview) {
      return new Response(
        JSON.stringify({ error: "Interview not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use input distributions or fall back to interview's stored config or defaults
    const questionTypeDistribution = inputTypeDistribution || 
      (interview.question_type_distribution as any) || 
      { mcq: 40, scenario: 30, coding: 20, descriptive: 10 };
    
    const difficultyDistribution = inputDifficultyDistribution || 
      (interview.difficulty_distribution as any) || 
      { easy: 30, medium: 50, hard: 20 };
    
    const categoryDifficultyDistribution = inputCategoryDifficultyDistribution || 
      (interview.category_difficulty_distribution as any) || 
      null;

    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('interview_id', interviewId);

    const currentOrderIndex = count || 0;

    // Build distribution instructions for AI
    const distributionInstructions = categoryDifficultyDistribution 
      ? `
Per-category difficulty distribution:
- MCQ: ${categoryDifficultyDistribution.mcq?.easy || 30}% easy, ${categoryDifficultyDistribution.mcq?.medium || 50}% medium, ${categoryDifficultyDistribution.mcq?.hard || 20}% hard
- Scenario: ${categoryDifficultyDistribution.scenario?.easy || 30}% easy, ${categoryDifficultyDistribution.scenario?.medium || 50}% medium, ${categoryDifficultyDistribution.scenario?.hard || 20}% hard
- Coding: ${categoryDifficultyDistribution.coding?.easy || 30}% easy, ${categoryDifficultyDistribution.coding?.medium || 50}% medium, ${categoryDifficultyDistribution.coding?.hard || 20}% hard
- Descriptive: ${categoryDifficultyDistribution.descriptive?.easy || 30}% easy, ${categoryDifficultyDistribution.descriptive?.medium || 50}% medium, ${categoryDifficultyDistribution.descriptive?.hard || 20}% hard
`
      : `Overall difficulty: ${difficultyDistribution.easy}% easy, ${difficultyDistribution.medium}% medium, ${difficultyDistribution.hard}% hard`;

    // Build experience level context for AI
    const experienceContext = interview.experience_level 
      ? `\nTarget candidate level: ${(interview.experience_level as string).toUpperCase()}${interview.min_years_experience ? ` (${interview.min_years_experience}+ years experience)` : ''}`
      : '';

    const systemPrompt = `You are an expert technical interviewer. Generate ${additionalQuestions} interview questions based on the job description.
${experienceContext}

Question type distribution: ${questionTypeDistribution.mcq}% MCQ, ${questionTypeDistribution.scenario}% scenario, ${questionTypeDistribution.coding}% coding, ${questionTypeDistribution.descriptive}% descriptive.
${distributionInstructions}

${interview.experience_level === 'senior' || interview.experience_level === 'lead' ? 'Focus on architecture, system design, and leadership scenarios.' : ''}
${interview.experience_level === 'junior' || interview.experience_level === 'intern' ? 'Focus on fundamentals and learning-oriented questions.' : ''}

Return ONLY a valid JSON array of questions.`;

    let generatedContent: string | null = null;
    const userContent = `Job Description:\n${interview.job_description}`;
    const startTime = Date.now();
    const requestTokens = estimateTokens(systemPrompt + userContent);

    // Try configured AI provider first
    try {
      const aiConfig = await getAIConfig('question_generation');
      
      if (aiConfig?.primaryProvider?.apiKey) {
        logger.info('Using configured AI provider', { provider: aiConfig.primaryProvider.type });
        
        const response = await fetch(`${aiConfig.primaryProvider.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${aiConfig.primaryProvider.apiKey}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            model: aiConfig.primaryProvider.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent }
            ],
            max_tokens: 4000
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          generatedContent = data.choices[0].message.content;
          const latencyMs = Date.now() - startTime;
          const usage = data.usage;
          const actualRequestTokens = usage?.prompt_tokens || requestTokens;
          const actualResponseTokens = usage?.completion_tokens || estimateTokens(generatedContent || '');
          
          await logAIUsage({
            featureName: 'question_generation',
            success: true,
            providerId: aiConfig.primaryProvider.type,
            modelUsed: aiConfig.primaryProvider.model,
            requestTokens: actualRequestTokens,
            responseTokens: actualResponseTokens,
            latencyMs,
            organizationId: interview.organization_id,
            userId: user.id,
            interviewId: interview.id,
          });
          logger.info(`Question generation success (${latencyMs}ms, ~${actualRequestTokens + actualResponseTokens} tokens)`);
        } else {
          throw new Error(`Provider failed: ${response.status}`);
        }
      }
    } catch (configError) {
      logger.info('No AI configuration found or configured provider failed');
    }

    // Use AI Gateway if no configuration exists or provider failed
    if (!generatedContent) {
      logger.info('Using AI Gateway');
      const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
      if (!AI_GATEWAY_API_KEY) throw new Error('No AI provider available');
      
      const gatewayStartTime = Date.now();
      const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
      const response = await fetch(AI_GATEWAY_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash-lite', // Cost-optimized: ~70% cheaper for question generation
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          max_tokens: 4000
        })
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Try adding fewer questions or wait a moment." }), 
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`AI Gateway failed: ${response.status}`);
      }
      
      const data = await response.json();
      generatedContent = data.choices[0].message.content;
      const latencyMs = Date.now() - gatewayStartTime;
      const usage = data.usage;
      const actualRequestTokens = usage?.prompt_tokens || requestTokens;
      const actualResponseTokens = usage?.completion_tokens || estimateTokens(generatedContent || '');
      
      await logAIUsage({
        featureName: 'question_generation',
        success: true,
        modelUsed: 'gemini-2.5-flash-lite',
        fallbackUsed: true,
        requestTokens: actualRequestTokens,
        responseTokens: actualResponseTokens,
        latencyMs,
        organizationId: interview.organization_id,
        userId: user.id,
        interviewId: interview.id,
      });
      logger.info(`AI Gateway success (${latencyMs}ms, ~${actualRequestTokens + actualResponseTokens} tokens)`);
    }

    if (!generatedContent) {
      throw new Error('No AI provider available or failed to generate content');
    }

    const jsonMatch = generatedContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse questions from AI response');
    }
    
    const rawQuestions = JSON.parse(jsonMatch[0].replace(/,(\s*[}\]])/g, '$1'));

    // ============ PRE-INSERT DEDUPLICATION ============
    const normalizeForDedup = (text: string): string => {
      if (!text) return '';
      return text.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').substring(0, 300);
    };

    const seenTexts = new Set<string>();
    const newQuestions: any[] = [];
    
    for (const question of rawQuestions) {
      const normalizedText = normalizeForDedup(question.question_text || '');
      if (!normalizedText || seenTexts.has(normalizedText)) continue;
      seenTexts.add(normalizedText);
      newQuestions.push(question);
    }
    
    console.log(`Deduplication: ${rawQuestions.length} generated, ${newQuestions.length} unique`);

    // Helper function to determine allowed languages based on topic/skill
    const getAllowedLanguages = (topic: string, questionText: string, questionType: string): string[] | null => {
      if (questionType !== 'coding') {
        return null;
      }
      
      const topicLower = topic.toLowerCase();
      const textLower = questionText.toLowerCase();
      const combinedText = topicLower + ' ' + textLower;
      
      // PRIORITY 1: Check topic explicitly mentions a programming language
      
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
      
      // PRIORITY 2: If topic doesn't specify, check question text for framework-specific patterns
      
      // PySpark/Spark patterns
      if (combinedText.includes('pyspark') || combinedText.includes('sparkcontext') ||
          combinedText.includes('sparksession') || combinedText.includes('rdd')) {
        return ['python'];
      }
      
      // SQL-specific patterns (more strict)
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

    const questionsToInsert = newQuestions.map((q: any, index: number) => {
      const questionType = q.question_type || 'descriptive';
      return {
        interview_id: interviewId,
        question_text: q.question_text,
        topic: q.topic,
        difficulty: q.difficulty,
        question_type: questionType,
        options: q.options || [],
        correct_answer: q.correct_answer,
        order_index: currentOrderIndex + index + 1,
        allowed_languages: getAllowedLanguages(q.topic || '', q.question_text || '', questionType),
      };
    });

    const { error: insertError } = await supabase
      .from('questions')
      .insert(questionsToInsert);

    if (insertError) {
      throw new Error('Failed to store questions in database');
    }

    logger.info(`Successfully added ${newQuestions.length} questions`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      addedCount: newQuestions.length,
      totalQuestions: currentOrderIndex + newQuestions.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    logger.error('Error in add-questions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
