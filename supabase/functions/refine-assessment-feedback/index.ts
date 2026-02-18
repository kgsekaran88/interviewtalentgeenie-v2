import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefineRequest {
  assessmentId: string;
  section: 'strengths' | 'weaknesses' | 'detailed_analysis';
  instruction: string;
  currentContent: string | string[];
  mode: 'regenerate' | 'refine';
  context?: {
    candidateName?: string;
    interviewTitle?: string;
    overallScore?: number;
    topicScores?: Record<string, number>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assessmentId, section, instruction, currentContent, mode, context } = await req.json() as RefineRequest;

    if (!assessmentId || !section || !instruction) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: assessmentId, section, instruction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the prompt based on section type and mode
    const sectionNames = {
      strengths: 'Key Strengths',
      weaknesses: 'Areas for Improvement',
      detailed_analysis: 'Detailed Analysis'
    };

    const currentContentStr = Array.isArray(currentContent) 
      ? currentContent.map((item, i) => `${i + 1}. ${item}`).join('\n')
      : currentContent;

    // Default positive-focused system prompt
    const systemPrompt = `You are an expert HR consultant specializing in constructive, growth-oriented feedback for interview assessments.

CRITICAL GUIDELINES:
1. ALWAYS maintain a positive, encouraging tone
2. For "Areas for Improvement", limit to 1-2 items maximum and frame them as growth opportunities, not criticisms
3. For "Key Strengths", be specific and highlight genuine accomplishments
4. For "Detailed Analysis", focus 80% on positives and 20% on development areas
5. Never use harsh or discouraging language
6. Frame weaknesses as "opportunities for growth" or "areas to develop further"
7. Be professional but warm and supportive
8. Keep feedback constructive and actionable

${context ? `
CONTEXT:
- Candidate: ${context.candidateName || 'Unknown'}
- Interview: ${context.interviewTitle || 'Technical Assessment'}
- Overall Score: ${context.overallScore || 'N/A'}%
${context.topicScores ? `- Topic Scores: ${Object.entries(context.topicScores).map(([t, s]) => `${t}: ${s}%`).join(', ')}` : ''}
` : ''}`;

    let userPrompt = '';

    if (mode === 'regenerate') {
      // Full regeneration with instruction as guidance
      if (section === 'strengths') {
        userPrompt = `Generate a new list of Key Strengths for this candidate based on the following instruction:
"${instruction}"

IMPORTANT:
- List 3-5 specific, genuine strengths
- Be professional and encouraging
- Focus on technical and soft skills demonstrated

Respond with a JSON array of strings.
Format: ["strength 1", "strength 2", "strength 3"]`;
      } else if (section === 'weaknesses') {
        userPrompt = `Generate new Areas for Improvement for this candidate based on the following instruction:
"${instruction}"

IMPORTANT: 
- List only 1-2 items maximum
- Frame as growth opportunities, not criticisms
- Use positive, encouraging language
- Focus on development potential

Respond with a JSON array of 1-2 improvement areas.
Format: ["improvement area 1", "improvement area 2"]`;
      } else {
        userPrompt = `Generate a new Detailed Analysis for this candidate based on the following instruction:
"${instruction}"

IMPORTANT:
- 200-300 words
- 80% positive, 20% development areas
- Professional but encouraging tone
- Highlight achievements first, then growth areas

Respond with a single paragraph as a plain text string.`;
      }
    } else {
      // Refine existing content
      if (section === 'strengths') {
        userPrompt = `Refine these Key Strengths based on the following instruction:
"${instruction}"

Current strengths:
${currentContentStr}

IMPORTANT:
- Maintain positive, professional tone
- Make language more impactful and specific
- Keep 3-5 items

Respond with a JSON array of strings.
Format: ["strength 1", "strength 2", ...]`;
      } else if (section === 'weaknesses') {
        userPrompt = `Refine these Areas for Improvement based on the following instruction:
"${instruction}"

Current areas:
${currentContentStr}

IMPORTANT: 
- Reduce to maximum 2 items
- Make language more positive and growth-oriented
- Frame as opportunities, not criticisms

Respond with a JSON array of 1-2 improvement areas.
Format: ["improvement area 1", "improvement area 2"]`;
      } else {
        userPrompt = `Refine this Detailed Analysis based on the following instruction:
"${instruction}"

Current analysis:
${currentContentStr}

IMPORTANT:
- Make the tone more positive
- Reduce negative points to 1-2 only
- Enhance the positives and achievements
- Keep it professional but encouraging

Respond with a single paragraph (200-300 words) as a plain text string.`;
      }
    }

    console.log(`Refining ${section} for assessment ${assessmentId} with mode ${mode}`);

    // Use unified AI calling pattern with automatic token logging
    const content = await callAI({
      featureName: 'assessment_refinement',
      prompt: userPrompt,
      systemPrompt: systemPrompt,
    });

    console.log("AI response:", content);

    // Parse the response based on section type
    let refinedContent: string | string[];

    if (section === 'detailed_analysis') {
      // For detailed analysis, clean up any markdown or JSON formatting
      refinedContent = content
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '')
        .replace(/^"/, '')
        .replace(/"$/, '')
        .trim();
    } else {
      // For arrays (strengths/weaknesses), parse JSON
      try {
        let jsonContent = content;
        // Extract JSON array if wrapped in markdown
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        }
        refinedContent = JSON.parse(jsonContent);
        
        // Validate it's an array of strings
        if (!Array.isArray(refinedContent) || !refinedContent.every(item => typeof item === 'string')) {
          throw new Error("Invalid response format");
        }
        
        // Limit weaknesses to max 2
        if (section === 'weaknesses' && refinedContent.length > 2) {
          refinedContent = refinedContent.slice(0, 2);
        }
      } catch (parseError) {
        console.error("Failed to parse AI response as array:", parseError);
        // Fallback: split by newlines if it looks like a list
        refinedContent = content
          .split('\n')
          .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
          .filter((line: string) => line.length > 0);
        
        if (section === 'weaknesses') {
          refinedContent = refinedContent.slice(0, 2);
        }
      }
    }

    // Update the assessment in the database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const updateData: Record<string, any> = {};
    if (section === 'strengths') {
      updateData.strengths = refinedContent;
    } else if (section === 'weaknesses') {
      updateData.weaknesses = refinedContent;
    } else {
      updateData.detailed_analysis = refinedContent;
    }

    const { error: updateError } = await supabase
      .from('assessments')
      .update(updateData)
      .eq('id', assessmentId);

    if (updateError) {
      console.error("Failed to update assessment:", updateError);
      throw new Error(`Failed to save changes: ${updateError.message}`);
    }

    console.log(`Successfully updated ${section} for assessment ${assessmentId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        section,
        content: refinedContent 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in refine-assessment-feedback:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
