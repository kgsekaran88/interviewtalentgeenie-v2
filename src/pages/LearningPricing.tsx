import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from '@/lib/logger';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentGateway } from "@/hooks/usePaymentGateway";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Check, Sparkles, GraduationCap, BookOpen, Brain, Crown, Zap, ArrowRight, Loader2, AlertTriangle, CreditCard } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

interface LearningPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: string;
  max_assessments: number;
  max_certifications: number;
  max_ai_usage: number;
  features: string[];
  is_active: boolean;
  display_order: number;
}

interface UserSubscription {
  id: string;
  plan_id: string | null;
  status: string;
  learning_plans?: LearningPlan;
}

export default function LearningPricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: paymentStatus, loading: paymentLoading, isPaymentEnabled, getPaymentNotEnabledMessage, activeGateway } = usePaymentGateway();
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
    if (user) {
      fetchCurrentSubscription();
    }
  }, [user]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      const typedPlans = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : []
      })) as LearningPlan[];
      
      setPlans(typedPlans);
    } catch (error) {
      logger.error('Error fetching learning plans:', error);
      toast.error('Failed to load pricing plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_subscriptions')
        .select('*, learning_plans(*)')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      setCurrentSubscription(data as UserSubscription | null);
    } catch (error) {
      logger.error('Error fetching subscription:', error);
    }
  };

  const handleSubscribe = async (plan: LearningPlan) => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      navigate('/auth?redirect=/learning-pricing');
      return;
    }

    setSubscribing(plan.id);
    
    try {
      if (plan.price === 0) {
        // Free plan - directly create subscription
        // First check if user already has a subscription
        const { data: existingSub } = await supabase
          .from('learning_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 100); // Far future for free plan

        if (existingSub) {
          // Update existing subscription
          const { error } = await supabase
            .from('learning_subscriptions')
            .update({
              plan_id: plan.id,
              plan_type: plan.name,
              status: 'active',
              started_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
            })
            .eq('id', existingSub.id);

          if (error) throw error;
        } else {
          // Create new subscription
          const { error } = await supabase
            .from('learning_subscriptions')
            .insert({
              user_id: user.id,
              plan_id: plan.id,
              plan_type: plan.name,
              status: 'active',
              started_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
            });

          if (error) throw error;
        }
        
        toast.success(`Subscribed to ${plan.name} plan!`);
        fetchCurrentSubscription();
      } else {
        // Paid plan - check if payment is enabled
        if (!isPaymentEnabled()) {
          toast.error(getPaymentNotEnabledMessage());
          return;
        }
        
        // Payment is enabled - initiate payment flow
        // Payment gateway integration requires stripe/razorpay edge function setup
        toast.info(`Redirecting to ${activeGateway?.display_name || 'payment'}...`, {
          description: `${paymentStatus.isTestMode ? '(Test Mode)' : ''} Processing $${plan.price} payment`,
        });
        
        // Payment processing requires edge function configuration
        toast.info('Payment processing will be available once edge functions are configured.');
      }
    } catch (error) {
      logger.error('Error subscribing:', error);
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setSubscribing(null);
    }
  };

  const formatLimit = (value: number) => {
    return value === -1 ? 'Unlimited' : value.toString();
  };

  const getBillingText = (period: string) => {
    switch (period) {
      case 'monthly': return '/month';
      case 'yearly': return '/year';
      case 'lifetime': return ' one-time';
      case 'one_time': return ' one-time';
      default: return `/${period}`;
    }
  };

  const getPlanIcon = (index: number) => {
    const icons = [Sparkles, Zap, Crown];
    const Icon = icons[index % icons.length];
    return <Icon className="h-6 w-6" />;
  };

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.plan_id === planId;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 py-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <GraduationCap className="h-4 w-4" />
            Learning Plans
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">
            Choose Your Learning Journey
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlock your potential with our comprehensive learning and certification programs
          </p>
        </div>

        {/* Current Subscription Banner */}
        {currentSubscription && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Current Plan: {currentSubscription.learning_plans?.name || 'Active'}</p>
                  <p className="text-sm text-muted-foreground">You're currently subscribed to this plan</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate('/learning')}>
                Go to Learning Hub
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pricing Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const isCurrent = isCurrentPlan(plan.id);
            const isPopular = index === 1; // Middle plan is "popular"
            
            return (
              <Card 
                key={plan.id} 
                className={`relative flex flex-col ${isPopular ? 'border-primary shadow-lg' : ''} ${isCurrent ? 'ring-2 ring-primary' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="secondary">Current Plan</Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-2">
                  <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${isPopular ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                    {getPlanIcon(index)}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1 space-y-6">
                  {/* Price */}
                  <div className="text-center">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">{getBillingText(plan.billing_period)}</span>
                  </div>

                  {/* Limits */}
                  <div className="space-y-3 py-4 border-y">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        Assessments
                      </span>
                      <span className="font-semibold">{formatLimit(plan.max_assessments)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <GraduationCap className="h-4 w-4" />
                        Certifications
                      </span>
                      <span className="font-semibold">{formatLimit(plan.max_certifications)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Brain className="h-4 w-4" />
                        AI Features
                      </span>
                      <span className="font-semibold">{formatLimit(plan.max_ai_usage)}</span>
                    </div>
                  </div>

                  {/* Features */}
                  {plan.features.length > 0 && (
                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={isPopular ? 'default' : 'outline'}
                    disabled={isCurrent || subscribing === plan.id}
                    onClick={() => handleSubscribe(plan)}
                  >
                    {subscribing === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : plan.price === 0 ? (
                      'Get Started Free'
                    ) : (
                      'Subscribe Now'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {plans.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium">No Plans Available</h3>
              <p className="text-muted-foreground">Learning plans are being configured. Please check back soon.</p>
            </CardContent>
          </Card>
        )}

        {/* FAQ or Additional Info */}
        <div className="text-center space-y-2 pt-4">
          <h2 className="text-2xl font-bold">Questions?</h2>
          <p className="text-muted-foreground">
            Contact our support team at{' '}
            <a href="mailto:Support@talentgeenie.com" className="text-primary hover:underline">
              Support@talentgeenie.com
            </a>{' '}
            for help choosing the right plan for your needs.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
