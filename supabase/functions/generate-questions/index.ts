import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { getAIConfig, logAIUsage } from "../_shared/config.ts";
import { corsHeaders } from '../_shared/cors.ts';


// Helper to calculate per-category difficulty counts
function calculateCategoryDifficultyCounts(
  questionBankSize: number,
  questionTypeDistribution: { mcq: number; scenario: number; coding: number; descriptive: number },
  categoryDifficultyDistribution?: {
    mcq: { easy: number; medium: number; hard: number };
    scenario: { easy: number; medium: number; hard: number };
    coding: { easy: number; medium: number; hard: number };
    descriptive: { easy: number; medium: number; hard: number };
  },
  difficultyDistribution?: { easy: number; medium: number; hard: number }
) {
  // questionTypeDistribution contains COUNTS for a single interview (e.g., {mcq: 11, coding: 2, scenario: 1, descriptive: 1} = 15 questions)
  // We need to scale these proportionally to the questionBankSize (e.g., 200 questions)
  const typeTotal = (questionTypeDistribution.mcq || 0) + 
                    (questionTypeDistribution.scenario || 0) + 
                    (questionTypeDistribution.coding || 0) + 
                    (questionTypeDistribution.descriptive || 0);
  
  // Convert counts to percentages based on the interview question count total
  const mcqPct = typeTotal > 0 ? ((questionTypeDistribution.mcq || 0) / typeTotal) * 100 : 0;
  const scenarioPct = typeTotal > 0 ? ((questionTypeDistribution.scenario || 0) / typeTotal) * 100 : 0;
  const codingPct = typeTotal > 0 ? ((questionTypeDistribution.coding || 0) / typeTotal) * 100 : 0;
  const descriptivePct = typeTotal > 0 ? ((questionTypeDistribution.descriptive || 0) / typeTotal) * 100 : 0;
  
  console.log(`Input type counts: mcq=${questionTypeDistribution.mcq}, scenario=${questionTypeDistribution.scenario}, coding=${questionTypeDistribution.coding}, descriptive=${questionTypeDistribution.descriptive} (total=${typeTotal})`);
  console.log(`Converted to percentages: mcq=${mcqPct.toFixed(1)}%, scenario=${scenarioPct.toFixed(1)}%, coding=${codingPct.toFixed(1)}%, descriptive=${descriptivePct.toFixed(1)}%`);
  
  // Apply percentages to questionBankSize to get counts for the bank
  const totalMCQ = Math.round(questionBankSize * mcqPct / 100);
  const totalScenario = Math.round(questionBankSize * scenarioPct / 100);
  const totalCoding = Math.round(questionBankSize * codingPct / 100);
  const totalDescriptive = questionBankSize - totalMCQ - totalScenario - totalCoding;
  
  console.log(`Question bank counts (${questionBankSize} total): MCQ=${totalMCQ}, Scenario=${totalScenario}, Coding=${totalCoding}, Descriptive=${totalDescriptive}`);

  let easyMCQ, mediumMCQ, hardMCQ;
  let easyScenario, mediumScenario, hardScenario;
  let easyCoding, mediumCoding, hardCoding;
  let easyDescriptive, mediumDescriptive, hardDescriptive;

  // Use per-category difficulty if provided, otherwise fall back to overall distribution
  if (categoryDifficultyDistribution) {
    // Per-category difficulty: each type has its own easy/medium/hard distribution
    easyMCQ = Math.round(totalMCQ * categoryDifficultyDistribution.mcq.easy / 100);
    mediumMCQ = Math.round(totalMCQ * categoryDifficultyDistribution.mcq.medium / 100);
    hardMCQ = totalMCQ - easyMCQ - mediumMCQ;

    easyScenario = Math.round(totalScenario * categoryDifficultyDistribution.scenario.easy / 100);
    mediumScenario = Math.round(totalScenario * categoryDifficultyDistribution.scenario.medium / 100);
    hardScenario = totalScenario - easyScenario - mediumScenario;

    easyCoding = Math.round(totalCoding * categoryDifficultyDistribution.coding.easy / 100);
    mediumCoding = Math.round(totalCoding * categoryDifficultyDistribution.coding.medium / 100);
    hardCoding = totalCoding - easyCoding - mediumCoding;

    easyDescriptive = Math.round(totalDescriptive * categoryDifficultyDistribution.descriptive.easy / 100);
    mediumDescriptive = Math.round(totalDescriptive * categoryDifficultyDistribution.descriptive.medium / 100);
    hardDescriptive = totalDescriptive - easyDescriptive - mediumDescriptive;
  } else if (difficultyDistribution) {
    // Legacy: overall difficulty distribution applied proportionally to each type
    const easyCount = Math.round((questionBankSize * difficultyDistribution.easy) / 100);
    const mediumCount = Math.round((questionBankSize * difficultyDistribution.medium) / 100);
    const hardCount = questionBankSize - easyCount - mediumCount;

    if (questionTypeDistribution.mcq === 100) {
      easyMCQ = easyCount; mediumMCQ = mediumCount; hardMCQ = hardCount;
    } else if (questionTypeDistribution.mcq === 0) {
      easyMCQ = 0; mediumMCQ = 0; hardMCQ = 0;
    } else {
      easyMCQ = Math.round((easyCount * questionTypeDistribution.mcq) / 100);
      mediumMCQ = Math.round((mediumCount * questionTypeDistribution.mcq) / 100);
      hardMCQ = totalMCQ - easyMCQ - mediumMCQ;
    }

    if (questionTypeDistribution.scenario === 100) {
      easyScenario = easyCount; mediumScenario = mediumCount; hardScenario = hardCount;
    } else if (questionTypeDistribution.scenario === 0) {
      easyScenario = 0; mediumScenario = 0; hardScenario = 0;
    } else {
      easyScenario = Math.round((easyCount * questionTypeDistribution.scenario) / 100);
      mediumScenario = Math.round((mediumCount * questionTypeDistribution.scenario) / 100);
      hardScenario = totalScenario - easyScenario - mediumScenario;
    }

    if (questionTypeDistribution.coding === 100) {
      easyCoding = easyCount; mediumCoding = mediumCount; hardCoding = hardCount;
    } else if (questionTypeDistribution.coding === 0) {
      easyCoding = 0; mediumCoding = 0; hardCoding = 0;
    } else {
      easyCoding = Math.round((easyCount * questionTypeDistribution.coding) / 100);
      mediumCoding = Math.round((mediumCount * questionTypeDistribution.coding) / 100);
      hardCoding = totalCoding - easyCoding - mediumCoding;
    }

    easyDescriptive = easyCount - easyMCQ - easyScenario - easyCoding;
    mediumDescriptive = mediumCount - mediumMCQ - mediumScenario - mediumCoding;
    hardDescriptive = hardCount - hardMCQ - hardScenario - hardCoding;
  } else {
    // Default: balanced distribution
    easyMCQ = Math.round(totalMCQ * 0.3);
    mediumMCQ = Math.round(totalMCQ * 0.5);
    hardMCQ = totalMCQ - easyMCQ - mediumMCQ;

    easyScenario = Math.round(totalScenario * 0.25);
    mediumScenario = Math.round(totalScenario * 0.5);
    hardScenario = totalScenario - easyScenario - mediumScenario;

    easyCoding = Math.round(totalCoding * 0.25);
    mediumCoding = Math.round(totalCoding * 0.5);
    hardCoding = totalCoding - easyCoding - mediumCoding;

    easyDescriptive = Math.round(totalDescriptive * 0.25);
    mediumDescriptive = Math.round(totalDescriptive * 0.5);
    hardDescriptive = totalDescriptive - easyDescriptive - mediumDescriptive;
  }

  return {
    totalMCQ, totalScenario, totalCoding, totalDescriptive,
    easyMCQ, mediumMCQ, hardMCQ,
    easyScenario, mediumScenario, hardScenario,
    easyCoding, mediumCoding, hardCoding,
    easyDescriptive, mediumDescriptive, hardDescriptive
  };
}

