import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, AlertCircle, Sparkles, ArrowRight, Check } from 'lucide-react';

interface LearningPlan {
  id: string;
  name: string;
  price: number;
  billing_period: string;
  max_assessments: number;
  max_certifications: number;
}

export function LearningSubscriptionBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [usageStats, setUsageStats] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<LearningPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUsageStats();
    }
  }, [user]);

  const fetchUsageStats = async () => {
    try {
      // Get today's usage
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('learning_assessment_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('usage_date', today)
        .eq('was_free', true);

      // Get active subscription with plan details
      const { data: subscription } = await supabase
        .from('learning_subscriptions')
        .select('*, learning_plans(*)')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.learning_plans) {
        setCurrentPlan(subscription.learning_plans as unknown as LearningPlan);
      }

      setUsageStats({
        usedToday: count || 0,
        freeLimit: 2,
        hasSubscription: !!subscription,
        subscription,
        isPaidPlan: subscription?.learning_plans?.price > 0,
      });
    } catch (error) {
      logger.error('Error fetching usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !usageStats) return null;

  const { usedToday, freeLimit, hasSubscription, isPaidPlan } = usageStats;

  // Show current plan status for subscribed users
  if (hasSubscription && currentPlan) {
    const isFreePlan = currentPlan.price === 0;
    
    return (
      <Card className={`mb-6 ${isPaidPlan ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'}`}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPaidPlan ? 'bg-primary/20' : 'bg-muted'}`}>
              {isPaidPlan ? <Sparkles className="h-5 w-5 text-primary" /> : <Check className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{currentPlan.name} Plan</p>
                <Badge variant={isPaidPlan ? 'default' : 'secondary'} className="text-xs">
                  {isPaidPlan ? 'Premium' : 'Free'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentPlan.max_assessments === -1 ? 'Unlimited' : currentPlan.max_assessments} assessments • 
                {currentPlan.max_certifications === -1 ? ' Unlimited' : ` ${currentPlan.max_certifications}`} certifications
              </p>
            </div>
          </div>
          {isFreePlan && (
            <Button variant="outline" onClick={() => navigate('/learning-pricing')}>
              Upgrade Plan
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show warning if approaching limit (no subscription)
  if (!hasSubscription && usedToday >= freeLimit - 1 && usedToday < freeLimit) {
    return (
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Almost at your free limit</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            You've used {usedToday} of {freeLimit} free assessments today.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/learning-pricing')}
          >
            View Plans
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Show limit reached (no subscription)
  if (!hasSubscription && usedToday >= freeLimit) {
    return (
      <Alert variant="destructive" className="mb-6">
        <CreditCard className="h-4 w-4" />
        <AlertTitle>Free limit reached</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            You've used all {freeLimit} free assessments today. Subscribe to continue.
          </span>
          <Button
            size="sm"
            onClick={() => navigate('/learning-pricing')}
          >
            Subscribe Now
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // No subscription - show CTA to subscribe
  if (!hasSubscription) {
    return (
      <Card className="mb-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Unlock Your Learning Potential</p>
              <p className="text-sm text-muted-foreground">
                Subscribe to access unlimited assessments and certifications
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/learning-pricing')}>
            View Plans
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
