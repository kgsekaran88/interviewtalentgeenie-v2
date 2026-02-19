import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  const logger = createLogger('analyze-violations');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Violation analysis request started');
    
    const authHeader = req.headers.get('Authorization');
    // Roles: partner_admin, hr_recruiter, tech_spoc can analyze violations
    const authResult = await authenticateRequest(authHeader, ['partner_admin', 'hr_recruiter', 'tech_spoc']);

    if (authResult.error) {
      logger.warn('Authentication failed', { error: authResult.error });
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.error.includes('required') ? 401 : 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user, supabase, supabaseAuth } = authResult;
    logger.info('User authenticated', { userId: user.id });

    const { sessionId } = await req.json();

    if (!sessionId) {
      logger.warn('Session ID not provided');
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('Analyzing violations', { sessionId });

    // Fetch proctoring session with related data for authorization and org context
    const { data: session, error: sessionError } = await supabase
      .from('proctoring_sessions')
      .select(`
        *,
        interview_attempts!inner (
          interview_id,
          interviews!inner (
            creator_id,
            organization_id
          )
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      logger.error('Session not found', sessionError, { sessionId });
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract organization context for usage tracking
    const organizationId = session.interview_attempts?.interviews?.organization_id;
    const interviewId = session.interview_attempts?.interview_id;
    const interviewCreatorId = session.interview_attempts?.interviews?.creator_id;

    // Authorization check using auth client
    const { data: userRoles } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isCreator = session.interview_attempts?.interviews?.creator_id === user.id;
    const hasRole = userRoles?.some((r: any) => ['platform_admin', 'hr_recruiter', 'partner_admin', 'tech_spoc'].includes(r.role));

    if (!isCreator && !hasRole) {
      logger.warn('Unauthorized analysis attempt', { userId: user.id, sessionId });
      return new Response(JSON.stringify({ error: 'Unauthorized to analyze this session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('Authorization verified for violation analysis');

    // Prepare violation data for AI analysis
    const violationData = {
      tab_switches: session.tab_switch_count || 0,
      multiple_persons: session.multiple_person_detections || 0,
      multiple_voices: session.multiple_voice_detections || 0,
      look_aways: session.look_away_count || 0,
      copy_attempts: session.copy_attempt_count || 0,
      violations: session.violations || [],
      detailed_violations: session.detailed_violations || [],
      eye_movements: session.eye_movement_violations || [],
      duration: session.ended_at && session.created_at 
        ? (new Date(session.ended_at).getTime() - new Date(session.created_at).getTime()) / 1000 / 60
        : null
    };

    const promptText = `Analyze this proctoring session data and provide a comprehensive risk assessment:

Violation Counts:
- Tab switches: ${violationData.tab_switches}
- Multiple persons detected: ${violationData.multiple_persons}
- Multiple voices detected: ${violationData.multiple_voices}
- Look away incidents: ${violationData.look_aways}
- Copy attempts: ${violationData.copy_attempts}

Session Duration: ${violationData.duration ? `${violationData.duration.toFixed(1)} minutes` : 'In progress'}

Provide:
1. Risk Score (0-100, where 0 is highest risk, 100 is no risk)
2. Risk Level (low/medium/high/critical)
3. Behavioral Patterns (array of suspicious patterns detected)
4. Recommendations (array of recommended actions)
5. Summary (brief analysis)

Return ONLY a JSON object with this exact structure:
{
  "riskScore": number,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "patterns": string[],
  "recommendations": string[],
  "summary": string
}`;

    const analysisContent = await callAI({
      featureName: 'violation_analysis',
      prompt: promptText,
      systemPrompt: 'You are a proctoring violation analyst. Provide objective risk assessments. Return ONLY valid JSON without any markdown formatting or code blocks.',
      organizationId,
      userId: interviewCreatorId,
      interviewId
    });

    // Strip markdown code blocks if present (AI sometimes wraps response in ```json ... ```)
    let cleanedContent = analysisContent.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const analysis = JSON.parse(cleanedContent);

    // Update session with AI analysis
    const { error: updateError } = await supabase
      .from('proctoring_sessions')
      .update({
        integrity_score: analysis.riskScore,
        flagged_for_review: analysis.riskLevel === 'high' || analysis.riskLevel === 'critical'
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const logger = createLogger('analyze-violations');
    logger.error('Fatal error in analyze-violations', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An error occurred during violation analysis'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});