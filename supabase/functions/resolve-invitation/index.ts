import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ResolveInvitationRequest {
  share_token?: string;
  timezone?: string; // Candidate's detected timezone for reminder scheduling
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ResolveInvitationRequest;
    const shareToken = body.share_token?.trim();
    const candidateTimezone = body.timezone?.trim();

    if (!shareToken) {
      return new Response(
        JSON.stringify({ error: "Missing share_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Backend configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: invitation, error: inviteError } = await supabase
      .from("interview_invitations")
      .select("*, interview:interviews(*)")
      .eq("share_token", shareToken)
      .maybeSingle();

    if (inviteError) {
      console.error("Error looking up invitation by token", inviteError);
      return new Response(
        JSON.stringify({
          error: "invite_lookup_failed",
          message: "Unable to validate this interview link.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!invitation) {
      return new Response(
        JSON.stringify({
          error: "not_found",
          message: "This interview link is invalid or has expired.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Expiry & status checks mirror frontend behaviour
    const now = new Date();
    if (invitation.expires_at && new Date(invitation.expires_at) < now) {
      return new Response(
        JSON.stringify({
          error: "expired",
          message: "This invitation has expired.",
        }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (invitation.status === "expired") {
      return new Response(
        JSON.stringify({
          error: "expired",
          message: "This invitation has expired.",
        }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (invitation.status === "completed") {
      return new Response(
        JSON.stringify({
          error: "completed",
          message:
            "This interview has already been taken. Each candidate can only attempt once.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update candidate timezone if provided (for reminder scheduling)
    if (candidateTimezone && !invitation.candidate_timezone) {
      await supabase
        .from("interview_invitations")
        .update({ 
          candidate_timezone: candidateTimezone,
          accessed_at: invitation.accessed_at || new Date().toISOString()
        })
        .eq("id", invitation.id);
    }

    return new Response(
      JSON.stringify({ invitation }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error in resolve-invitation", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "Unexpected error resolving invitation" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
