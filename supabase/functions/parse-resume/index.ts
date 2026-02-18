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
  const logger = createLogger('parse-resume');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Resume parsing request started');
    
    const authHeader = req.headers.get("authorization");
    const authResult = await authenticateRequest(authHeader, ['partner_admin', 'hr_recruiter']);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.error.includes('required') ? 401 : 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user, supabase } = authResult;
    logger.info('User authorized for resume parsing', { userId: user.id });

    const { resumeText, candidateName, candidateEmail, jobDescription } = await req.json();

    logger.info('Parsing resume', { candidateName, candidateEmail, userId: user.id });

    if (!resumeText || !candidateName || !candidateEmail) {
      logger.warn('Missing required fields', { candidateName, candidateEmail });
      return new Response(
        JSON.stringify({ error: "resumeText, candidateName, and candidateEmail are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Analyze this resume and extract structured information. Also generate 5-7 relevant technical interview questions based on the candidate's background${jobDescription ? ` for this role: ${jobDescription}` : ''}.

Resume:
${resumeText}

Return a JSON object with this structure:
{
  "skills": ["skill1", "skill2", ...],
  "experience_years": <number>,
  "education_level": "Bachelor's/Master's/PhD/etc",
  "current_position": "Job Title",
  "current_company": "Company Name",
  "key_achievements": ["achievement1", ...],
  "technical_strengths": ["strength1", ...],
  "suggested_questions": [
    {
      "question_text": "...",
      "topic": "...",
      "difficulty": "easy/medium/hard",
      "question_type": "mcq/descriptive/coding",
      "rationale": "why this question is relevant"
    }
  ]
}`;

    let parsedData;
    
    // Use unified AI calling pattern - no org context as resume parsing is user-initiated
    try {
      const responseText = await callAI({
        featureName: 'resume_parsing',
        prompt: prompt,
        systemPrompt: 'You are an expert resume parser and technical interviewer. Return only valid JSON.',
        userId: user.id
      });

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
        logger.info('Resume parsed successfully');
      } else {
        throw new Error('No valid JSON found in AI response');
      }
    } catch (error) {
      logger.error('Resume parsing failed', error);
      throw new Error('Failed to parse resume. Please check AI configuration.');
    }

    // Store parsing results
    const { data: parsingResult, error: insertError } = await supabase
      .from("resume_parsing_results")
      .insert({
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        resume_text: resumeText,
        parsed_data: parsedData,
        extracted_skills: parsedData.skills || [],
        experience_years: parsedData.experience_years,
        processed_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to store parsing results", insertError);
      throw insertError;
    }

    logger.info('Resume parsing completed successfully', { parsingResultId: parsingResult.id });

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedData,
        parsingId: parsingResult.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logger.error("Error in parse-resume", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An error occurred while parsing the resume"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
