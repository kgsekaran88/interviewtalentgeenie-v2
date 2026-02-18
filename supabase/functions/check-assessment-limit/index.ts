import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for active subscription
    const { data: subscription } = await supabaseClient
      .from('learning_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If user has unlimited subscription, allow
    if (subscription?.is_unlimited) {
      return new Response(
        JSON.stringify({
          allowed: true,
          reason: 'unlimited_subscription',
          subscription,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check daily free limit
    const today = new Date().toISOString().split('T')[0];
    const { data: todayUsage, count } = await supabaseClient
      .from('learning_assessment_usage')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('usage_date', today)
      .eq('was_free', true);

    const freeLimit = 2;
    const canUseFree = (count || 0) < freeLimit;

    if (canUseFree) {
      return new Response(
        JSON.stringify({
          allowed: true,
          reason: 'free_tier',
          usedToday: count || 0,
          freeLimit,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has active pay-per-use subscription
    if (subscription) {
      const dailyLimit = subscription.plan_type === 'daily' ? 1000 : 10000; // $10 or $99
      const monthlyLimit = 9900; // $99

      // Check if they've hit the unlimited threshold
      if (subscription.amount_spent_cents >= dailyLimit && subscription.plan_type === 'daily') {
        // Update to unlimited
        await supabaseClient
          .from('learning_subscriptions')
          .update({ is_unlimited: true })
          .eq('id', subscription.id);

        return new Response(
          JSON.stringify({
            allowed: true,
            reason: 'threshold_reached',
            subscription,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (subscription.amount_spent_cents >= monthlyLimit && subscription.plan_type === 'monthly') {
        await supabaseClient
          .from('learning_subscriptions')
          .update({ is_unlimited: true })
          .eq('id', subscription.id);

        return new Response(
          JSON.stringify({
            allowed: true,
            reason: 'threshold_reached',
            subscription,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // User can pay $2 for this assessment
      return new Response(
        JSON.stringify({
          allowed: true,
          reason: 'pay_per_use',
          cost: 200, // $2 in cents
          subscription,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User needs to subscribe or pay
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: 'limit_reached',
        usedToday: count || 0,
        freeLimit,
        requiresPayment: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-assessment-limit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});