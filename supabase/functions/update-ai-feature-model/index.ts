import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


/**
 * Update AI Feature Model Configuration
 * Allows admins to change models per feature and enable A/B testing
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceKey);

    const { 
      feature_id, 
      model, 
      fallback_model, 
      fallback_enabled,
      auto_retry_enabled,
      max_retry_attempts,
      start_ab_test 
    } = await req.json();

    if (!feature_id) {
      throw new Error('feature_id is required');
    }

    // Get current feature configuration
    const { data: feature, error: fetchError } = await supabase
      .from('ai_feature_health')
      .select('*')
      .eq('feature_id', feature_id)
      .single();

    if (fetchError) throw fetchError;
    if (!feature) throw new Error('Feature not found');

    const updates: any = {};
    
    if (model) {
      updates.current_model = model;
      
      // If changing model, reset failure count
      if (model !== feature.current_model) {
        updates.consecutive_failures = 0;
        updates.last_error_message = null;
      }
    }
    
    if (fallback_model !== undefined) updates.fallback_model = fallback_model;
    if (fallback_enabled !== undefined) updates.fallback_enabled = fallback_enabled;
    if (auto_retry_enabled !== undefined) updates.auto_retry_enabled = auto_retry_enabled;
    if (max_retry_attempts !== undefined) updates.max_retry_attempts = max_retry_attempts;

    // Update feature configuration
    const { error: updateError } = await supabase
      .from('ai_feature_health')
      .update(updates)
      .eq('feature_id', feature_id);

    if (updateError) throw updateError;

    // If starting an A/B test
    if (start_ab_test && model) {
      // End any active tests for this feature
      await supabase
        .from('ai_model_performance')
        .update({ is_active_test: false, test_period_end: new Date().toISOString() })
        .eq('feature_id', feature_id)
        .eq('is_active_test', true);

      // Start new test
      await supabase.from('ai_model_performance').insert({
        feature_id,
        model_name: model,
        test_period_start: new Date().toISOString(),
        is_active_test: true,
      });

      console.log(`[AI Model Update] Started A/B test for ${feature_id} with model ${model}`);
    }

    // Log the change
    await supabase.from('audit_logs').insert({
      action: 'UPDATE',
      table_name: 'ai_feature_health',
      record_id: feature.id,
      metadata: {
        feature_id,
        changes: updates,
        previous_model: feature.current_model,
        new_model: model,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'AI feature configuration updated successfully',
        feature_id,
        updates,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[AI Model Update] Error:', error);
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
