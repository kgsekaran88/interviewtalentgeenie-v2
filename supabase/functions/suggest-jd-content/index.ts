import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { callAI } from "../_shared/ai-caller.ts";

import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_ROLES = ['partner_admin', 'hr_recruiter', 'platform_admin'];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ALLOWED_ROLES);

    if (authResult.error) {
      const status = authResult.error.includes('Authentication') ? 401 : 403;
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { type, jobTitle, experienceLevel, industry, selectedSkills, primaryCloud, primaryLanguage, clientKeywords } = await req.json();
    console.log(`Generating ${type} suggestions for:`, jobTitle);

    let prompt = "";
    let systemPrompt = "";

    if (type === "skills") {
      systemPrompt = `You are an expert technical recruiter. Suggest relevant technical skills for job positions. 
Return a JSON object with this exact structure:
{
  "primarySkills": ["skill1", "skill2", ...],
  "secondarySkills": ["skill1", "skill2", ...],
  "inferredContext": {
    "cloud": "AWS|Azure|GCP|Multi-cloud|None",
    "primaryLanguage": "Java|Python|JavaScript|Go|C#|Other",
    "domain": "Backend|Frontend|FullStack|Data|DevOps|Mobile|AI/ML|Security|QA"
  }
}
Primary skills are must-have technical skills (8-12 skills).
Secondary skills are nice-to-have or complementary skills (5-8 skills).
Be specific - use actual technology names, not generic terms.`;

      prompt = `Suggest technical skills for this position:
- Job Title: ${jobTitle}
- Experience Level: ${experienceLevel}
- Industry: ${industry}
${primaryCloud ? `- Primary Cloud: ${primaryCloud}` : ''}
${primaryLanguage ? `- Primary Language: ${primaryLanguage}` : ''}
${clientKeywords ? `- Client Keywords (PRIORITIZE THESE): ${clientKeywords}` : ''}

Important:
1. For "${jobTitle}", identify the PRIMARY technology stack (e.g., "Java Full Stack" should prioritize Java AND JavaScript/TypeScript)
2. ${primaryCloud ? `Focus on ${primaryCloud.toUpperCase()}-specific tools and services` : 'Include cloud-specific tools if the title mentions a cloud provider'}
3. ${primaryLanguage ? `Prioritize ${primaryLanguage} frameworks and ecosystem tools` : 'Include language-specific frameworks (e.g., Spring Boot for Java, Django for Python)'}
4. ${clientKeywords ? `MUST include these client keywords as primary skills: ${clientKeywords}` : 'For data roles, include both processing tools (Spark, PySpark) AND orchestration tools (Airflow, Dagster)'}
5. Match skill complexity to experience level

Return ONLY valid JSON, no markdown.`;
    } 
    else if (type === "responsibilities") {
      systemPrompt = `You are an expert HR professional. Suggest job responsibilities based on role and skills.
Return a JSON object with this exact structure:
{
  "responsibilities": ["responsibility1", "responsibility2", ...]
}
Provide 8-12 specific, actionable responsibilities.
Each responsibility should be a single clear sentence starting with an action verb.
Tailor responsibilities to the experience level and selected skills.`;

      prompt = `Suggest responsibilities for this position:
- Job Title: ${jobTitle}
- Experience Level: ${experienceLevel}
- Industry: ${industry}
- Selected Skills: ${selectedSkills?.join(', ') || 'Not specified'}

Return ONLY valid JSON, no markdown.`;
    }
    else if (type === "challenges") {
      systemPrompt = `You are an expert technical recruiter. Suggest relevant project challenges and requirements.
Return a JSON object with this exact structure:
{
  "challenges": ["challenge1", "challenge2", ...],
  "preSelected": ["challenge1", "challenge2"]
}
Provide 8-10 relevant challenges.
preSelected should contain 2-3 most likely challenges for this role/industry.`;

      prompt = `Suggest project challenges for this position:
- Job Title: ${jobTitle}
- Experience Level: ${experienceLevel}
- Industry: ${industry}
- Selected Skills: ${selectedSkills?.join(', ') || 'Not specified'}

Consider industry-specific requirements (e.g., FinTech needs compliance, HealthTech needs HIPAA).
Match challenge complexity to experience level.

Return ONLY valid JSON, no markdown.`;
    }
    else {
      return new Response(
        JSON.stringify({ error: "Invalid suggestion type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use unified AI calling pattern with automatic token logging
    const content = await callAI({
      featureName: 'jd_content_suggestions',
      prompt: prompt,
      systemPrompt: systemPrompt,
      userId: authResult.user.id,
    });

    // Parse JSON from response
    let result;
    try {
      // Clean up potential markdown code blocks
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI suggestions");
    }

    console.log(`Successfully generated ${type} suggestions`);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating suggestions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
