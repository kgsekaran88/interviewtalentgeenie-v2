import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ResolveSlugRequest {
  org_slug?: string;
  interview_slug?: string;
  share_token?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ResolveSlugRequest;
    const { org_slug, interview_slug, share_token } = body;

    // Validate we have either slug pair or share_token
    if (!share_token && (!org_slug || !interview_slug)) {
      return new Response(
        JSON.stringify({ error: "Missing org_slug/interview_slug or share_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Backend configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    let invitation;

    if (share_token) {
      // Resolve by share_token (backward compatible)
      const { data, error } = await supabase
        .from("interview_invitations")
        .select("*, interview:interviews(*, organization:organizations(*))")
        .eq("share_token", share_token)
        .maybeSingle();

      if (error) {
        console.error("Error looking up invitation by token", error);
        return new Response(
          JSON.stringify({
            error: "invite_lookup_failed",
            message: "Unable to validate this interview link.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      invitation = data;
    } else {
      // Resolve by org_slug + interview_slug
      // First, find the organization by slug
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", org_slug)
        .maybeSingle();

      if (orgError || !org) {
        return new Response(
          JSON.stringify({
            error: "not_found",
            message: "Organization not found.",
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find the interview by slug within that organization
      const { data: interview, error: interviewError } = await supabase
        .from("interviews")
        .select("id, title, slug")
        .eq("organization_id", org.id)
        .eq("slug", interview_slug)
        .maybeSingle();

      if (interviewError || !interview) {
        return new Response(
          JSON.stringify({
            error: "not_found",
            message: "Interview not found.",
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Now we need to find the invitation - this slug-based URL is for public share links
      // Return interview info so frontend can handle appropriately
      return new Response(
        JSON.stringify({
          type: "public_interview",
          interview: {
            ...interview,
            organization: org,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invitation) {
      return new Response(
        JSON.stringify({
          error: "not_found",
          message: "This interview link is invalid or has expired.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Expiry & status checks
    const now = new Date();
    if (invitation.expires_at && new Date(invitation.expires_at) < now) {
      return new Response(
        JSON.stringify({
          error: "expired",
          message: "This invitation has expired.",
        }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invitation.status === "expired") {
      return new Response(
        JSON.stringify({
          error: "expired",
          message: "This invitation has expired.",
        }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invitation.status === "completed") {
      return new Response(
        JSON.stringify({
          error: "completed",
          message:
            "This interview has already been taken. Each candidate can only attempt once.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ type: "invitation", invitation }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in resolve-slug-invitation", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "Unexpected error resolving invitation" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
