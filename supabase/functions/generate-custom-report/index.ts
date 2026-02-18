import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = ['partner_admin', 'hr_recruiter'];

serve(async (req) => {
  const logger = createLogger('generate-custom-report');
  
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
    const { template_id, organization_id, period_start, period_end, format } = await req.json();

    logger.info('Generating custom report', { template_id, organization_id, format, userId: user.id });

    // Fetch report template
    const { data: template, error: templateError } = await supabase
      .from('report_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) throw new Error('Report template not found');

    // Build query based on template configuration
    let query = supabase
      .from('assessments')
      .select(`
        *,
        interview_attempts!inner(
          candidate_email,
          candidate_name,
          time_taken,
          interviews!inner(
            title,
            role_type,
            organization_id
          )
        )
      `)
      .eq('interview_attempts.interviews.organization_id', organization_id)
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    // Apply template filters
    if (template.filters) {
      Object.entries(template.filters).forEach(([key, value]) => {
        if (value) {
          query = query.eq(key, value);
        }
      });
    }

    const { data: assessments, error: assessmentsError } = await query;
    if (assessmentsError) throw assessmentsError;

    // Calculate metrics based on template configuration
    const reportData: any = {
      summary: {
        total_candidates: assessments.length,
        period: { start: period_start, end: period_end }
      },
      metrics: {}
    };

    // Calculate each metric specified in template
    if (template.metrics.includes('avg_score')) {
      reportData.metrics.avg_score = 
        assessments.reduce((sum: number, a: any) => sum + a.overall_score, 0) / assessments.length;
    }

    if (template.metrics.includes('hire_rate')) {
      // Support both old and new hiring decision values (backend: strongly_recommend/recommend, legacy: strong_hire/hire)
      const hireDecisions = ['strongly_recommend', 'recommend', 'strong_hire', 'hire'];
      const hireCount = assessments.filter((a: any) => hireDecisions.includes(a.hiring_decision?.toLowerCase())).length;
      reportData.metrics.hire_rate = assessments.length > 0 ? hireCount / assessments.length : 0;
    }

    if (template.metrics.includes('avg_cpi')) {
      reportData.metrics.avg_cpi = 
        assessments.reduce((sum: number, a: any) => sum + (a.cpi_score || 0), 0) / assessments.length;
    }

    if (template.metrics.includes('technical_avg')) {
      reportData.metrics.technical_avg = 
        assessments.reduce((sum: number, a: any) => sum + a.technical_score, 0) / assessments.length;
    }

    if (template.metrics.includes('problem_solving_avg')) {
      reportData.metrics.problem_solving_avg = 
        assessments.reduce((sum: number, a: any) => sum + a.problem_solving_score, 0) / assessments.length;
    }

    if (template.metrics.includes('time_to_hire')) {
      // Calculate average time from interview to hire decision
      // Support both old and new hiring decision values
      const hireDecisions = ['strongly_recommend', 'strong_hire'];
      const hiredCandidates = assessments.filter((a: any) => hireDecisions.includes(a.hiring_decision?.toLowerCase()));
      reportData.metrics.avg_time_to_hire = 
        hiredCandidates.reduce((sum: number, a: any) => {
          const timeDiff = new Date(a.created_at).getTime() - new Date(a.interview_attempts.interviews.created_at || a.created_at).getTime();
          return sum + timeDiff;
        }, 0) / (hiredCandidates.length || 1) / (1000 * 60 * 60 * 24); // Convert to days
    }

    // Apply grouping if specified
    if (template.grouping && template.grouping.length > 0) {
      reportData.grouped_data = {};
      template.grouping.forEach((groupField: string) => {
        const grouped = assessments.reduce((acc: Record<string, any[]>, assessment: any) => {
          const key = assessment[groupField] || 'Unknown';
          if (!acc[key]) acc[key] = [];
          acc[key].push(assessment);
          return acc;
        }, {} as Record<string, any[]>);
        reportData.grouped_data[groupField] = grouped;
      });
    }

    // Add visualization data
    reportData.visualizations = [];
    if (template.visualization_config?.charts) {
      template.visualization_config.charts.forEach((chartConfig: any) => {
        if (chartConfig.type === 'trend') {
          // Time-series data
          const trendData = assessments.reduce((acc: Record<string, { date: string; count: number; total_score: number }>, a: any) => {
            const date = new Date(a.created_at).toISOString().split('T')[0];
            if (!acc[date]) acc[date] = { date, count: 0, total_score: 0 };
            acc[date].count++;
            acc[date].total_score += a.overall_score;
            return acc;
          }, {} as Record<string, { date: string; count: number; total_score: number }>);
          
          reportData.visualizations.push({
            type: 'trend',
            title: 'Assessment Trends',
            data: Object.values(trendData).map((d: any) => ({
              date: d.date,
              avg_score: d.total_score / d.count,
              count: d.count
            }))
          });
        }

        if (chartConfig.type === 'distribution') {
          // Score distribution
          const bins = [0, 20, 40, 60, 80, 100];
          const distribution = bins.slice(0, -1).map((min, idx) => ({
            range: `${min}-${bins[idx + 1]}`,
            count: assessments.filter((a: any) => a.overall_score >= min && a.overall_score < bins[idx + 1]).length
          }));
          
          reportData.visualizations.push({
            type: 'distribution',
            title: 'Score Distribution',
            data: distribution
          });
        }
      });
    }

    // Store generated report
    const { data: generatedReport, error: reportError } = await supabase
      .from('generated_reports')
      .insert({
        template_id,
        organization_id,
        report_data: reportData,
        period_start,
        period_end,
        generated_by: user.id,
        format: format || 'json',
        status: 'completed'
      })
      .select()
      .single();

    if (reportError) throw reportError;

    logger.info('Custom report generated', { reportId: generatedReport.id });

    return new Response(
      JSON.stringify({
        success: true,
        report: generatedReport,
        data: reportData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const logger = createLogger('generate-custom-report');
    logger.error('Error in generate-custom-report', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
