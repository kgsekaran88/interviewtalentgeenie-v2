import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateInvoiceRequest {
  organizationId: string;
  periodStart?: string;
  periodEnd?: string;
  preview?: boolean;
  idempotencyKey?: string; // Client-provided key to prevent duplicate invoices
  customPricing?: {
    perInterviewCents?: number;
    perInvitationCents?: number;
    perCompletedCents?: number;
  };
}

interface UsageMetrics {
  interviewsCreated: number;
  invitationsSent: number;
  interviewsCompleted: number;
  aiTokensUsed: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { organizationId, periodStart, periodEnd, preview, idempotencyKey, customPricing }: GenerateInvoiceRequest = await req.json();

    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    // Generate idempotency key if not provided (org + period based)
    const effectiveIdempotencyKey = idempotencyKey || 
      `invoice_${organizationId}_${periodStart || 'auto'}_${periodEnd || 'auto'}_${Date.now()}`;

    // Calculate period (default to last month)
    const now = new Date();
    const start = periodStart ? new Date(periodStart) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = periodEnd ? new Date(periodEnd) : new Date(now.getFullYear(), now.getMonth(), 0);

    console.log(`Generating invoice for org ${organizationId}, period: ${start.toISOString()} to ${end.toISOString()}`);

    // Get organization
    const { data: org, error: orgError } = await supabaseClient
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      console.error("Organization error:", orgError);
      throw new Error("Organization not found");
    }

    // Get subscription separately with explicit join
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("organization_subscriptions")
      .select("*, plan:plan_id(*)") 
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(1);

    if (subError) {
      console.error("Subscription error:", subError);
      throw new Error("Error fetching subscription");
    }

    if (!subscriptions || subscriptions.length === 0) {
      throw new Error("No active subscription found for this organization");
    }

    const subscription = subscriptions[0];
    const plan = subscription.plan;

    if (!plan) {
      throw new Error("Subscription plan not found");
    }

    // ========== USAGE METRICS CALCULATION ==========

    // 1. Count interviews created in period
    const { data: interviews, error: intError } = await supabaseClient
      .from("interviews")
      .select("id")
      .eq("organization_id", organizationId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString() + "T23:59:59");

    if (intError) {
      console.error("Error fetching interviews:", intError);
    }

    const interviewIds = (interviews || []).map(i => i.id);
    const interviewsCreated = interviewIds.length;

    // 2. Count invitations sent in period (for these interviews or any in org)
    let invitationsSent = 0;
    let interviewsCompleted = 0;

    if (interviewIds.length > 0) {
      const { data: invitations, error: invError } = await supabaseClient
        .from("interview_invitations")
        .select("id, status, email_sent_at")
        .in("interview_id", interviewIds);

      if (invError) {
        console.error("Error fetching invitations:", invError);
      } else {
        invitationsSent = invitations?.filter(inv => inv.email_sent_at).length || 0;
        interviewsCompleted = invitations?.filter(inv => inv.status === "completed").length || 0;
      }
    }

    // Also count invitations for interviews created before period but sent during period
    const { data: periodInvitations, error: periodInvError } = await supabaseClient
      .from("interview_invitations")
      .select("id, status, interview_id, interviews!inner(organization_id)")
      .eq("interviews.organization_id", organizationId)
      .gte("email_sent_at", start.toISOString())
      .lte("email_sent_at", end.toISOString() + "T23:59:59");

    if (!periodInvError && periodInvitations) {
      // Add any invitations sent during period that weren't already counted
      const existingInvIds = new Set(interviewIds);
      const additionalInvitations = periodInvitations.filter(
        inv => !existingInvIds.has(inv.interview_id)
      );
      invitationsSent += additionalInvitations.length;
      interviewsCompleted += additionalInvitations.filter(inv => inv.status === "completed").length;
    }

    // 3. Get AI usage from logs for the period
    const { data: aiUsage, error: aiError } = await supabaseClient
      .from("ai_usage_logs")
      .select("request_tokens, response_tokens")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (aiError) {
      console.error("Error fetching AI usage:", aiError);
    }

    const aiTokensUsed = aiUsage?.reduce((sum, log) => 
      sum + (log.request_tokens || 0) + (log.response_tokens || 0), 0) || 0;

    const usageMetrics: UsageMetrics = {
      interviewsCreated,
      invitationsSent,
      interviewsCompleted,
      aiTokensUsed,
    };

    console.log("Usage metrics:", usageMetrics);

    // ========== PRICING CALCULATION ==========

    const lineItems = [];
    let subtotalCents = 0;

    // Check plan features for per-unit pricing (stored in features JSON)
    const features = plan.features || {};
    
    // Custom pricing takes precedence over plan defaults
    const perInterviewPrice = customPricing?.perInterviewCents ?? features.per_interview_price_cents ?? 0;
    const perInvitationPrice = customPricing?.perInvitationCents ?? features.per_invitation_price_cents ?? 0;
    const perCompletedPrice = customPricing?.perCompletedCents ?? features.per_completed_price_cents ?? 500; // Default $5 per completed
    const includedInterviews = features.included_interviews || plan.max_interviews || 10;
    const includedInvitations = features.included_invitations || (plan.max_interviews * 5) || 50;
    
    const isCustomPricing = !!(customPricing?.perInterviewCents || customPricing?.perInvitationCents || customPricing?.perCompletedCents);
    console.log("Using pricing:", { perInterviewPrice, perInvitationPrice, perCompletedPrice, isCustomPricing });

    // Base subscription fee (if any)
    if (plan.price_cents > 0) {
      lineItems.push({
        description: `${plan.name} - Base Subscription (${plan.billing_period})`,
        quantity: 1,
        unit_price_cents: plan.price_cents,
        total_cents: plan.price_cents,
        type: "subscription",
      });
      subtotalCents += plan.price_cents;
    }

    // Usage-based charges: Completed Interviews (primary billing metric)
    if (interviewsCompleted > 0) {
      const billableCompleted = interviewsCompleted;
      const completedCharge = billableCompleted * perCompletedPrice;
      lineItems.push({
        description: `Completed Interviews`,
        quantity: billableCompleted,
        unit_price_cents: perCompletedPrice,
        total_cents: completedCharge,
        type: "usage",
      });
      subtotalCents += completedCharge;
    }

    // Overage charges for interviews created beyond included
    if (perInterviewPrice > 0 && interviewsCreated > includedInterviews) {
      const overageInterviews = interviewsCreated - includedInterviews;
      const overageCharge = overageInterviews * perInterviewPrice;
      lineItems.push({
        description: `Additional Interviews Created (${overageInterviews} over ${includedInterviews} included)`,
        quantity: overageInterviews,
        unit_price_cents: perInterviewPrice,
        total_cents: overageCharge,
        type: "overage",
      });
      subtotalCents += overageCharge;
    }

    // Overage charges for invitations beyond included
    if (perInvitationPrice > 0 && invitationsSent > includedInvitations) {
      const overageInvitations = invitationsSent - includedInvitations;
      const overageCharge = overageInvitations * perInvitationPrice;
      lineItems.push({
        description: `Additional Invitations Sent (${overageInvitations} over ${includedInvitations} included)`,
        quantity: overageInvitations,
        unit_price_cents: perInvitationPrice,
        total_cents: overageCharge,
        type: "overage",
      });
      subtotalCents += overageCharge;
    }

    // AI usage overage
    if (aiTokensUsed > plan.max_ai_usage) {
      const overageTokens = aiTokensUsed - plan.max_ai_usage;
      const overagePrice = Math.ceil(overageTokens * 0.001); // $0.001 per token
      lineItems.push({
        description: `AI Usage Overage (${overageTokens.toLocaleString()} tokens over ${plan.max_ai_usage.toLocaleString()} limit)`,
        quantity: overageTokens,
        unit_price_cents: 0.001,
        total_cents: overagePrice,
        type: "overage",
      });
      subtotalCents += overagePrice;
    }

    // Calculate tax (configurable, default 10%)
    const taxRate = features.tax_rate || 0.1;
    const taxCents = Math.ceil(subtotalCents * taxRate);
    const totalCents = subtotalCents + taxCents;

    const invoiceData = {
      organization_id: organizationId,
      organization_name: org.name,
      subscription_id: subscription.id,
      plan_name: plan.name,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      amount_cents: subtotalCents,
      tax_cents: taxCents,
      tax_rate: taxRate,
      total_cents: totalCents,
      line_items: lineItems,
      usage_details: {
        interviews_created: interviewsCreated,
        invitations_sent: invitationsSent,
        interviews_completed: interviewsCompleted,
        ai_tokens_used: aiTokensUsed,
        plan_limits: {
          max_interviews: plan.max_interviews,
          max_ai_usage: plan.max_ai_usage,
          included_interviews: includedInterviews,
          included_invitations: includedInvitations,
        },
        pricing: {
          per_completed_price_cents: perCompletedPrice,
          per_interview_price_cents: perInterviewPrice,
          per_invitation_price_cents: perInvitationPrice,
          is_custom_pricing: isCustomPricing,
        },
      },
    };

    // If preview mode, return calculation without creating invoice
    if (preview) {
      console.log("Preview mode - returning calculation without creating invoice");
      return new Response(JSON.stringify({ 
        success: true, 
        preview: true,
        invoice: invoiceData,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Use transactional database function for atomic invoice creation with idempotency
    const { data: txResult, error: txError } = await supabaseClient.rpc("generate_invoice_tx", {
      p_organization_id: organizationId,
      p_subscription_id: subscription.id,
      p_period_start: start.toISOString(),
      p_period_end: end.toISOString(),
      p_line_items: lineItems,
      p_amount_cents: subtotalCents,
      p_tax_cents: taxCents,
      p_idempotency_key: effectiveIdempotencyKey
    });

    if (txError) {
      console.error("Transaction error creating invoice:", txError);
      throw new Error(txError.message || "Failed to create invoice");
    }

    console.log("Invoice generated successfully via transaction:", txResult);
    
    // Log if this was an idempotent replay
    if (txResult?.idempotent_replay) {
      console.log("Idempotent replay - returning existing invoice:", txResult.invoice_id);
    }

    // Fetch the created invoice for full response
    const { data: invoice } = await supabaseClient
      .from("invoices")
      .select("*")
      .eq("id", txResult.invoice_id)
      .single();

    return new Response(JSON.stringify({ 
      success: true, 
      invoice: invoice || {
        id: txResult.invoice_id,
        invoice_number: txResult.invoice_number,
        total_cents: txResult.total_cents,
        discount_applied: txResult.discount_applied
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in generate-invoice function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});