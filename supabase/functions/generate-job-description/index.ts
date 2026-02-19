import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { logAIUsage } from "../_shared/config.ts";

// Token estimation helper (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

import { corsHeaders } from "../_shared/cors.ts";

// Roles allowed to generate job descriptions
// Note: tech_spoc NOT included - they review questions, not create JDs
// Note: platform_admin has automatic "god mode" access via auth-utils.ts
const ALLOWED_ROLES = ['partner_admin', 'hr_recruiter'];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize using shared auth-utils (includes platform_admin god mode)
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ALLOWED_ROLES);

    if (authResult.error) {
      const status = authResult.error.includes('Authentication') ? 401 : 403;
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user } = authResult;
    console.log("Authorization successful for user:", user.email);

    // Process the job description generation
    const {
      jobTitle,
      experienceLevel,
      industry,
      requiredSkills = [],
      niceToHaveSkills = [],
      responsibilities = [],
      workEnvironment,
      teamStructure,
      softSkills = [],
      challenges = []
    } = await req.json();

    console.log("Generating job description for:", jobTitle);

    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    if (!AI_GATEWAY_API_KEY) {
      console.error("AI_GATEWAY_API_KEY is not configured");
      throw new Error("AI_GATEWAY_API_KEY is not configured");
    }

    // Build the prompt
    const experienceLevelMap: Record<string, string> = {
      'intern': 'Intern (0-1 years)',
      'junior': 'Junior (1-3 years)',
      'mid': 'Mid-Level (3-5 years)',
      'senior': 'Senior (5-8 years)',
      'lead': 'Lead/Staff (8-12 years)',
      'principal': 'Principal/Architect (12+ years)'
    };

    const workEnvMap: Record<string, string> = {
      'remote': 'Fully Remote',
      'hybrid': 'Hybrid',
      'onsite': 'On-site'
    };

    const teamStructMap: Record<string, string> = {
      'solo': 'Individual Contributor',
      'small': 'Small Team (2-5 members)',
      'medium': 'Medium Team (6-15 members)',
      'large': 'Large Team (15+ members)',
      'lead': 'Team Lead / Manager role'
    };

    const prompt = `Generate a professional, detailed job description for the following position:

**Position Details:**
- Job Title: ${jobTitle}
- Experience Level: ${experienceLevelMap[experienceLevel] || experienceLevel}
- Industry: ${industry}
${workEnvironment ? `- Work Environment: ${workEnvMap[workEnvironment] || workEnvironment}` : ''}
${teamStructure ? `- Team Structure: ${teamStructMap[teamStructure] || teamStructure}` : ''}

**Required Technical Skills:**
${requiredSkills.map((s: string) => `- ${s}`).join('\n')}

${niceToHaveSkills?.length > 0 ? `**Nice-to-Have Skills:**
${niceToHaveSkills.map((s: string) => `- ${s}`).join('\n')}` : ''}

**Key Responsibilities:**
${responsibilities.map((r: string) => `- ${r}`).join('\n')}

${softSkills?.length > 0 ? `**Soft Skills:**
${softSkills.map((s: string) => `- ${s}`).join('\n')}` : ''}

${challenges?.length > 0 ? `**Specific Challenges/Requirements:**
${challenges.map((c: string) => `- ${c}`).join('\n')}` : ''}

Generate a comprehensive job description that:
1. Starts with a compelling role summary (2-3 sentences)
2. Lists key responsibilities in detail
3. Specifies required qualifications and experience
4. Includes nice-to-have qualifications if applicable
5. Describes the ideal candidate profile
6. Is formatted clearly with sections

IMPORTANT: Do NOT include any "About Us", "About the Company", or similar company introduction sections. Focus only on the role itself.

The job description should be professional, engaging, and suitable for generating targeted technical interview questions.`;

    console.log("Calling AI Gateway...");
    
    const startTime = Date.now();
    const requestTokens = estimateTokens(prompt) + estimateTokens("You are an expert HR professional...");

    const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
    const response = await fetch(AI_GATEWAY_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite", // Cost-optimized: text generation task
        messages: [
          {
            role: "system",
            content: "You are an expert HR professional and technical recruiter. Generate clear, professional, and comprehensive job descriptions that will help interviewers create relevant technical interview questions. Focus on specificity and clarity. NEVER include 'About Us', 'About the Company', or any company introduction sections - focus only on the role, responsibilities, and requirements."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      // Log failure - wrapped to prevent logging errors from breaking main flow
      logAIUsage({
        featureName: 'job_description_generation',
        success: false,
        modelUsed: 'gemini-2.5-flash-lite',
        requestTokens,
        latencyMs,
        errorMessage: `${response.status}: ${errorText}`,
        userId: user.id,
      }).catch(e => console.error('Failed to log AI usage:', e));
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("AI response received successfully");
    
    const jobDescription = data.choices?.[0]?.message?.content || "";
    const responseTokens = estimateTokens(jobDescription);

    if (!jobDescription) {
      console.error("Empty response from AI:", JSON.stringify(data));
      logAIUsage({
        featureName: 'job_description_generation',
        success: false,
        modelUsed: 'gemini-2.5-flash',
        requestTokens,
        latencyMs,
        errorMessage: 'Empty response from AI',
        userId: user.id,
      }).catch(e => console.error('Failed to log AI usage:', e));
      throw new Error("Empty response from AI");
    }

    // Log successful AI usage
    // Log success - fire-and-forget pattern to not block response
    logAIUsage({
      featureName: 'job_description_generation',
      success: true,
      modelUsed: 'gemini-2.5-flash',
      requestTokens,
      responseTokens,
      latencyMs,
      userId: user.id,
    }).catch(e => console.error('Failed to log AI usage:', e));
    console.log(`[job_description_generation] Success (${latencyMs}ms, ~${requestTokens + responseTokens} tokens)`);

    return new Response(
      JSON.stringify({ jobDescription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating job description:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
