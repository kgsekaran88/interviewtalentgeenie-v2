import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Sparkles, ArrowRight, Brain } from "lucide-react";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import talentGeenieLogo from "@/assets/talentgeenie-logo.jpg";

interface Plan {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  billing_interval: string;
  price_cents: number;
  max_interviews: number;
  max_users: number;
  description: string;
  features: string[];
  ai_features: Record<string, boolean>;
}

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useUserFriendlyToast();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [productType, setProductType] = useState<"interview" | "learning">("interview");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    fetchPlans();
  }, [billingInterval, productType]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user);
  };

  const fetchPlans = async () => {
    setLoading(true);
    
    if (productType === 'interview') {
      // Fetch interview subscription plans - use billing_period (column name in DB)
      const response = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("billing_period", billingInterval)
        .eq("is_active", true)
        .order("display_order");
      
      const data = response.data;
      const error = response.error;

      if (error || !data || data.length === 0) {
        // Fallback to static interview plans
        setPlans([
          {
            id: 'free',
            name: 'Free',
            slug: 'free',
            plan_type: 'free',
            billing_interval: billingInterval,
            price_cents: 0,
            max_interviews: 5,
            max_users: 1,
            description: 'Perfect for trying out the platform',
            features: ['5 interviews per month', 'AI Question Generation', 'Basic Proctoring', 'Email Support'],
            ai_features: {},
          },
          {
            id: 'starter',
            name: 'Starter',
            slug: 'starter',
            plan_type: 'starter',
            billing_interval: billingInterval,
            price_cents: billingInterval === 'monthly' ? 4900 : 47040,
            max_interviews: 50,
            max_users: 3,
            description: 'Great for small teams',
            features: ['50 interviews/month', 'AI Question Generation', 'Advanced Proctoring', 'Priority Support', 'Custom Branding'],
            ai_features: {},
          },
          {
            id: 'professional',
            name: 'Professional',
            slug: 'professional',
            plan_type: 'professional',
            billing_interval: billingInterval,
            price_cents: billingInterval === 'monthly' ? 14900 : 143040,
            max_interviews: 200,
            max_users: 10,
            description: 'Perfect for growing companies',
            features: ['200 interviews/month', 'All Starter features', 'Resume Parsing AI', 'Bias Detection', 'Analytics Dashboard', 'API Access'],
            ai_features: {},
          },
          {
            id: 'business',
            name: 'Business',
            slug: 'business',
            plan_type: 'business',
            billing_interval: billingInterval,
            price_cents: billingInterval === 'monthly' ? 39900 : 383040,
            max_interviews: 1000,
            max_users: 50,
            description: 'For large organizations',
            features: ['1000 interviews/month', 'All Professional features', 'Dedicated Support', 'Custom AI Training', 'SSO Integration', 'SLA Guarantee'],
            ai_features: {},
          },
        ]);
      } else {
        // Map database plans to expected format
        const mappedPlans = data.map((plan) => ({
          id: plan.id,
          name: plan.name,
          slug: plan.plan_type || plan.name.toLowerCase().replace(/\s+/g, '-'),
          plan_type: plan.plan_type || plan.name.toLowerCase(),
          billing_interval: plan.billing_period,
          price_cents: (plan.price_amount || 0) * 100, // Convert back to cents for display compatibility
          currency: plan.currency || 'USD',
          max_interviews: plan.max_interviews,
          max_users: plan.max_users,
          description: plan.description || '',
          features: (plan.features as string[]) || [],
          ai_features: {},
        }));
        setPlans(mappedPlans);
      }
    } else {
      // Fetch learning subscription plans
      const response = await supabase
        .from("learning_plans")
        .select("*")
        .eq("billing_period", billingInterval)
        .eq("is_active", true)
        .order("display_order");
      
      const data = response.data;
      const error = response.error;

      if (error || !data || data.length === 0) {
        // Fallback to static learning plans
        setPlans([
          {
            id: 'learning-free',
            name: 'Learning Free',
            slug: 'learning-free',
            plan_type: 'free',
            billing_interval: billingInterval,
            price_cents: 0,
            max_interviews: 0,
            max_users: 1,
            description: 'Get started with learning assessments',
            features: ['5 assessments per month', 'Basic Learning Paths', 'Community Support', 'Progress Tracking'],
            ai_features: {},
          },
          {
            id: 'learning-basic',
            name: 'Learning Basic',
            slug: 'learning-basic',
            plan_type: 'starter',
            billing_interval: billingInterval,
            price_cents: billingInterval === 'monthly' ? 1900 : 18240,
            max_interviews: 0,
            max_users: 1,
            description: 'For individual learners',
            features: ['50 assessments/month', 'All Learning Paths', 'Certifications', 'AI-Powered Feedback', 'Email Support'],
            ai_features: {},
          },
          {
            id: 'learning-team',
            name: 'Learning Team',
            slug: 'learning-team',
            plan_type: 'professional',
            billing_interval: billingInterval,
            price_cents: billingInterval === 'monthly' ? 4900 : 47040,
            max_interviews: 0,
            max_users: 10,
            description: 'Perfect for small teams',
            features: ['Unlimited assessments', 'Team Learning Paths', 'Advanced Analytics', 'Custom Certifications', 'Priority Support', 'Team Dashboard'],
            ai_features: {},
          },
          {
            id: 'learning-enterprise',
            name: 'Learning Enterprise',
            slug: 'learning-enterprise',
            plan_type: 'business',
            billing_interval: billingInterval,
            price_cents: billingInterval === 'monthly' ? 19900 : 191040,
            max_interviews: 0,
            max_users: 100,
            description: 'For large organizations',
            features: ['Unlimited everything', 'Custom Learning Paths', 'White-label Solution', 'Dedicated Support', 'SSO Integration', 'Advanced Reporting', 'API Access'],
            ai_features: {},
          },
        ]);
      } else {
        // Map database learning plans to expected format
        const mappedPlans = data.map((plan) => ({
          id: plan.id,
          name: plan.name,
          slug: plan.name.toLowerCase().replace(/\s+/g, '-'),
          plan_type: plan.name.toLowerCase().includes('free') ? 'free' : 
                     plan.name.toLowerCase().includes('basic') ? 'starter' :
                     plan.name.toLowerCase().includes('team') ? 'professional' : 'business',
          billing_interval: plan.billing_period,
          price_cents: plan.price, // learning_plans uses 'price' column
          max_interviews: plan.max_assessments || 0,
          max_users: 1,
          description: plan.description || '',
          features: (plan.features as string[]) || [],
          ai_features: {},
        }));
        setPlans(mappedPlans);
      }
    }
    setLoading(false);
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const getPlanColor = (planType: string) => {
    const colors: Record<string, string> = {
      starter: "from-blue-500 to-cyan-500",
      professional: "from-purple-500 to-pink-500",
      business: "from-orange-500 to-red-500",
      enterprise: "from-indigo-500 to-purple-500",
    };
    return colors[planType] || "from-primary to-accent";
  };

  const handleGetStarted = (plan: Plan) => {
    if (user) {
      navigate(`/partner/onboarding?plan=${plan.slug}`);
    } else {
      navigate(`/auth?redirect=/partner/onboarding?plan=${plan.slug}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => navigate('/')}
            >
              <img 
                src={talentGeenieLogo} 
                alt="TalentGeenie Logo" 
                className="w-10 h-10 rounded-full shadow-lg group-hover:shadow-xl transition-all object-cover"
              />
              <div className="hidden sm:flex flex-col">
                <span className="font-bold text-xl gradient-text">TalentGeenie</span>
                <span className="text-xs text-muted-foreground">Smart Hiring Platform</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <Button onClick={() => navigate('/')}>
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/auth')}>
                    Sign In
                  </Button>
                  <Button onClick={() => navigate('/auth')}>
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-12 space-y-4 animate-fade-in">
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Sparkles className="w-3 h-3 mr-1" />
            Transparent Pricing
          </Badge>
          <h1 className="text-responsive-xl font-bold">
            <span className="gradient-text">Choose Your Plan</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {productType === 'interview' 
              ? 'Scale your hiring with AI-powered interviews. No hidden fees, cancel anytime.'
              : 'Empower your team with AI-driven learning. Flexible plans for every need.'
            }
          </p>
        </div>

        {/* Product Type Toggle */}
        <div className="flex justify-center mb-8 px-4">
          <Tabs value={productType} onValueChange={(v) => setProductType(v as any)} className="w-full max-w-[400px]">
            <TabsList className="grid w-full grid-cols-2 p-1 glass">
              <TabsTrigger 
                value="interview" 
                className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white"
              >
                Interview Platform
              </TabsTrigger>
              <TabsTrigger 
                value="learning" 
                className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white"
              >
                Learning Hub
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <Tabs value={billingInterval} onValueChange={(v) => setBillingInterval(v as any)} className="w-auto">
            <TabsList className="grid w-full grid-cols-2 p-1 glass">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">
                Annual
                <Badge variant="secondary" className="ml-2 bg-success/10 text-success border-success/20">
                  Save 20%
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Pricing Cards */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className={`grid gap-6 max-w-7xl mx-auto ${
            plans.length <= 6 
              ? `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(plans.length, 6)} justify-center` 
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`} style={plans.length <= 6 ? { gridTemplateColumns: `repeat(${Math.min(plans.length, 6)}, minmax(0, 1fr))` } : undefined}>
            {plans.map((plan, index) => (
              <Card 
                key={plan.id}
                className={`glass border-border/50 hover-lift relative overflow-hidden ${
                  plan.plan_type === 'professional' ? 'border-primary/50 shadow-xl' : ''
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.plan_type === 'professional' && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-gradient-to-r from-primary to-accent border-0 shadow-lg">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pb-6 space-y-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPlanColor(plan.plan_type)} flex items-center justify-center shadow-lg`}>
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  
                  <div>
                    <CardTitle className="text-xl mb-2">
                      {plan.name.replace(` ${billingInterval}`, '')}
                    </CardTitle>
                    <CardDescription className="text-xs">{plan.description}</CardDescription>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold gradient-text">
                        {formatPrice(plan.price_cents)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </div>
                    {billingInterval === 'annual' && (
                      <p className="text-xs text-muted-foreground">
                        Billed annually
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                      <span>{plan.max_interviews} interviews/month</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                      <span>Up to {plan.max_users} team members</span>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-success" />
                        </div>
                        <span className="text-xs text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    onClick={() => handleGetStarted(plan)}
                    className={`w-full h-10 text-sm ${
                      plan.plan_type === 'professional' 
                        ? 'bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg' 
                        : ''
                    }`}
                    variant={plan.plan_type === 'professional' ? 'default' : 'outline'}
                  >
                    Get Started
                    <ArrowRight className="w-3 h-3 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Enterprise CTA */}
        <div className="mt-20 max-w-4xl mx-auto">
          <Card className="glass border-2 border-primary/20 hover-lift">
            <CardContent className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <Badge className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20">
                    Enterprise
                  </Badge>
                  <h3 className="text-2xl font-bold">Need a custom solution?</h3>
                  <p className="text-muted-foreground">
                    For organizations requiring unlimited interviews, custom integrations, 
                    dedicated support, and enterprise-grade security.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success" />
                      Unlimited interviews and users
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success" />
                      Custom AI model training
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success" />
                      Dedicated account manager
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success" />
                      SLA guarantees
                    </li>
                  </ul>
                </div>
                <div className="flex flex-col gap-4">
                  <Button size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90">
                    Contact Sales
                  </Button>
                  <p className="text-sm text-center text-muted-foreground">
                    Talk to our team about your needs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl font-bold gradient-text">Frequently Asked Questions</h2>
          <div className="grid gap-6 text-left">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans later?</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
              </CardContent>
            </Card>
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">What happens if I exceed my limits?</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                We'll notify you when you approach your limits. You can upgrade your plan or purchase additional capacity as needed.
              </CardContent>
            </Card>
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Yes, we offer a 14-day money-back guarantee on all plans. Cancel anytime within the first 14 days for a full refund.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
