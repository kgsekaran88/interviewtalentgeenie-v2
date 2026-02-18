import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, contentType, title, context } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (contentType === 'chatbot_knowledge') {
      systemPrompt = `You are an expert at creating high-quality chatbot knowledge base entries for TalentGeenie, an AI-powered technical interview platform.

TalentGeenie Platform Context:
- NO RESUME UPLOAD feature exists - candidates only enter name and email
- Supports 8 user roles: platform_admin, partner_admin, hr_recruiter, technical_spoc, interviewer, ta_creator, billing_contact, candidate
- Key features: JD Builder wizard, AI question generation, real-time proctoring, CPI scoring, ATS integration
- Interview flow: Create JD → Generate questions → Share link → Candidate takes interview → AI assessment → CPI report

Your task is to enhance the Q&A entry to be:
1. More comprehensive and detailed
2. Accurate to TalentGeenie platform features
3. Clear and actionable for users
4. Professional in tone
5. Include specific navigation paths where applicable (e.g., "Go to Admin → Interviews → Create")

Return a JSON object with these fields:
- title: Enhanced title (concise but descriptive)
- question: Improved question that users might ask
- answer: Comprehensive answer with step-by-step guidance where applicable`;

      userPrompt = `Enhance this chatbot knowledge entry:

Title: ${title || 'Untitled'}
Question: ${context?.question || content}
Answer: ${context?.answer || content}
Category: ${context?.category || 'general'}

Return ONLY a valid JSON object like:
{"title": "Enhanced Title", "question": "Enhanced question?", "answer": "Enhanced comprehensive answer with details..."}`;

    } else if (contentType === 'documentation') {
      systemPrompt = `You are a technical documentation expert for TalentGeenie, an enterprise AI-powered technical interview and assessment platform.

TalentGeenie Platform Context:
- NO RESUME UPLOAD - candidates only provide name and email
- 8 user roles with hierarchical permissions
- Features: JD Builder, AI question generation, proctoring, CPI scoring, certifications, learning management
- Tech stack: React, TypeScript, Supabase, Edge Functions

Your task is to enhance the documentation to be:
1. More comprehensive with better structure
2. Include proper markdown formatting (headers, lists, code blocks)
3. Add practical examples and step-by-step instructions
4. Include tips, warnings, and best practices
5. Ensure accuracy for the TalentGeenie platform
6. Professional technical writing style`;

      userPrompt = `Enhance this documentation content:

Title: ${title || 'Documentation'}
Content:
${content}

Improve the structure, clarity, completeness, and formatting. Return the enhanced markdown content only.`;

    } else {
      // Generic content enhancement
      systemPrompt = `You are an expert content enhancer. Improve the given content to be more clear, comprehensive, well-structured, and professional while maintaining the original intent.`;
      userPrompt = `Enhance this content:\n\n${content}`;
    }

    console.log(`Enhancing ${contentType || 'generic'} content with AI`);

    // Use unified AI calling pattern with automatic token logging
    const enhancedContent = await callAI({
      featureName: 'content_enhancement',
      prompt: userPrompt,
      systemPrompt: systemPrompt,
    });

    // For chatbot knowledge, try to parse JSON response
    if (contentType === 'chatbot_knowledge') {
      try {
        // Clean markdown if present
        let jsonStr = enhancedContent;
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.replace(/```\n?/g, '');
        }
        
        const parsed = JSON.parse(jsonStr.trim());
        return new Response(
          JSON.stringify({ 
            success: true, 
            enhanced: parsed,
            type: 'chatbot_knowledge'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        // Return as plain text if JSON parsing fails
        return new Response(
          JSON.stringify({ 
            success: true, 
            enhanced: { answer: enhancedContent },
            type: 'chatbot_knowledge'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // For documentation and other content, return as-is
    return new Response(
      JSON.stringify({ 
        success: true, 
        enhanced: enhancedContent,
        type: contentType || 'generic'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enhancement error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
