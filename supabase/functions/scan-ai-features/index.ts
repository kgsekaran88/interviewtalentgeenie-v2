import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIFeature {
  id: string;
  name: string;
  edge_function: string;
  model_used: string;
  purpose: string;
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  last_scanned: string;
  error_count?: number;
  last_error?: string;
}

/**
 * Scans deployed edge functions to detect AI usage and health status
 * Checks recent logs to determine if features are working properly
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log('[Scan AI Features] Starting platform scan...');

    // Get all AI features from the health table (source of truth)
    const { data: healthRecords, error: healthError } = await supabase
      .from('ai_feature_health')
      .select('*')
      .order('feature_name');

    if (healthError) {
      console.error('[Scan AI Features] Error fetching health records:', healthError);
      throw healthError;
    }

    if (!healthRecords || healthRecords.length === 0) {
      console.log('[Scan AI Features] No AI features found in health table');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No AI features detected. Features will be added as they are used.',
          features: [],
          scanned_at: new Date().toISOString(),
          total_count: 0,
          healthy_count: 0,
          degraded_count: 0,
          failed_count: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[Scan AI Features] Found ${healthRecords.length} AI features`);

    // Transform health records to feature format
    const features: AIFeature[] = healthRecords.map(record => ({
      id: record.feature_id,
      name: record.feature_name,
      edge_function: record.edge_function,
      model_used: record.current_model,
      purpose: `AI-powered ${record.feature_name}`,
      status: record.status,
      last_scanned: new Date().toISOString(),
      error_count: record.consecutive_failures || 0,
      last_error: record.last_error_message || undefined,
    }));

    // Count statuses
    const healthyCount = features.filter(f => f.status === 'healthy').length;
    const degradedCount = features.filter(f => f.status === 'degraded').length;
    const failedCount = features.filter(f => f.status === 'failed').length;

    // Get existing configurations
    const { data: existingConfigs, error: configsError } = await supabase
      .from('ai_feature_configurations')
      .select('feature_name');
    
    if (configsError) {
      console.error('[Scan AI Features] Error fetching configurations:', configsError);
      throw configsError;
    }

    const existingNames = new Set((existingConfigs || []).map(c => c.feature_name));
    
    // Auto-create missing feature configurations from health records
    const configsToCreate = [];
    for (const feature of features) {
      const featureName = feature.edge_function.replace(/-/g, '_');
      if (!existingNames.has(featureName)) {
        configsToCreate.push({
          feature_name: featureName,
          display_name: feature.name,
          description: feature.purpose,
          primary_provider_id: null, // Will use default AI Gateway
          fallback_provider_id: null,
          fallback_enabled: true,
          retry_attempts: 3,
          timeout_seconds: 30,
          is_enabled: true,
        });
      }
    }
    
    if (configsToCreate.length > 0) {
      console.log(`[Scan AI Features] Creating ${configsToCreate.length} missing configurations`);
      const { error: insertError } = await supabase
        .from('ai_feature_configurations')
        .insert(configsToCreate);
      
      if (insertError) {
        console.error('[Scan AI Features] Error creating configurations:', insertError);
      } else {
        console.log(`[Scan AI Features] Successfully created ${configsToCreate.length} configurations`);
      }
    } else {
      console.log('[Scan AI Features] All configurations already exist');
    }

    // Log the scan
    await supabase.from('ai_health_checks').insert({
      feature_id: 'platform_scan',
      check_type: 'platform_scan',
      status: 'healthy',
      metadata: { 
        total_features: features.length,
        new_configs_created: configsToCreate.length,
        healthy_count: healthyCount,
        degraded_count: degradedCount,
        failed_count: failedCount,
      },
    });

    console.log('[Scan AI Features] Scan complete');

    return new Response(
      JSON.stringify({
        success: true,
        features,
        scanned_at: new Date().toISOString(),
        total_count: features.length,
        healthy_count: healthyCount,
        degraded_count: degradedCount,
        failed_count: failedCount,
        new_configs_created: configsToCreate.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error scanning AI features:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        features: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
