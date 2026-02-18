import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  prompt: z.string()
    .min(10, "Prompt must be at least 10 characters")
    .max(5000, "Prompt must be under 5000 characters"),
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

    const { prompt } = validation.data;

    console.log(`Generating documentation for user ${user.id}:`, prompt.substring(0, 100) + "...");

    const systemPrompt = `You are a technical documentation expert for the TalentGeenie Platform. Generate comprehensive, well-structured documentation based on user requests.

**Platform Overview:**
The TalentGeenie Platform is an AI-driven hiring intelligence platform with 8 distinct user roles, comprehensive proctoring, learning management, and advanced analytics capabilities.

**8 User Roles & Access Levels:**
1. **PLATFORM ADMIN (platform_admin)** - Highest level, full platform control
2. **PARTNER ADMIN (partner_admin)** - Organization-level management
3. **HR RECRUITER (hr_recruiter)** - Hiring and recruitment management
4. **TECH SPOC / INTERVIEWER (tech_spoc, interviewer)** - Technical interview and evaluation
5. **CANDIDATE (candidate)** - Interview participant and learner
6. **BILLING CONTACT (billing_contact)** - Financial management
7. **GUEST (guest)** - Limited public access
8. **SHARED FEATURES** - All authenticated users

**Core Platform Features:**
- Interview Management with AI-powered question generation
- Proctoring & Integrity monitoring
- Analytics & Reporting
- Learning & Certification
- Multi-Tenancy & RBAC
- Billing & Subscription
- AI Features (resume parsing, question generation, evaluation)

**Documentation Format:**
- Use clear markdown formatting with headers, lists, and code blocks
- Include step-by-step instructions where applicable
- Add examples and use cases for different user roles
- Structure with: Overview, Features, How to Use (role-specific), Best Practices, Troubleshooting
- Be comprehensive but concise
- Use professional technical writing style
- Always specify which roles have access to features
- Include security and compliance considerations`;

    // Use unified AI calling pattern with automatic token logging
    const content = await callAI({
      featureName: 'documentation_generation',
      prompt: prompt,
      systemPrompt: systemPrompt,
      userId: user.id,
    });

    console.log("Documentation generated successfully");

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Documentation generation error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
