import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { integrationId, force = false } = await req.json();

    if (!integrationId) {
      return new Response(
        JSON.stringify({ error: "integrationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting ATS sync for integration ${integrationId}`);

    // Get integration details
    const { data: integration, error: integrationError } = await supabase
      .from("ats_integrations")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!integration.sync_enabled && !force) {
      return new Response(
        JSON.stringify({ error: "Sync is not enabled for this integration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from("ats_sync_logs")
      .insert({
        integration_id: integrationId,
        sync_type: force ? 'manual' : 'scheduled',
        status: 'success',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating sync log:", logError);
    }

    // In a real implementation, this would call the external ATS API
    // For now, we'll simulate a successful sync
    const mockCandidates = [];
    let candidatesSynced = 0;
    let candidatesFailed = 0;

    // Simulate processing candidates
    // In production, fetch from external ATS API and process
    
    // Update sync log
    await supabase
      .from("ats_sync_logs")
      .update({
        candidates_synced: candidatesSynced,
        candidates_failed: candidatesFailed,
        status: candidatesFailed > 0 ? 'partial' : 'success',
        completed_at: new Date().toISOString(),
        details: {
          message: "Sync completed successfully",
          total_processed: candidatesSynced + candidatesFailed,
        }
      })
      .eq("id", syncLog?.id);

    // Update integration last sync time
    await supabase
      .from("ats_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        status: 'active'
      })
      .eq("id", integrationId);

    console.log(`ATS sync completed. Synced: ${candidatesSynced}, Failed: ${candidatesFailed}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        candidatesSynced,
        candidatesFailed,
        syncLog
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-ats-candidates function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
