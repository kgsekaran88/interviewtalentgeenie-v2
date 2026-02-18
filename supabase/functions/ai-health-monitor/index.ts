import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest } from "../_shared/auth-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Scheduled AI Health Monitoring
 * Runs every 5 minutes to check AI feature health
 * Creates alerts when features fail or recover
 * 
 * SECURITY: Requires platform_admin role for manual invocation
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate and authorize - only platform admins can trigger health checks
    const authHeader = req.headers.get('Authorization');
    const authResult = await authenticateRequest(authHeader, ['platform_admin']);
    
    if (authResult.error) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { 
          status: authHeader ? 403 : 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { user, supabase } = authResult;

    console.log(`[AI Health Monitor] Starting health check requested by ${user.email}...`);

    // Get all enabled AI features
    const { data: features, error: featuresError } = await supabase
      .from('ai_feature_health')
      .select('*')
      .eq('is_enabled', true);

    if (featuresError) throw featuresError;

    if (!features || features.length === 0) {
      console.log('[AI Health Monitor] No features to monitor');
      return new Response(
        JSON.stringify({ success: true, message: 'No features to monitor' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const alerts = [];
    let healthyCount = 0;
    let degradedCount = 0;
    let failedCount = 0;

    for (const feature of features) {
      try {
        const startTime = Date.now();

        // Query recent logs for this function
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        const { data: logs, error: logsError } = await supabase
          .from('edge_function_logs')
          .select('*')
          .eq('function_name', feature.edge_function)
          .gte('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(100);

        if (logsError) {
          console.error(`[AI Health Monitor] Error fetching logs for ${feature.edge_function}:`, logsError);
          continue;
        }

        // Analyze logs
        const errorLogs = logs?.filter((log: any) => 
          log.level === 'error' || 
          log.event_message?.toLowerCase().includes('error')
        ) || [];
        
        const errorCount = errorLogs.length;
        const totalLogs = logs?.length || 0;
        
        let newStatus: 'healthy' | 'degraded' | 'failed' = 'healthy';
        let lastError = '';

        if (totalLogs > 0) {
          const errorRate = errorCount / totalLogs;
          
          if (errorRate === 0) {
            newStatus = 'healthy';
          } else if (errorRate < 0.3) {
            newStatus = 'degraded';
          } else {
            newStatus = 'failed';
            if (errorLogs[0]) {
              lastError = errorLogs[0].event_message || 'Unknown error';
            }
          }
        }

        // Update counts
        if (newStatus === 'healthy') healthyCount++;
        else if (newStatus === 'degraded') degradedCount++;
        else failedCount++;

        const responseTime = Date.now() - startTime;
        const oldStatus = feature.status;
        const consecutiveFailures = newStatus === 'failed' 
          ? (feature.consecutive_failures || 0) + 1 
          : 0;

        // Update feature health
        await supabase.from('ai_feature_health').update({
          status: newStatus,
          last_check_at: new Date().toISOString(),
          last_error_message: lastError || null,
          last_error_at: errorCount > 0 ? new Date().toISOString() : feature.last_error_at,
          last_success_at: newStatus === 'healthy' ? new Date().toISOString() : feature.last_success_at,
          consecutive_failures: consecutiveFailures,
          total_requests: (feature.total_requests || 0) + totalLogs,
          failed_requests: (feature.failed_requests || 0) + errorCount,
          successful_requests: (feature.successful_requests || 0) + (totalLogs - errorCount),
        }).eq('feature_id', feature.feature_id);

        // Log health check
        await supabase.from('ai_health_checks').insert({
          feature_id: feature.feature_id,
          check_type: 'scheduled',
          status: newStatus,
          response_time_ms: responseTime,
          error_message: lastError || null,
          metadata: { error_count: errorCount, total_logs: totalLogs },
        });

        // Create alerts for status changes
        if (oldStatus !== newStatus) {
          let alertType: 'feature_down' | 'high_failure_rate' | 'recovered' = 'recovered';
          let severity: 'info' | 'warning' | 'critical' = 'info';
          let message = '';

          if (newStatus === 'failed' && oldStatus !== 'failed') {
            alertType = 'feature_down';
            severity = 'critical';
            message = `AI feature "${feature.feature_name}" has failed. ${consecutiveFailures} consecutive failures. Last error: ${lastError}`;
          } else if (newStatus === 'degraded' && oldStatus === 'healthy') {
            alertType = 'high_failure_rate';
            severity = 'warning';
            message = `AI feature "${feature.feature_name}" is experiencing issues. Error rate: ${((errorCount / totalLogs) * 100).toFixed(1)}%`;
          } else if (newStatus === 'healthy' && oldStatus !== 'healthy') {
            alertType = 'recovered';
            severity = 'info';
            message = `AI feature "${feature.feature_name}" has recovered and is now healthy.`;
          }

          if (message) {
            const { error: alertError } = await supabase.from('ai_health_alerts').insert({
              feature_id: feature.feature_id,
              alert_type: alertType,
              severity,
              message,
            });

            if (alertError) {
              console.error('[AI Health Monitor] Error creating alert:', alertError);
            } else {
              alerts.push({ feature: feature.feature_name, type: alertType, severity });
            }
          }
        }

        // Auto-retry with fallback if enabled
        if (
          newStatus === 'failed' && 
          feature.auto_retry_enabled && 
          feature.fallback_enabled && 
          feature.fallback_model &&
          consecutiveFailures >= (feature.max_retry_attempts || 3)
        ) {
          console.log(`[AI Health Monitor] Switching ${feature.feature_name} to fallback model: ${feature.fallback_model}`);
          
          await supabase.from('ai_feature_health').update({
            current_model: feature.fallback_model,
          }).eq('feature_id', feature.feature_id);

          await supabase.from('ai_health_alerts').insert({
            feature_id: feature.feature_id,
            alert_type: 'feature_down',
            severity: 'warning',
            message: `AI feature "${feature.feature_name}" switched to fallback model: ${feature.fallback_model}`,
          });

          alerts.push({ 
            feature: feature.feature_name, 
            type: 'fallback_activated', 
            model: feature.fallback_model 
          });
        }

      } catch (err) {
        console.error(`[AI Health Monitor] Error monitoring ${feature.feature_name}:`, err);
      }
    }

    console.log(`[AI Health Monitor] Check complete. Healthy: ${healthyCount}, Degraded: ${degradedCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        checked_at: new Date().toISOString(),
        features_checked: features.length,
        healthy_count: healthyCount,
        degraded_count: degradedCount,
        failed_count: failedCount,
        alerts_created: alerts.length,
        alerts,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[AI Health Monitor] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
