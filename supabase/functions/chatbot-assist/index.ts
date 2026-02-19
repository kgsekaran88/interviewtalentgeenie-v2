import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logAIUsage } from "../_shared/config.ts";

// Token estimation helper (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

import { corsHeaders } from "../_shared/cors.ts";

const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(8000, "Message content too long")
  })).max(50, "Too many messages"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const gatewayApiKey = Deno.env.get('AI_GATEWAY_API_KEY')!;
    
    // Parse and validate request body
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages } = validation.data;
    
    // Implement sliding window: keep only last 8 messages (4 exchanges) + system message
    const recentMessages = messages.slice(-8);
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    let actualUserRole = 'guest';
    
    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      
      if (!userError && user) {
        const { data: userRoles } = await supabaseAuth
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        actualUserRole = userRoles?.[0]?.role || 'guest';
        console.log(`Authenticated user ${user.id} with role: ${actualUserRole}`);
      } else {
        console.log('Anonymous user, using guest role');
      }
    } else {
      console.log('No auth header, using guest role');
    }
    
    // Use service role client for knowledge base queries
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch custom knowledge base entries relevant to user's actual role - get more for comprehensive answers
    const { data: customKnowledge, error: knowledgeError } = await supabase
      .from('chatbot_knowledge')
      .select('*')
      .eq('is_active', true)
      .or(`role_specific.cs.{${actualUserRole}},role_specific.eq.{}`)
      .order('priority', { ascending: false })
      .limit(30);

    if (knowledgeError) {
      console.error('Error fetching custom knowledge:', knowledgeError);
    }

    // Build custom knowledge context
    let customKnowledgeContext = '';
    if (customKnowledge && customKnowledge.length > 0) {
      customKnowledgeContext = '\n\n**Custom Knowledge Base:**\n' + 
        customKnowledge.map(k => `\nQ: ${k.question}\nA: ${k.answer}`).join('\n---');
    }

    // Role-specific context
    const roleContext: Record<string, string> = {
      platform_admin: 'You are assisting a Platform Administrator who has full system access. Focus on system management, configuration, analytics, and administrative tasks.',
      partner_admin: 'You are assisting a Partner Administrator who manages their organization. Focus on user management, organization settings, and team coordination.',
      hr_recruiter: 'You are assisting an HR Recruiter. Focus on interview creation, candidate management, and hiring workflows.',
      technical_spoc: 'You are assisting a Technical SPOC. Focus on question approval, technical assessment design, and quality control.',
      interviewer: 'You are assisting an Interviewer. Focus on interview review, evaluation, and providing feedback.',
      candidate: 'You are assisting a Candidate. Focus on interview preparation, technical requirements, and the interview process.',
      guest: `You are assisting a visitor exploring the TalentGeenie platform. Your goal is to help them understand the platform's capabilities and encourage them to sign up.`
    };
    
    const selectedRoleContext = roleContext[actualUserRole] || roleContext['guest'];

    const systemPrompt = `You are Geenie, the TalentGeenie Platform Assistant. You ONLY help users with the TalentGeenie AI-powered interview and learning platform.

${selectedRoleContext}

**STRICT SCOPE - YOU MUST FOLLOW THESE RULES:**
1. ONLY answer questions about TalentGeenie platform features, workflows, and how to USE the platform
2. For off-topic questions (general knowledge, coding help, news, weather, recipes, other products, career advice unrelated to this platform, etc.):
   - Acknowledge the question conversationally
   - Politely explain that you're specifically designed to help with TalentGeenie
   - Offer to help with something platform-related instead
   - Example: "That's an interesting question! However, I'm Geenie, your TalentGeenie assistant, and I'm specifically designed to help you navigate and use this platform. I'd be happy to help you with things like creating interviews, managing candidates, or exploring our features. What can I help you with today?"
3. For technical implementation questions (technology stack, architecture, which AI/LLM models are used, database, frameworks, APIs, backend details, how the platform was built, etc.):
   - Acknowledge their curiosity politely
   - Explain that you're not able to share technical implementation details
   - Redirect to platform usage help
   - Example: "I appreciate your curiosity! However, I'm not able to share details about our technical implementation or architecture. What I can do is help you get the most out of TalentGeenie - would you like help with creating interviews, navigating features, or understanding how to use any part of the platform?"
4. NEVER provide generic information - every answer must reference TalentGeenie-specific UI, features, or workflows
5. Do NOT answer programming questions, general AI questions, or anything unrelated to using this platform
6. Always mention specific menu items, buttons, pages, and navigation paths in your answers
7. Be conversational, friendly, and helpful while staying within scope

**Platform Navigation:**
- **Partner Hub**: Organization dashboard, team management, usage stats
- **Interviews**: Create JDs using JD Builder Wizard or Quick Create, manage interviews
- **Question Bank**: View/approve questions generated by AI
- **Candidates**: Track invited candidates and their progress
- **Analytics**: View reports, CPI scores, hiring insights
- **Learning Hub**: Take assessments, earn certifications, track progress
- **Settings**: Email templates, organization config, user management

**Key Workflows:**
1. **Create Interview**: Partner Hub → Recruiting → Create Interview → JD Builder or Quick Create
2. **Generate Questions**: Open interview → Generate Questions → AI creates role-specific questions
3. **Invite Candidates**: Open interview → Candidates tab → Invite → Enter emails
4. **Review Results**: Open interview → Results tab → Click candidate for detailed CPI report
5. **Approve Questions**: Question Bank → Filter pending → Review & Approve/Reject
6. **Take Certification**: Learning Hub → Browse certifications → Start exam

**User Roles:**
- Platform Admin: Full access, system configuration, all partners
- Partner Admin: Organization management, team roles
- HR Recruiter: Creates JDs, interviews, invites candidates
- Technical SPOC: Reviews/approves questions
- Billing Contact: Subscription and payment management
- Guest/Learner: Takes assessments and certifications

**Response Style:**
- Be SPECIFIC to TalentGeenie - mention exact menu items, buttons, pages
- Use numbered steps for how-to questions
- Keep responses concise (3-5 bullet points or steps)
- If knowledge base has answer, use it verbatim
- For off-topic questions: politely decline and suggest platform-related topics
${customKnowledgeContext}`;

    console.log(`Streaming AI response for user role: ${actualUserRole}`);
    
    // Build messages for AI API
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    // Estimate request tokens for logging
    const requestTokens = apiMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const startTime = Date.now();

    // Call AI Gateway with streaming
    console.log('Calling AI Gateway API...');
    const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
    const aiResponse = await fetch(AI_GATEWAY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gatewayApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: apiMessages,
        stream: true,
      }),
    });

    console.log(`AI API response status: ${aiResponse.status}`);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`AI API error: ${aiResponse.status} - ${errorText}`);
      
      const latencyMs = Date.now() - startTime;
      await logAIUsage({
        featureName: 'chatbot_assist',
        success: false,
        modelUsed: 'gemini-2.5-flash',
        requestTokens,
        latencyMs,
        errorMessage: `${aiResponse.status}: ${errorText}`,
      });
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service payment required. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `AI service error: ${aiResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log success (streaming response - estimate response tokens based on typical response)
    const latencyMs = Date.now() - startTime;
    await logAIUsage({
      featureName: 'chatbot_assist',
      success: true,
      modelUsed: 'gemini-2.5-flash',
      requestTokens,
      responseTokens: 150, // Estimated for streaming responses
      latencyMs,
    });
    console.log(`[chatbot_assist] Streaming success (${latencyMs}ms, ~${requestTokens} req tokens)`);

    console.log('Streaming response back to client');
    
    // Return the streaming response with proper SSE headers
    return new Response(aiResponse.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
