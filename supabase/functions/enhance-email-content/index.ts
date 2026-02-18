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
    const { htmlContent, instructions, templateVariables } = await req.json();

    if (!htmlContent || !instructions) {
      return new Response(
        JSON.stringify({ error: 'Missing htmlContent or instructions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert email content writer. Your task is to enhance email template content based on user instructions.

CRITICAL RULES:
1. PRESERVE all template variables exactly as they are (e.g., {{candidate_name}}, {{organization_name}}). These MUST remain unchanged.
2. Keep the HTML structure valid and clean.
3. Maintain professional email formatting standards.
4. Focus on improving the content based on the user's specific instructions.
5. Return ONLY the enhanced HTML content, no explanations or markdown wrapping.

Available template variables that MUST be preserved if present:
${templateVariables?.join(', ') || 'Various template variables'}

The user will provide their enhancement instructions and you should apply them while keeping all template variables intact.`;

    const userPrompt = `Here is the current email template HTML content:

\`\`\`html
${htmlContent}
\`\`\`

User's enhancement instructions: "${instructions}"

Please enhance this email content according to the instructions. Remember to preserve ALL {{variable}} placeholders exactly as they are. Return ONLY the enhanced HTML content.`;

    // Use unified AI calling pattern with automatic token logging
    let enhancedContent = await callAI({
      featureName: 'email_enhancement',
      prompt: userPrompt,
      systemPrompt: systemPrompt,
    });

    // Clean up any markdown code blocks if present
    enhancedContent = enhancedContent
      .replace(/^```html\n?/i, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/i, '')
      .trim();

    console.log('Email content enhanced successfully');

    return new Response(
      JSON.stringify({ enhancedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error enhancing email content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
