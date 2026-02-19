import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { corsHeaders } from '../_shared/cors.ts';


const ALLOWED_ROLES = ['partner_admin', 'hr_recruiter'];

serve(async (req) => {
  const logger = createLogger('generate-predictive-analytics');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ALLOWED_ROLES);

    if (authResult.error) {
      logger.warn('Authentication/authorization failed', { error: authResult.error });
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authHeader ? 403 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user, supabase } = authResult;
    const { organization_id, model_type, period_start, period_end } = await req.json();

    logger.info('Generating predictive analytics', { organization_id, model_type, userId: user.id });

    // Fetch historical data for analysis
    const { data: assessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select(`
        *,
        interview_attempts!inner(
          candidate_email,
          candidate_name,
          interviews!inner(organization_id)
        )
      `)
      .eq('interview_attempts.interviews.organization_id', organization_id)
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    if (assessmentsError) throw assessmentsError;

    const prompt = `Analyze this hiring data and generate predictive analytics:
${JSON.stringify(assessments, null, 2)}

Return JSON with predictions, accuracy_metrics, feature_importance, and recommendations.`;

    // Use unified AI calling pattern with automatic token logging
    const content = await callAI({
      featureName: 'predictive_analytics',
      prompt: prompt,
      systemPrompt: 'You are an expert data scientist specializing in hiring analytics and predictive modeling. Return valid JSON only.',
      organizationId: organization_id,
      userId: user.id,
    });

    const analysis = JSON.parse(content);

    // Store analytics results
    const { data: analyticsRecord, error: insertError } = await supabase
      .from('predictive_analytics')
      .insert({
        organization_id,
        model_type,
        analysis_period: `[${period_start},${period_end}]`,
        predictions: analysis.predictions,
        accuracy_metrics: analysis.accuracy_metrics,
        feature_importance: analysis.feature_importance,
        recommendations: analysis.recommendations,
        model_version: 'v1.0'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    logger.info('Predictive analytics generated', { analyticsId: analyticsRecord.id });

    return new Response(
      JSON.stringify({ success: true, analytics: analyticsRecord }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const logger = createLogger('generate-predictive-analytics');
    logger.error('Error in generate-predictive-analytics', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
