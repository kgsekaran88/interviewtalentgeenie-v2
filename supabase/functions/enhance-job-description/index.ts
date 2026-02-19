import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobDescription, jobTitle } = await req.json();

    if (!jobDescription) {
      return new Response(
        JSON.stringify({ error: 'Job description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert technical recruiter and job description writer. Your task is to enhance and improve job descriptions to make them more professional, clear, and comprehensive.

ENHANCEMENT GUIDELINES:
1. Structure the content with clear sections (Requirements, Responsibilities, Skills, etc.)
2. Improve clarity and professional tone
3. Add relevant technical details based on the role
4. Ensure consistent formatting with bullet points
5. Keep the core requirements intact but make them more specific
6. Add any missing standard sections (About the Role, What You'll Do, Requirements, Nice to Have)
7. Make the description more engaging and attractive to candidates
8. Ensure proper grammar and professional language

IMPORTANT:
- Keep technical skills and requirements accurate
- Don't remove any existing requirements
- Maintain the original intent and level of the position
- Format output as clean, readable text (not markdown)
- Use bullet points (•) for lists`;

    const userPrompt = jobTitle 
      ? `Please enhance this job description for a "${jobTitle}" position:\n\n${jobDescription}`
      : `Please enhance this job description:\n\n${jobDescription}`;

    console.log('Enhancing job description...');

    // Use unified AI calling pattern with automatic token logging
    const enhancedDescription = await callAI({
      featureName: 'jd_enhancement',
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      model: 'gemini-2.5-flash-lite', // Cost-optimized: text enhancement task
    });

    if (!enhancedDescription) {
      throw new Error('No enhanced description generated');
    }

    console.log('Job description enhanced successfully');

    return new Response(
      JSON.stringify({ enhancedDescription: enhancedDescription.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to enhance job description';
    console.error('Error enhancing job description:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