// Background task function for generating questions
async function generateQuestionsBackground(params: any) {
  const {
    interviewId,
    jobDescription,
    topics,
    questionCount,
    questionTypeDistribution,
    difficultyDistribution,
    categoryDifficultyDistribution,
    questionBankSize,
    codingSchema,
    requiredQuestionRules,
    organizationId,
    userId,
    experienceLevel,
    minYearsExperience
  } = params;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const startTime = Date.now();
  const MAX_EXECUTION_TIME_MS = 270000; // 4.5 minutes (leave buffer before 5min timeout)

  // Log operation start
  let operationLogId: string | null = null;
  try {
    const { data: logData } = await supabase
      .from('interview_operation_logs')
      .insert({
        operation: 'question_generation',
        status: 'started',
        interview_id: interviewId,
        metadata: { questionBankSize, questionCount, questionTypeDistribution },
        started_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    operationLogId = logData?.id || null;
  } catch (logErr) {
    console.error('[OperationLog] Failed to start log:', logErr);
  }

  try {
    console.log('Background generation started for interview:', interviewId);

    // Delete existing questions for this interview to avoid accumulation
    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .eq('interview_id', interviewId);

    if (deleteError) {
      console.error('Error deleting old questions:', deleteError);
      throw new Error(`Failed to delete old questions: ${deleteError.message}`);
    }

    console.log('Deleted existing questions for interview:', interviewId);

    // Update status to generating
    await supabase
      .from('interviews')
      .update({ 
        generation_status: 'generating',
        generation_error: null 
      })
      .eq('id', interviewId);

    // Calculate per-category difficulty counts
    const counts = calculateCategoryDifficultyCounts(
      questionBankSize,
      questionTypeDistribution,
      categoryDifficultyDistribution,
      difficultyDistribution
    );
    
    const {
      totalMCQ, totalScenario, totalCoding, totalDescriptive,
      easyMCQ, mediumMCQ, hardMCQ,
      easyScenario, mediumScenario, hardScenario,
      easyCoding, mediumCoding, hardCoding,
      easyDescriptive, mediumDescriptive, hardDescriptive
    } = counts;

    // Check AI configuration
    const previewAiConfig = await getAIConfig('question_generation');
    const usePreviewConfiguredAI = previewAiConfig?.primaryProvider !== null;
    
    // Fallback to environment variable if no configuration
    const PREVIEW_GEMINI_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    const PREVIEW_GATEWAY_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    
    if (!usePreviewConfiguredAI && !PREVIEW_GEMINI_KEY && !PREVIEW_GATEWAY_KEY) {
      throw new Error('No AI provider configured. Please add API keys in AI Configuration settings.');
    }
    
    console.log(`Using ${usePreviewConfiguredAI ? 'configured AI provider from AI Configuration Hub' : 'fallback environment variables'} for question preview`);

    // Generate a unique seed for each generation run to encourage variety
    const generationSeed = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    
    const systemPrompt = `You are an expert technical interviewer. Generate high-quality, job-relevant interview questions from the job description.

**CANDIDATE EXPERIENCE LEVEL CONTEXT:**
${experienceLevel ? `- This role is for a ${experienceLevel.toUpperCase()} level candidate` : '- Experience level not specified, assume mid-level'}
${minYearsExperience !== null ? `- Required experience: ${minYearsExperience}+ years` : ''}
${experienceLevel === 'senior' || experienceLevel === 'lead' || experienceLevel === 'principal' ? `
SENIOR-LEVEL QUESTION GUIDELINES:
- Focus on architecture decisions, system design, and trade-off analysis
- Include questions about mentoring, code reviews, and technical leadership
- Ask about handling ambiguity, stakeholder management, and cross-team collaboration
- Test deep expertise rather than basic knowledge
- Include scenario-based questions involving production incidents and scaling challenges
` : ''}
${experienceLevel === 'junior' || experienceLevel === 'intern' ? `
JUNIOR-LEVEL QUESTION GUIDELINES:
- Focus on fundamental concepts and core technical skills
- Include questions that test learning ability and problem-solving approach
- Ask about basic debugging, code reading, and simple implementations
- Avoid questions requiring extensive production experience
- Include questions about best practices and clean code principles
` : ''}
${experienceLevel === 'mid' ? `
MID-LEVEL QUESTION GUIDELINES:
- Balance between fundamentals and intermediate complexity
- Include questions about code quality, testing, and debugging
- Test ability to work independently on features
- Include some system design basics and integration concepts
` : ''}

CRITICAL DIVERSITY REQUIREMENT:
- This generation run has ID: ${generationSeed}
- You MUST generate UNIQUE questions that are DIFFERENT from typical interview questions
- DO NOT use common question patterns like "What is X?" or "Explain Y" - be creative!
- Each question should test a DIFFERENT concept, scenario, or skill
- Use varied question structures: case studies, debugging scenarios, trade-off analysis, architecture decisions, code reviews, etc.
- Include specific context, numbers, constraints, or real-world scenarios to make questions unique

GENERAL INSTRUCTIONS:
- The batch prompt will specify EXACTLY how many questions to generate in this batch and the required distribution. Follow it exactly.
- Questions should vary in complexity and cover a wide range of relevant topics.
- Each question should be clear, specific, and job-relevant.
- NEVER generate similar questions - each must test a distinctly different aspect
- ALIGN question complexity with the candidate's experience level

${topics && Object.keys(topics).length > 0 ? `- Focus on these topics: ${JSON.stringify(topics)}` : '- Topics should be derived from the job description'}

${requiredQuestionRules && requiredQuestionRules.length > 0 ? `
**MANDATORY TOPIC-SPECIFIC QUESTION RULES:**
You MUST ensure the question bank includes these specific questions:
${requiredQuestionRules.map((rule: any) => `- At least ${rule.min} ${rule.difficulty} ${rule.type} question(s)${rule.topic ? ` specifically about "${rule.topic}"` : ''}`).join('\n')}

For topic-specific rules:
- The "topic" field in the generated question MUST exactly match or closely relate to the specified topic
- For example, if rule says "Java coding question", generate a question where topic is "Java" (not SQL, not JavaScript)
- Prioritize these required questions in the generation
` : ''}

QUESTION TYPES EXPLAINED:
- MCQ (Multiple Choice): Standard 4-option questions with one correct answer
- SCENARIO-BASED: Real-world situation requiring analysis and solution (can be MCQ or descriptive)
- CODING: Programming problems, algorithms, SQL queries, or code debugging challenges
- DESCRIPTIVE: Open-ended questions requiring detailed written responses

${codingSchema ? `
**DATABASE SCHEMA FOR SQL/CODING QUESTIONS:**
Use the following pre-defined schema for ALL SQL-related questions:
${JSON.stringify(codingSchema, null, 2)}
For coding questions using this schema, set "coding_schema" to this exact schema.
` : `
**CRITICAL: CODING QUESTION SCHEMA REQUIREMENT:**
For EVERY coding/SQL question, you MUST generate a relevant database schema.
- The schema must be relevant to the job domain and the specific question
- Include realistic table names, columns with appropriate data types
- Include sample data context if helpful
- DO NOT use generic placeholder tables - make them domain-specific
- The schema should contain 2-5 tables that are relevant to the question

Example coding_schema format:
{
  "tables": [
    {
      "name": "table_name",
      "columns": [
        {"name": "id", "type": "INT", "constraints": "PRIMARY KEY"},
        {"name": "column_name", "type": "VARCHAR(100)", "constraints": "NOT NULL"}
      ]
    }
  ],
  "sample_data_hint": "Brief description of what data exists"
}
`}

FORMAT RULES:
- For MULTIPLE CHOICE and SCENARIO-BASED MCQ questions:
  * Provide exactly 4 options in the "options" array
  * Set "correct_answer" to the EXACT text of the correct option
  * Options must be realistic and plausible
  * Set "coding_schema" to null

- For DESCRIPTIVE questions:
  * Set "options" to an empty array []
  * Set "correct_answer" to key points/guidance for expected answer
  * Set "coding_schema" to null

- For CODING questions:
  * Set "options" to an empty array []
  * Set "correct_answer" to expected approach and solution
  * MUST set "coding_schema" to a relevant database schema object (NEVER null for coding questions)
  * CRITICAL: The question_text MUST reference table names that exist in the coding_schema you generate
  * The question and schema MUST be coherent - generate the schema FIRST, then write a question that uses those exact table names

CRITICAL OUTPUT REQUIREMENT:
YOU MUST RETURN ONLY THE JSON ARRAY - NO EXPLANATIONS, NO MARKDOWN, NO CODE BLOCKS.
DO NOT wrap the response in markdown code blocks.
DO NOT add any text before or after the JSON array.
START your response with [ and END with ].
The array length MUST exactly equal the batch question count requested in the batch prompt.

Return ONLY a valid JSON array of objects with this shape:
[{
  "question_text": "Question here",
  "topic": "Topic name from job description",
  "difficulty": "easy|medium|hard",
  "question_type": "mcq|scenario|coding|descriptive",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"] or [],
  "correct_answer": "Exact option text or key points",
  "coding_schema": null | { "tables": [...], "sample_data_hint": "..." }
}]`;

    // SPLIT STRATEGY: Coding questions = 3 per batch, Non-coding = 5 per batch
    const CODING_BATCH_SIZE = 3;
    const NON_CODING_BATCH_SIZE = 5;
    const CODING_CONCURRENT = 15; // More parallel for single-question batches
    const NON_CODING_CONCURRENT = 10;
    
    const totalCodingQuestions = easyCoding + mediumCoding + hardCoding;
    const totalNonCoding = questionBankSize - totalCodingQuestions;
    
    console.log(`Split generation: ${totalCodingQuestions} coding questions (1/batch, ${CODING_CONCURRENT} parallel), ${totalNonCoding} non-coding (5/batch, ${NON_CODING_CONCURRENT} parallel)`);

    // Function to call AI following the configuration-first pattern
    async function callAIWithFallback(prompt: string, batchNumber: number | string): Promise<string> {
      console.log(`Batch ${batchNumber} - Starting AI call...`);
      
      try {
        const content = await callAI({
          featureName: 'question_generation',
          prompt: prompt,
          systemPrompt: 'You are an expert technical interviewer.',
          organizationId,
          userId,
          interviewId
        });
        
        console.log(`Batch ${batchNumber} - Success`);
        return content;
      } catch (error) {
        console.error(`Batch ${batchNumber} - AI call failed:`, error);
        throw error;
      }
    }

    const allQuestionsBatches: any[] = [];
    let questionDeficit = 0;
    
    // Robust JSON extraction - extracts as many complete questions as possible
    function extractCompleteQuestions(jsonString: string, batchNum: number | string): { questions: any[]; extracted: number } {
      // Strategy 1: Direct parse
      try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
          return { questions: parsed, extracted: parsed.length };
        }
      } catch (e) {
        // Continue to recovery strategies
      }
      
      // Strategy 2: Find balanced JSON objects by tracking brace depth
      const questions: any[] = [];
      let objectStart = -1;
      let braceDepth = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\' && inString) {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (inString) continue;
        
        if (char === '{') {
          if (braceDepth === 0) {
            objectStart = i;
          }
          braceDepth++;
        } else if (char === '}') {
          braceDepth--;
          if (braceDepth === 0 && objectStart !== -1) {
            const objectStr = jsonString.substring(objectStart, i + 1);
            try {
              const obj = JSON.parse(objectStr);
              if (obj.question_text && obj.topic && obj.difficulty && obj.question_type) {
                questions.push(obj);
              }
            } catch (parseErr) {
              console.warn(`Batch ${batchNum} - Skipped malformed object at position ${objectStart}`);
            }
            objectStart = -1;
          }
        }
      }
      
      if (questions.length > 0) {
        console.log(`Batch ${batchNum} - Extracted ${questions.length} complete questions`);
      }
      
      return { questions, extracted: questions.length };
    }
    
    // Helper to process a single AI batch
    async function processBatch(
      batchId: string,
      prompt: string,
      expectedCount: number,
      delayMs: number = 0
    ): Promise<any[]> {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      try {
        const content = await callAIWithFallback(prompt, batchId);
        
        let jsonString = content.trim()
          .replace(/```json\s*/g, '').replace(/```\s*$/g, '').replace(/```/g, '');
        
        const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error(`Batch ${batchId} - No JSON array found`);
          questionDeficit += expectedCount;
          return [];
        }
        
        jsonString = jsonMatch[0]
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
          .replace(/,\s*,/g, ',');
        
        const { questions } = extractCompleteQuestions(jsonString, batchId);
        
        if (questions.length === 0) {
          questionDeficit += expectedCount;
          return [];
        }
        
        const shortfall = expectedCount - questions.length;
        if (shortfall > 0) {
          questionDeficit += shortfall;
          console.warn(`Batch ${batchId} - Got ${questions.length}/${expectedCount}, deficit: ${questionDeficit}`);
        }
        
        return questions;
      } catch (error: any) {
        console.error(`Batch ${batchId} - Error:`, error.message);
        questionDeficit += expectedCount;
        return [];
      }
    }

    // ============ PHASE 1: Generate CODING questions (1 per batch, 15 parallel) ============
    if (totalCodingQuestions > 0) {
      console.log(`\n=== PHASE 1: Generating ${totalCodingQuestions} CODING questions (1 per batch) ===`);
      
      // Build list of coding questions to generate with their difficulties and topics
      const codingTasks: { difficulty: string; topic?: string }[] = [];
      
      // Required rules define % within type, not fixed counts
      // E.g., if rules say 1 Java + 1 Spring Boot out of 2 coding = 50% each
      // For bank with 27 coding questions: 14 Java + 13 Spring Boot
      const codingRules = (requiredQuestionRules || []).filter((r: any) => r.type === 'coding');
      
      // Calculate total from coding rules to determine percentages
      const totalFromRules = codingRules.reduce((sum: number, r: any) => sum + (r.min || 0), 0);
      
      if (totalFromRules > 0 && codingRules.length > 0) {
        console.log(`Scaling ${codingRules.length} coding rules from ${totalFromRules} to ${totalCodingQuestions} questions`);
        
        // Track how many we've assigned by difficulty
        const assignedByDifficulty = { easy: 0, medium: 0, hard: 0 };
        const targetByDifficulty = { easy: easyCoding, medium: mediumCoding, hard: hardCoding };
        
        // Scale each rule proportionally
        let assignedTotal = 0;
        for (let ruleIdx = 0; ruleIdx < codingRules.length; ruleIdx++) {
          const rule = codingRules[ruleIdx];
          const rulePercentage = (rule.min || 0) / totalFromRules;
          
          // For last rule, assign remaining to avoid rounding issues
          const isLastRule = ruleIdx === codingRules.length - 1;
          const scaledCount = isLastRule 
            ? targetByDifficulty[rule.difficulty as keyof typeof targetByDifficulty] - assignedByDifficulty[rule.difficulty as keyof typeof assignedByDifficulty]
            : Math.round(targetByDifficulty[rule.difficulty as keyof typeof targetByDifficulty] * rulePercentage);
          
          const countToAdd = Math.max(0, scaledCount);
          
          for (let i = 0; i < countToAdd; i++) {
            codingTasks.push({ difficulty: rule.difficulty, topic: rule.topic });
          }
          
          assignedByDifficulty[rule.difficulty as keyof typeof assignedByDifficulty] += countToAdd;
          assignedTotal += countToAdd;
          
          console.log(`Rule: ${rule.min} ${rule.difficulty} ${rule.topic || 'any'} -> scaled to ${countToAdd} questions`);
        }
        
        // Fill any remaining slots (in case rules don't cover all difficulties)
        const remainingEasy = Math.max(0, easyCoding - assignedByDifficulty.easy);
        const remainingMedium = Math.max(0, mediumCoding - assignedByDifficulty.medium);
        const remainingHard = Math.max(0, hardCoding - assignedByDifficulty.hard);
        
        for (let i = 0; i < remainingEasy; i++) codingTasks.push({ difficulty: 'easy' });
        for (let i = 0; i < remainingMedium; i++) codingTasks.push({ difficulty: 'medium' });
        for (let i = 0; i < remainingHard; i++) codingTasks.push({ difficulty: 'hard' });
      } else {
        // No coding rules, distribute by difficulty only
        for (let i = 0; i < easyCoding; i++) codingTasks.push({ difficulty: 'easy' });
        for (let i = 0; i < mediumCoding; i++) codingTasks.push({ difficulty: 'medium' });
        for (let i = 0; i < hardCoding; i++) codingTasks.push({ difficulty: 'hard' });
      }
      
      console.log(`Coding tasks: ${codingTasks.length} total (scaled from ${codingRules.length} rules)`);
      
      // Shuffle for variety (but keep required rules distributed)
      codingTasks.sort(() => Math.random() - 0.5);
      
      for (let groupStart = 0; groupStart < codingTasks.length; groupStart += CODING_CONCURRENT) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
          console.warn('Timeout during coding phase');
          break;
        }
        
        const groupEnd = Math.min(groupStart + CODING_CONCURRENT, codingTasks.length);
        const promises = [];
        
        for (let i = groupStart; i < groupEnd; i++) {
          const task = codingTasks[i];
          const batchSeed = `${generationSeed}-C${i + 1}`;
          const topicInstruction = task.topic 
            ? `\n\n**MANDATORY TOPIC: This question MUST be specifically about "${task.topic}". The "topic" field in your response MUST be "${task.topic}".**`
            : '';
          
          const codingPrompt = `[BATCH ${i + 1} of ${codingTasks.length} | Seed: ${batchSeed}]

Generate exactly 1 ${task.difficulty} CODING question.
This is a programming/SQL question that requires writing code.${topicInstruction}

UNIQUENESS REQUIREMENT FOR THIS BATCH:
- This is batch ${i + 1} - generate a question that would NOT be in other batches
- Use a UNIQUE scenario: real business case, specific algorithm, data transformation, or system design
- Vary the coding challenge type: data processing, API design, query optimization, bug fixing, refactoring, etc.
- Include specific constraints or edge cases that make this question distinctive

IMPORTANT:
- question_type MUST be "coding"
- Include a relevant coding_schema with database tables
- Keep the schema focused (2-3 tables max)
- correct_answer should be a brief approach description

OUTPUT: Return ONLY a JSON array with 1 question object.

Job Description:\n${jobDescription}`;

          const fullPrompt = `${systemPrompt}\n\n${codingPrompt}`;
          promises.push(processBatch(`C${i + 1}`, fullPrompt, 1, (i - groupStart) * 200));
        }
        
        console.log(`Coding group ${Math.floor(groupStart / CODING_CONCURRENT) + 1}: processing ${promises.length} batches...`);
        const results = await Promise.all(promises);
        results.forEach(qs => { if (qs.length > 0) allQuestionsBatches.push(qs); });
        
        if (groupEnd < codingTasks.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`Coding phase complete. Generated so far: ${allQuestionsBatches.flat().length}`);
    }

    // ============ PHASE 2: Generate NON-CODING questions (5 per batch, 10 parallel) ============
    if (totalNonCoding > 0) {
      console.log(`\n=== PHASE 2: Generating ${totalNonCoding} NON-CODING questions (5 per batch) ===`);
      
      const nonCodingBatches = Math.ceil(totalNonCoding / NON_CODING_BATCH_SIZE);
      
      // Distribute non-coding types across batches
      const nonCodingDist = {
        easyMCQ, mediumMCQ, hardMCQ,
        easyScenario, mediumScenario, hardScenario,
        easyDescriptive, mediumDescriptive, hardDescriptive
      };
      
      for (let groupStart = 0; groupStart < nonCodingBatches; groupStart += NON_CODING_CONCURRENT) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
          console.warn('Timeout during non-coding phase');
          break;
        }
        
        const groupEnd = Math.min(groupStart + NON_CODING_CONCURRENT, nonCodingBatches);
        const promises = [];
        
        for (let i = groupStart; i < groupEnd; i++) {
          const batchCount = Math.min(NON_CODING_BATCH_SIZE, totalNonCoding - (i * NON_CODING_BATCH_SIZE));
          if (batchCount <= 0) continue;
          
          // Proportional distribution per batch
          const batchEasyMCQ = Math.round(easyMCQ / nonCodingBatches);
          const batchMediumMCQ = Math.round(mediumMCQ / nonCodingBatches);
          const batchHardMCQ = Math.round(hardMCQ / nonCodingBatches);
          const batchEasyScenario = Math.round(easyScenario / nonCodingBatches);
          const batchMediumScenario = Math.round(mediumScenario / nonCodingBatches);
          const batchHardScenario = Math.round(hardScenario / nonCodingBatches);
          const batchEasyDesc = Math.round(easyDescriptive / nonCodingBatches);
          const batchMediumDesc = Math.round(mediumDescriptive / nonCodingBatches);
          const batchHardDesc = Math.round(hardDescriptive / nonCodingBatches);
          
          const batchSeed = `${generationSeed}-NC${i + 1}`;
          const nonCodingPrompt = `[BATCH ${i + 1} of ${nonCodingBatches} | Seed: ${batchSeed}]

Generate exactly ${batchCount} NON-CODING questions (NO coding questions).

UNIQUENESS REQUIREMENT FOR THIS BATCH:
- This is batch ${i + 1} of ${nonCodingBatches} - generate questions DIFFERENT from what other batches would produce
- For MCQ: Use unique scenarios, edge cases, misconceptions, or comparison questions
- For Scenario: Create distinct business situations, team conflicts, technical challenges, or system failures
- For Descriptive: Ask about specific techniques, trade-offs, architecture decisions, or process improvements
- AVOID generic questions like "What is X?" - instead ask "When would you choose X over Y?" or "Describe a situation where..."

Distribution target:
- ${batchEasyMCQ} easy MCQ, ${batchMediumMCQ} medium MCQ, ${batchHardMCQ} hard MCQ
- ${batchEasyScenario} easy scenario, ${batchMediumScenario} medium scenario, ${batchHardScenario} hard scenario  
- ${batchEasyDesc} easy descriptive, ${batchMediumDesc} medium descriptive, ${batchHardDesc} hard descriptive

IMPORTANT:
- question_type must be "mcq", "scenario", or "descriptive" (NOT coding)
- coding_schema must be null for all questions
- MCQ must have exactly 4 options

OUTPUT: Return ONLY a JSON array with ${batchCount} questions.

Job Description:\n${jobDescription}`;

          const fullPrompt = `${systemPrompt}\n\n${nonCodingPrompt}`;
          promises.push(processBatch(`NC${i + 1}`, fullPrompt, batchCount, (i - groupStart) * 300));
        }
        
        console.log(`Non-coding group ${Math.floor(groupStart / NON_CODING_CONCURRENT) + 1}: processing ${promises.length} batches...`);
        const results = await Promise.all(promises);
        results.forEach(qs => { if (qs.length > 0) allQuestionsBatches.push(qs); });
        
        if (groupEnd < nonCodingBatches) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`Non-coding phase complete. Total generated: ${allQuestionsBatches.flat().length}`);
    }
    
    // ============ PHASE 3: MAKEUP BATCHES for any deficit ============
    if (questionDeficit > 0) {
      console.log(`\n=== PHASE 3: MAKEUP - Need ${questionDeficit} additional questions ===`);
      
      const MAKEUP_BATCH_SIZE = 3; // Small batches for reliable makeup
      const makeupBatchCount = Math.ceil(questionDeficit / MAKEUP_BATCH_SIZE);
      let remainingDeficit = questionDeficit;
      
      for (let m = 0; m < makeupBatchCount && remainingDeficit > 0; m++) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
          console.warn(`Timeout during makeup phase. Still short ${remainingDeficit} questions.`);
          break;
        }
        
        const makeupCount = Math.min(MAKEUP_BATCH_SIZE, remainingDeficit);
        console.log(`Makeup batch ${m + 1}/${makeupBatchCount}: generating ${makeupCount} questions`);
        
        const batchSeed = `${generationSeed}-M${m + 1}`;
        const makeupPrompt = `[MAKEUP BATCH ${m + 1} | Seed: ${batchSeed}]

Generate EXACTLY ${makeupCount} unique interview questions.
Mix of question types (MCQ, scenario, descriptive) and difficulties.

UNIQUENESS: These are makeup questions - generate CREATIVE, UNIQUE questions that explore edge cases, 
unusual scenarios, or less common aspects of the job requirements. NO coding questions.

OUTPUT: Return ONLY a JSON array with ${makeupCount} questions.

Job Description:\n${jobDescription}`;
        
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const makeupQuestions = await processBatch(`M${m + 1}`, `${systemPrompt}\n\n${makeupPrompt}`, makeupCount, 0);
          
          if (makeupQuestions.length > 0) {
            allQuestionsBatches.push(makeupQuestions);
            remainingDeficit -= makeupQuestions.length;
            console.log(`Makeup batch ${m + 1} - Got ${makeupQuestions.length}. Remaining deficit: ${remainingDeficit}`);
          }
        } catch (makeupError: any) {
          console.error(`Makeup batch ${m + 1} failed:`, makeupError.message);
        }
      }
      
      if (remainingDeficit > 0) {
        console.warn(`Completed with ${remainingDeficit} questions short of target`);
      }
    }
  
  const allQuestionsRaw = allQuestionsBatches.flat();
    
    if (allQuestionsRaw.length === 0) {
      throw new Error('No questions were generated from any batch');
    }

    console.log(`Generated ${allQuestionsRaw.length} total questions (before deduplication)`);

    // ============ PRE-INSERT DEDUPLICATION ============
    // Normalize question text for comparison to prevent near-duplicates
    const normalizeForDedup = (text: string): string => {
      if (!text) return '';
      return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')           // Normalize whitespace
        .replace(/[^\w\s]/g, '')        // Remove punctuation
        .substring(0, 300);             // Compare first 300 chars
    };

    const seenTexts = new Set<string>();
    const allQuestions: any[] = [];
    let duplicatesRemoved = 0;

    for (const question of allQuestionsRaw) {
      const normalizedText = normalizeForDedup(question.question_text || '');
      
      if (!normalizedText) {
        // Skip empty questions
        duplicatesRemoved++;
        continue;
      }
      
      if (seenTexts.has(normalizedText)) {
        // Skip duplicate
        duplicatesRemoved++;
        continue;
      }
      
      seenTexts.add(normalizedText);
      allQuestions.push(question);
    }

    console.log(`Deduplication: removed ${duplicatesRemoved} duplicates, keeping ${allQuestions.length} unique questions`);

    if (allQuestions.length === 0) {
      throw new Error('All generated questions were duplicates - no unique questions to insert');
    }

    // Helper function to determine allowed languages based on topic/skill
    const getAllowedLanguages = (topic: string, questionText: string, questionType: string): string[] | null => {
      // Only set allowed_languages for coding questions
      if (questionType !== 'coding') {
        return null;
      }
      
      const topicLower = topic.toLowerCase();
      const textLower = questionText.toLowerCase();
      const combinedText = topicLower + ' ' + textLower;
      
      // PRIORITY 1: Check topic explicitly mentions a programming language
      // This prevents keyword false positives (e.g., Java question mentioning "table" being marked as SQL)
      
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
      
      // PySpark/Spark/Databricks - check BEFORE SQL since PySpark uses DataFrames
      if (combinedText.includes('pyspark') || combinedText.includes('sparkcontext') ||
          combinedText.includes('sparksession') || combinedText.includes('rdd')) {
        return ['python'];
      }
      
      // SQL-specific patterns (more strict - require actual SQL keywords together)
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
      
      // Java framework patterns (check AFTER topic priority)
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

    // Helper function to extract table names from coding_schema
    const extractTableNames = (schema: any): string[] => {
      if (!schema || !schema.tables || !Array.isArray(schema.tables)) {
        return [];
      }
      return schema.tables.map((t: any) => t.name?.toLowerCase()).filter(Boolean);
    };

    // Helper function to check if question_text references schema tables
    const questionReferencesSchema = (questionText: string, tableNames: string[]): boolean => {
      if (tableNames.length === 0) return true; // No tables to check
      const lowerQuestion = questionText.toLowerCase();
      return tableNames.some(tableName => lowerQuestion.includes(tableName));
    };

    // Helper function to fix question_text to reference actual schema tables
    const fixQuestionSchemaReference = (question: any): any => {
      if (question.question_type !== 'coding' || !question.coding_schema) {
        return question;
      }

      const tableNames = extractTableNames(question.coding_schema);
      if (tableNames.length === 0) {
        return question;
      }

      // Check if question already references schema tables
      if (questionReferencesSchema(question.question_text, tableNames)) {
        return question;
      }

      // Question doesn't reference schema - fix it
      console.warn(`Fixing question-schema mismatch. Tables: [${tableNames.join(', ')}], Question: "${question.question_text.substring(0, 100)}..."`);
      
      // Common generic table references that AI might use incorrectly
      const genericTablePatterns = [
        /`(\w+)`\s+table/gi,           // `tablename` table
        /the\s+`(\w+)`/gi,             // the `tablename`
        /from\s+(\w+)/gi,              // from tablename
        /table\s+['"`]?(\w+)['"`]?/gi, // table 'tablename'
        /given\s+(?:a\s+)?`?(\w+)`?/gi // given a `tablename`
      ];

      let fixedText = question.question_text;
      const primaryTable = tableNames[0];
      
      // Try to replace the first generic table reference with actual schema table
      let replaced = false;
      for (const pattern of genericTablePatterns) {
        const match = pattern.exec(question.question_text);
        if (match && match[1]) {
          const genericTable = match[1].toLowerCase();
          // Only replace if it's not already one of our tables
          if (!tableNames.includes(genericTable)) {
            fixedText = question.question_text.replace(
              new RegExp(`\\b${match[1]}\\b`, 'gi'),
              primaryTable
            );
            replaced = true;
            console.log(`Replaced generic table "${match[1]}" with "${primaryTable}"`);
            break;
          }
        }
      }

      // If no pattern matched, prepend context about available tables
      if (!replaced) {
        const tableList = tableNames.map(t => `\`${t}\``).join(', ');
        fixedText = `Using the ${tableList} table${tableNames.length > 1 ? 's' : ''}: ${question.question_text}`;
        console.log(`Prepended table context to question`);
      }

      return {
        ...question,
        question_text: fixedText
      };
    };

    // Insert questions in batches to avoid timeout
    const QUESTION_INSERT_BATCH_SIZE = 100;

    const normalizeDifficulty = (value: unknown): 'easy' | 'medium' | 'hard' => {
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === 'easy' || v === 'medium' || v === 'hard') return v;
        if (v.includes('easy')) return 'easy';
        if (v.includes('hard')) return 'hard';
        if (v.includes('med')) return 'medium';
        return 'medium';
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (value <= 33) return 'easy';
        if (value <= 66) return 'medium';
        return 'hard';
      }
      return 'medium';
    };

    const normalizeQuestionType = (value: unknown): 'mcq' | 'scenario' | 'coding' | 'descriptive' => {
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === 'mcq' || v === 'scenario' || v === 'coding' || v === 'descriptive') return v;
        if (v.includes('mcq') || v.includes('multiple')) return 'mcq';
        if (v.includes('scenario')) return 'scenario';
        if (v.includes('code') || v.includes('coding') || v.includes('sql')) return 'coding';
        return 'descriptive';
      }
      return 'descriptive';
    };

    const questionsToInsert = allQuestions.map((q: any, index: number) => {
      // Normalize to satisfy DB constraints before any other processing
      const normalizedQuestion = {
        ...q,
        difficulty: normalizeDifficulty(q?.difficulty),
        question_type: normalizeQuestionType(q?.question_type),
      };

      // Fix any question-schema mismatches before insertion
      const fixedQuestion = fixQuestionSchemaReference(normalizedQuestion);
      const normalizedType = normalizeQuestionType(fixedQuestion?.question_type);

      const allowedLangs = getAllowedLanguages(
        fixedQuestion.topic || '',
        fixedQuestion.question_text || '',
        normalizedType
      );

      return {
        interview_id: interviewId,
        question_text: fixedQuestion.question_text,
        topic: fixedQuestion.topic,
        difficulty: normalizeDifficulty(fixedQuestion.difficulty),
        question_type: normalizedType,
        options: Array.isArray(fixedQuestion.options) ? fixedQuestion.options : [],
        correct_answer: fixedQuestion.correct_answer,
        order_index: index + 1,
        coding_schema: normalizedType === 'coding' ? (fixedQuestion.coding_schema || null) : null,
        allowed_languages: allowedLangs,
      };
    });

    console.log(`Inserting ${questionsToInsert.length} questions in batches of ${QUESTION_INSERT_BATCH_SIZE}...`);
    
    for (let i = 0; i < questionsToInsert.length; i += QUESTION_INSERT_BATCH_SIZE) {
      // Check timeout before each insert batch
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        throw new Error(`Generation timeout during insert: exceeded ${MAX_EXECUTION_TIME_MS / 1000}s limit`);
      }

      const batch = questionsToInsert.slice(i, i + QUESTION_INSERT_BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('questions')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting question batch ${Math.floor(i / QUESTION_INSERT_BATCH_SIZE) + 1}:`, insertError);
        throw insertError;
      }
      
      console.log(`Inserted batch ${Math.floor(i / QUESTION_INSERT_BATCH_SIZE) + 1}/${Math.ceil(questionsToInsert.length / QUESTION_INSERT_BATCH_SIZE)}`);
    }

    // Update status to completed
    await supabase
      .from('interviews')
      .update({ 
        generation_status: 'completed',
        generation_error: null 
      })
      .eq('id', interviewId);

    console.log(`Successfully completed generation for interview ${interviewId}`);
    
    // Log operation success
    if (operationLogId) {
      const durationMs = Date.now() - startTime;
      await supabase
        .from('interview_operation_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          metadata: { questionBankSize, questionCount, generatedCount: questionsToInsert.length },
        })
        .eq('id', operationLogId);
    }
    
  } catch (error) {
    console.error('Background generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update status to failed
    await supabase
      .from('interviews')
      .update({ 
        generation_status: 'failed',
        generation_error: errorMessage 
      })
      .eq('id', interviewId);
    
    // Log operation failure
    if (operationLogId) {
      const durationMs = Date.now() - startTime;
      await supabase
        .from('interview_operation_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          error_code: 'GENERATION_FAILED',
          error_message: errorMessage,
        })
        .eq('id', operationLogId);
    }
  }
}

serve(async (req) => {
  const logger = createLogger('generate-questions');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Question generation request started');
    
    // Check for test/benchmark mode before validation
    const requestBody = await req.json();
    if (requestBody.test === true || requestBody.benchmark === true) {
      logger.info('Test/benchmark mode detected');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Edge function is available',
        testMode: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for internal call (from regenerate-questions)
    let user;
    if (requestBody._internalCall === true && requestBody._callerUserId) {
      logger.info('Internal call detected from regenerate-questions', { userId: requestBody._callerUserId });
      user = { id: requestBody._callerUserId };
    } else {
      // Normal authentication flow
      // Roles: hr_recruiter creates interviews, tech_spoc can regenerate during review
      const authHeader = req.headers.get('Authorization');
      const authResult = await authenticateRequest(authHeader, [
        'partner_admin',
        'hr_recruiter', 
        'tech_spoc'  // tech_spoc needs this for question regeneration during review
      ]);

      if (authResult.error) {
        logger.warn('Authentication/authorization failed', { error: authResult.error });
        return new Response(
          JSON.stringify({ error: authResult.error }),
          { status: authResult.error.includes('required') ? 401 : 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      user = authResult.user;
      logger.info('User authenticated for question generation', { userId: user.id });
    }

    const difficultySchema = z.object({
      easy: z.number().min(0).max(100),
      medium: z.number().min(0).max(100),
      hard: z.number().min(0).max(100)
    });
    
    const inputSchema = z.object({
      interviewId: z.string().uuid('Invalid interview ID'),
      jobDescription: z.string().min(10, 'Job description too short').max(50000, 'Job description too long'),
      questionCount: z.number().int().min(1).max(500, 'Question count must be between 1 and 500'),
      topics: z.record(z.number()).optional(),
      questionTypeDistribution: z.object({
        mcq: z.number().min(0).max(100),
        scenario: z.number().min(0).max(100),
        coding: z.number().min(0).max(100),
        descriptive: z.number().min(0).max(100)
      }).optional(),
      difficultyDistribution: difficultySchema.optional(),
      categoryDifficultyDistribution: z.object({
        mcq: difficultySchema,
        scenario: difficultySchema,
        coding: difficultySchema,
        descriptive: difficultySchema
      }).optional(),
      questionBankSize: z.number().int().min(1).max(2000).optional(),
      previewMode: z.boolean().optional(),
      codingSchema: z.any().optional(),
      requiredQuestionRules: z.array(z.object({
        type: z.enum(['mcq', 'descriptive', 'scenario', 'coding']),
        difficulty: z.enum(['easy', 'medium', 'hard']),
        min: z.number().int().min(1),
        topic: z.string().optional()
      })).optional(),
      experienceLevel: z.enum(['intern', 'junior', 'mid', 'senior', 'lead', 'principal']).optional(),
      minYearsExperience: z.number().int().min(0).max(30).optional()
    });

    const parsedData = inputSchema.parse(requestBody);
    
    const { 
      interviewId, 
      jobDescription, 
      topics, 
      questionCount, 
      questionTypeDistribution = { mcq: 40, scenario: 30, coding: 20, descriptive: 10 },
      difficultyDistribution,
      categoryDifficultyDistribution,
      questionBankSize = 200,
      previewMode = false,
      codingSchema = null,
      requiredQuestionRules = null,
      experienceLevel = null,
      minYearsExperience = null
    } = parsedData;

    console.log('Generating question bank with parameters:', { 
      interviewId, 
      questionBankSize, 
      questionCount,
      questionTypeDistribution, 
      topics,
      requiredQuestionRules,
      previewMode 
    });

    // For preview mode, generate synchronously (small dataset)
    if (previewMode) {
      // Calculate per-category difficulty counts
      const counts = calculateCategoryDifficultyCounts(
        questionBankSize,
        questionTypeDistribution,
        categoryDifficultyDistribution,
        difficultyDistribution
      );
      
      const {
        totalMCQ, totalScenario, totalCoding, totalDescriptive,
        easyMCQ, mediumMCQ, hardMCQ,
        easyScenario, mediumScenario, hardScenario,
        easyCoding, mediumCoding, hardCoding,
        easyDescriptive, mediumDescriptive, hardDescriptive
      } = counts;

      // Try to load AI configuration
      const aiConfig = await getAIConfig('question_generation');
      const useConfiguredAI = aiConfig?.primaryProvider !== null;
      
      // Fallback to environment variable if no configuration
      const GOOGLE_GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
      
      if (!useConfiguredAI && !GOOGLE_GEMINI_API_KEY) {
        throw new Error('No AI provider configured. Please configure an AI provider in the AI Configuration settings or set GOOGLE_GEMINI_API_KEY.');
      }
      
      console.log(`Preview mode: Using ${useConfiguredAI ? 'configured AI provider' : 'fallback Gemini'}`);

      const systemPrompt = `You are an expert technical interviewer. Generate a comprehensive question bank based on the job description provided.

CRITICAL INSTRUCTIONS:
- Generate EXACTLY ${questionBankSize} questions total for the question bank
- Question type and difficulty distribution (MUST BE EXACT):
  ${easyMCQ > 0 ? `* ${easyMCQ} EASY multiple choice questions` : ''}
  ${easyScenario > 0 ? `* ${easyScenario} EASY scenario-based questions` : ''}
  ${easyCoding > 0 ? `* ${easyCoding} EASY coding questions` : ''}
  ${easyDescriptive > 0 ? `* ${easyDescriptive} EASY descriptive questions` : ''}
  ${mediumMCQ > 0 ? `* ${mediumMCQ} MEDIUM multiple choice questions` : ''}
  ${mediumScenario > 0 ? `* ${mediumScenario} MEDIUM scenario-based questions` : ''}
  ${mediumCoding > 0 ? `* ${mediumCoding} MEDIUM coding questions` : ''}
  ${mediumDescriptive > 0 ? `* ${mediumDescriptive} MEDIUM descriptive questions` : ''}
  ${hardMCQ > 0 ? `* ${hardMCQ} HARD multiple choice questions` : ''}
  ${hardScenario > 0 ? `* ${hardScenario} HARD scenario-based questions` : ''}
  ${hardCoding > 0 ? `* ${hardCoding} HARD coding questions` : ''}
  ${hardDescriptive > 0 ? `* ${hardDescriptive} HARD descriptive questions` : ''}

${topics && Object.keys(topics).length > 0 ? `- Focus on these topics: ${JSON.stringify(topics)}` : '- Topics should be derived from the job description'}

${codingSchema ? `
CODING QUESTIONS MUST USE THIS DATABASE SCHEMA:
${JSON.stringify(codingSchema, null, 2)}

All SQL coding questions should reference these tables and columns.
` : ''}

FORMAT RULES:
- For MULTIPLE CHOICE questions: Provide exactly 4 options, set correct_answer to exact option text
- For DESCRIPTIVE/CODING questions: Set options to [], set correct_answer to guidance
  
Return ONLY a valid JSON array with EXACTLY ${questionBankSize} questions:
[{
  "question_text": "Question here",
  "topic": "Topic name",
  "difficulty": "easy|medium|hard",
  "question_type": "mcq|scenario|coding|descriptive",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"] or [],
  "correct_answer": "Answer or guidance"
}]`;

      // Generate questions in batches for preview (with retry and stagger)
      const batchSize = 10; // Small batches to prevent AI response truncation
      const batches = Math.ceil(questionBankSize / batchSize);

      // Helper function to retry API calls
      async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3, baseDelay = 2000): Promise<any> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            return await fn();
          } catch (error: any) {
            const isLastAttempt = attempt === maxRetries - 1;
            const is503 = error?.message?.includes('503');
            
            if (is503 && !isLastAttempt) {
              const delay = baseDelay * Math.pow(2, attempt);
              console.log(`503 error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw error;
          }
        }
      }

      const batchPromises = Array.from({ length: batches }, async (_, i) => {
        // Stagger batch starts
        await new Promise(resolve => setTimeout(resolve, i * 200));
        const batchQuestionCount = Math.min(batchSize, questionBankSize - (i * batchSize));
        
        const batchEasyMCQ = Math.round((easyMCQ / batches));
        const batchMediumMCQ = Math.round((mediumMCQ / batches));
        const batchHardMCQ = Math.round((hardMCQ / batches));
        const batchEasyScenario = Math.round((easyScenario / batches));
        const batchMediumScenario = Math.round((mediumScenario / batches));
        const batchHardScenario = Math.round((hardScenario / batches));
        const batchEasyCoding = Math.round((easyCoding / batches));
        const batchMediumCoding = Math.round((mediumCoding / batches));
        const batchHardCoding = Math.round((hardCoding / batches));
        const batchEasyDesc = Math.round((easyDescriptive / batches));
        const batchMediumDesc = Math.round((mediumDescriptive / batches));
        const batchHardDesc = Math.round((hardDescriptive / batches));

        const batchPrompt = `Generate batch ${i + 1} of ${batches}. Create ${batchQuestionCount} unique questions with this distribution:
- ${batchEasyMCQ} easy MCQ
- ${batchEasyScenario} easy scenario
- ${batchEasyCoding} easy coding
- ${batchEasyDesc} easy descriptive
- ${batchMediumMCQ} medium MCQ  
- ${batchMediumScenario} medium scenario
- ${batchMediumCoding} medium coding
- ${batchMediumDesc} medium descriptive
- ${batchHardMCQ} hard MCQ
- ${batchHardScenario} hard scenario
- ${batchHardCoding} hard coding
- ${batchHardDesc} hard descriptive`;

        const fullPrompt = `${systemPrompt}\n\n${batchPrompt}\n\nJob Description:\n${jobDescription}`;
        
        return await retryWithBackoff(async () => {
          let response;
          let apiKey;
          let apiUrl;
          let requestBody;
          
          if (useConfiguredAI && aiConfig?.primaryProvider) {
            apiKey = aiConfig.primaryProvider.apiKey;
            const model = aiConfig.primaryProvider.model || 'gemini-2.5-flash';
            apiUrl = `${aiConfig.primaryProvider.baseUrl}/v1/models/${model}:generateContent?key=${apiKey}`;
            requestBody = {
              contents: [{
                parts: [{ text: fullPrompt }]
              }]
            };
          } else {
            apiKey = GOOGLE_GEMINI_API_KEY;
            apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            requestBody = {
              contents: [{
                parts: [{ text: fullPrompt }]
              }]
            };
          }
          
          response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            await logAIUsage({
              featureName: 'question_generation',
              success: false,
              errorMessage: `Preview mode failed: ${response.status}`,
            });
            throw new Error(`AI generation failed: ${response.status}`);
          }

          const data = await response.json();
          const content = data.candidates[0].content.parts[0].text;
          
          // Extract JSON from response - handle various formats
          let jsonString = content.trim();
          
          // Remove markdown code blocks if present
          jsonString = jsonString.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
          
          // Find JSON array in the response
          const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
          if (!jsonMatch) {
            throw new Error("No JSON array found in AI response");
          }
          
          jsonString = jsonMatch[0];
          
          // Aggressive JSON cleanup
          jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
          jsonString = jsonString.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
          jsonString = jsonString.replace(/,\s*,/g, ',');
          
          // Remove any text after the last closing bracket
          const lastBracket = jsonString.lastIndexOf(']');
          if (lastBracket !== -1) {
            jsonString = jsonString.substring(0, lastBracket + 1);
          }
          
          try {
            return JSON.parse(jsonString);
          } catch (parseError) {
            console.error('Preview JSON parse error:', parseError);
            console.error('Attempted to parse:', jsonString.substring(0, 1000));
            
            // Recovery Strategy 1: Extract complete questions using regex
            try {
              const questionRegex = /\{[^{}]*"question_text"[^{}]*"topic"[^{}]*"difficulty"[^{}]*"question_type"[^{}]*\}/g;
              const completeQuestions = jsonString.match(questionRegex);
              
              if (completeQuestions && completeQuestions.length > 0) {
                const repairedJson = '[' + completeQuestions.join(',') + ']';
                const recovered = JSON.parse(repairedJson);
                console.log(`Preview recovered ${recovered.length} questions from truncated response`);
                return recovered;
              }
            } catch (recoveryError) {
              console.error('Strategy 1 recovery failed:', recoveryError);
            }
            
            // Recovery Strategy 2: Truncate incomplete trailing content
            try {
              let lastValidIndex = -1;
              let braceCount = 0;
              let bracketCount = 0;
              
              for (let j = 0; j < jsonString.length; j++) {
                if (jsonString[j] === '{') braceCount++;
                if (jsonString[j] === '}') braceCount--;
                if (jsonString[j] === '[') bracketCount++;
                if (jsonString[j] === ']') bracketCount--;
                
                if (braceCount === 0 && bracketCount === 1 && j > 0) {
                  lastValidIndex = j;
                }
              }
              
              if (lastValidIndex > 0) {
                const truncatedJson = jsonString.substring(0, lastValidIndex + 1) + ']';
                const recovered = JSON.parse(truncatedJson);
                console.log(`Preview recovered ${recovered.length} questions by truncating`);
                return recovered;
              }
            } catch (recoveryError2) {
              console.error('Strategy 2 recovery failed:', recoveryError2);
            }
            
            throw parseError;
          }
        });
      });

      const batchResults = await Promise.all(batchPromises);
      const allQuestions = batchResults.flat();

      console.log('Preview mode: returning sample questions');
      return new Response(JSON.stringify({ 
        questions: allQuestions.slice(0, questionCount),
        success: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For full generation, use background processing
    if (!interviewId) {
      throw new Error('interviewId is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch interview to get organization_id for usage tracking
    const { data: interview } = await supabase
      .from('interviews')
      .select('organization_id, creator_id')
      .eq('id', interviewId)
      .single();

    const organizationId = interview?.organization_id;
    const creatorId = interview?.creator_id || user.id;

    // Update interview status to generating
    await supabase
      .from('interviews')
      .update({ generation_status: 'generating' })
      .eq('id', interviewId);

    // Start background task
    const backgroundTask = generateQuestionsBackground({
      interviewId,
      jobDescription,
      topics,
      questionCount,
      questionTypeDistribution,
      difficultyDistribution,
      categoryDifficultyDistribution,
      questionBankSize,
      codingSchema,
      requiredQuestionRules,
      organizationId,
      userId: creatorId
    });

    // Use waitUntil to keep function alive for background processing
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundTask);
    } else {
      // Fallback for local development
      backgroundTask.catch(console.error);
    }

    // Return immediately
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Question generation started',
      status: 'generating',
      interviewId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in generate-questions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
