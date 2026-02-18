import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const requestSchema = z.object({
  content: z.string()
    .min(1, "Content is required")
    .max(50000, "Content must be under 50KB"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and verify platform_admin role
    const authHeader = req.headers.get('Authorization');
    const { user, error: authError } = await authenticateRequest(authHeader, ['platform_admin']);

    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: authError || "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { content } = validation.data;

    console.log(`Improving documentation format for user: ${user.id}`);

    const systemPrompt = `You are a technical documentation formatting expert. Your task is to improve the formatting and structure of documentation while preserving all content.

**Formatting Guidelines:**
- Use proper markdown hierarchy (# for main title, ## for sections, ### for subsections)
- Add clear spacing between sections
- Format code blocks with proper language identifiers
- Use bullet points and numbered lists appropriately
- Add tables where data is presented
- Ensure consistent formatting throughout
- Improve readability without changing the content meaning
- Add emphasis (bold, italic) where appropriate
- Ensure proper paragraph breaks

Return ONLY the improved markdown content, no explanations.`;

    const userPrompt = `Improve the formatting of this documentation:\n\n${content}`;

    // Use unified AI calling pattern with automatic token logging
    const improvedContent = await callAI({
      featureName: 'documentation_formatting',
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      userId: user.id,
    });

    console.log("Documentation format improved successfully");

    return new Response(
      JSON.stringify({ content: improvedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Format improvement error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
