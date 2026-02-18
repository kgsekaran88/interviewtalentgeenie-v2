import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const webhookSignature = req.headers.get("x-webhook-signature");
    
    // Get raw body for signature verification
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { integrationId, event, candidate } = body;

    if (!integrationId || !event || !candidate) {
      return new Response(
        JSON.stringify({ error: "integrationId, event, and candidate are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Received webhook for integration ${integrationId}: ${event}`);

    // Verify integration exists
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

    // Verify HMAC-SHA256 signature with timestamp (prevents replay attacks)
    if (integration.webhook_secret && webhookSignature) {
      const timestamp = req.headers.get("x-webhook-timestamp");
      
      // Verify timestamp exists and is recent (within 5 minutes)
      if (!timestamp) {
        console.error('Missing webhook timestamp');
        return new Response(
          JSON.stringify({ error: "Missing webhook timestamp" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const timestampSeconds = parseInt(timestamp);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestampSeconds) > 300) {
        console.error('Webhook timestamp too old or future:', { timestamp, now });
        return new Response(
          JSON.stringify({ error: "Request timestamp invalid - must be within 5 minutes" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Compute HMAC-SHA256 signature with timestamp binding
      const signedPayload = `${timestamp}.${rawBody}`;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(integration.webhook_secret);
      const messageData = encoder.encode(signedPayload);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const computedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Constant-time comparison to prevent timing attacks
      const receivedSig = webhookSignature.toLowerCase();
      if (computedSignature.length !== receivedSig.length) {
        console.error('Signature length mismatch');
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let signaturesMatch = true;
      for (let i = 0; i < computedSignature.length; i++) {
        if (computedSignature[i] !== receivedSig[i]) {
          signaturesMatch = false;
        }
      }
      
      if (!signaturesMatch) {
        console.error('Signature verification failed');
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Check for duplicate request (replay attack prevention)
      const requestId = body.requestId || body.id || body.candidate?.id;
      if (requestId) {
        const { data: existing } = await supabase
          .from("audit_logs")
          .select("id")
          .eq("action", "WEBHOOK_RECEIVED")
          .eq("table_name", "ats_webhook")
          .eq("metadata->>request_id", requestId)
          .single();
        
        if (existing) {
          console.error('Duplicate webhook request:', requestId);
          return new Response(
            JSON.stringify({ error: "Duplicate request - already processed" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Process webhook event
    if (event === "candidate.created" || event === "candidate.updated") {
      // Upsert candidate data
      const { data: atsCandidate, error: candidateError } = await supabase
        .from("ats_candidates")
        .upsert({
          integration_id: integrationId,
          external_id: candidate.id,
          full_name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          resume_url: candidate.resume_url,
          skills: candidate.skills || [],
          experience_years: candidate.experience_years,
          current_position: candidate.current_position,
          current_company: candidate.current_company,
          education: candidate.education || [],
          source: candidate.source,
          applied_position: candidate.applied_position,
          ats_status: candidate.status,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'integration_id,external_id'
        })
        .select()
        .single();

      if (candidateError) {
        console.error("Error upserting candidate:", candidateError);
        throw candidateError;
      }

      console.log(`Candidate ${candidate.name} synced successfully`);
      
      // Log webhook receipt for replay protection
      const requestId = body.requestId || body.id || body.candidate?.id;
      if (requestId) {
        await supabase.from("audit_logs").insert({
          action: "WEBHOOK_RECEIVED",
          table_name: "ats_webhook",
          record_id: atsCandidate.id,
          metadata: {
            request_id: requestId,
            integration_id: integrationId,
            event: event,
            timestamp: new Date().toISOString()
          }
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Candidate synced successfully",
          candidate: atsCandidate
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Event ${event} received but not processed`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in ats-webhook function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
