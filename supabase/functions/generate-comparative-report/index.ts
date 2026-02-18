import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = ['partner_admin', 'hr_recruiter'];

serve(async (req) => {
  const logger = createLogger('generate-comparative-report');
  
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
    const { organization_id, comparison_type, entities, period_start, period_end } = await req.json();

    logger.info('Generating comparative analytics', { organization_id, comparison_type, userId: user.id });

    // Fetch data for comparison entities
    const metricsData = [];
    
    for (const entity of entities) {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          overall_score,
          technical_score,
          problem_solving_score,
          hiring_decision,
          cpi_score,
          interview_attempts!inner(
            time_taken,
            interviews!inner(title, role_type)
          )
        `)
        .eq('interview_attempts.interviews.organization_id', organization_id)
        .gte('created_at', period_start)
        .lte('created_at', period_end);

      if (error) throw error;
      
      metricsData.push({
        entity: entity,
        assessments: data
      });
    }

    // Calculate comparative metrics
    const metrics = metricsData.map(item => ({
      entity: item.entity,
      avg_score: item.assessments.reduce((acc: number, a: any) => acc + a.overall_score, 0) / item.assessments.length,
      avg_cpi: item.assessments.reduce((acc: number, a: any) => acc + (a.cpi_score || 0), 0) / item.assessments.length,
      hire_rate: item.assessments.filter((a: any) => ['strongly_recommend', 'recommend', 'strong_hire', 'hire'].includes(a.hiring_decision?.toLowerCase())).length / item.assessments.length,
      total_candidates: item.assessments.length,
      avg_technical: item.assessments.reduce((acc: number, a: any) => acc + a.technical_score, 0) / item.assessments.length,
      avg_problem_solving: item.assessments.reduce((acc: number, a: any) => acc + a.problem_solving_score, 0) / item.assessments.length
    }));

    // Generate AI insights using unified AI caller with automatic token logging
    const prompt = `Analyze comparative hiring metrics and provide insights:

Comparison Type: ${comparison_type}
Metrics: ${JSON.stringify(metrics, null, 2)}

Provide:
1. Key differences and patterns
2. Performance rankings
3. Areas of strength and weakness
4. Actionable recommendations

Return JSON with:
{
  "insights": ["Insight 1", "Insight 2", ...],
  "rankings": [{"entity": "...", "rank": 1, "score": 85}],
  "strengths": {"entity1": ["strength1", ...], ...},
  "weaknesses": {"entity1": ["weakness1", ...], ...},
  "recommendations": ["Recommendation 1", ...]
}`;

    const content = await callAI({
      featureName: 'comparative_analytics',
      prompt: prompt,
      systemPrompt: 'You are an expert in HR analytics and comparative analysis. Return valid JSON only.',
      organizationId: organization_id,
      userId: user.id,
    });

    const analysis = JSON.parse(content);

    // Prepare visualization data
    const visualizationData = {
      charts: [
        {
          type: 'bar',
          title: 'Average Scores Comparison',
          data: metrics.map(m => ({ label: m.entity, value: m.avg_score }))
        },
        {
          type: 'line',
          title: 'CPI Trends',
          data: metrics.map(m => ({ label: m.entity, value: m.avg_cpi }))
        },
        {
          type: 'pie',
          title: 'Hire Rate Distribution',
          data: metrics.map(m => ({ label: m.entity, value: m.hire_rate * 100 }))
        }
      ]
    };

    // Store comparative analytics
    const { data: analyticsRecord, error: insertError } = await supabase
      .from('comparative_analytics')
      .insert({
        organization_id,
        comparison_type,
        entities: entities,
        metrics: metrics,
        insights: analysis,
        visualization_data: visualizationData,
        period_start,
        period_end
      })
      .select()
      .single();

    if (insertError) throw insertError;

    logger.info('Comparative analytics generated', { analyticsId: analyticsRecord.id });

    return new Response(
      JSON.stringify({ success: true, analytics: analyticsRecord }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const logger = createLogger('generate-comparative-report');
    logger.error('Error in generate-comparative-report', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
