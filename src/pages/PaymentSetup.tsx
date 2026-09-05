import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { isFeatureEnabled } from "@/lib/featureFlags";

export default function PaymentSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);

  const orgId = searchParams.get("org");
  const subId = searchParams.get("sub");
  const onlinePayments = isFeatureEnabled("onlinePayments");

  useEffect(() => {
    if (orgId && subId) {
      fetchDetails();
    }
  }, [orgId, subId]);

  const fetchDetails = async () => {
    try {
      // Fetch organization
      const { data: orgData } = await supabase
        .from("organizations" as any)
        .select("*")
        .eq("id", orgId)
        .maybeSingle();

      // Fetch subscription with plan details
      const { data: subData } = await supabase
        .from("organization_subscriptions" as any)
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq("id", subId)
        .maybeSingle();

      if (orgData) setOrganization(orgData);
      if (subData) {
        setSubscription(subData);
        setPlan((subData as any).subscription_plans);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureStripe = () => {
    toast({
      title: "Online payments on hold",
      description: "Card checkout is deferred. Use offline/invoice payment with your TalentGeenie contact.",
      duration: 10000,
    });
  };

  const handleContinueOffline = async () => {
    successToast(
      "Continue with offline payment",
      "Your organization is ready. Contact Support@talentgeenie.com to complete invoice payment and activate the plan."
    );
    navigate("/partner/portal");
  };

  const handleSkipForNow = async () => {
    toast({
      title: "Setup Incomplete",
      description: "You'll need to complete offline payment before the subscription can be activated.",
    });
    navigate("/partner/portal");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8 sm:py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <div className="text-center">
          <CreditCard className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-primary" />
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Payment Setup</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Complete your subscription setup
          </p>
        </div>

        {organization && (
          <Card>
            <CardHeader>
              <CardTitle>Organization Created Successfully!</CardTitle>
              <CardDescription>
                {organization.name} has been registered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    Organization Details
                  </h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><strong>Name:</strong> {organization.name}</p>
                    <p><strong>Slug:</strong> {organization.slug}</p>
                    <p><strong>Email:</strong> {organization.contact_email}</p>
                  </div>
                </div>
              </div>

              {plan && (
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold mb-2">Selected Plan</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Plan:</strong> {plan.name}</p>
                    <p><strong>Price:</strong> ${(plan.price_cents / 100).toFixed(2)}/{plan.billing_interval === "monthly" ? "month" : "year"}</p>
                    <p><strong>Interviews:</strong> {plan.max_interviews} per month</p>
                    <p><strong>Users:</strong> {plan.max_users} team members</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{onlinePayments ? "Stripe Not Configured" : "Offline payments only"}</AlertTitle>
          <AlertDescription className="space-y-3">
            {onlinePayments ? (
              <>
                <p>
                  To complete payment and activate your subscription, Stripe needs to be configured.
                  Please add your Stripe secret key in the project settings.
                </p>
                <div className="space-y-2 mt-3">
                  <p className="font-semibold">To configure Stripe:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to your Stripe Dashboard</li>
                    <li>Get your Secret Key (starts with sk_)</li>
                    <li>Add it to the project's secret management</li>
                    <li>Return here to complete payment</li>
                  </ol>
                </div>
              </>
            ) : (
              <p>
                Online card checkout is on hold. TalentGeenie currently accepts offline/invoice
                payments. Contact Support@talentgeenie.com with your organization name to receive
                an invoice and activate your plan.
              </p>
            )}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {onlinePayments
                ? "Your organization has been created but payment needs to be configured. Once Stripe is set up, you can complete the payment process and activate your subscription."
                : "Your organization has been created. Continue to the portal and arrange offline payment to activate the subscription."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              {onlinePayments ? (
                <Button onClick={handleConfigureStripe} className="flex-1 min-h-[44px]">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Setup Stripe Now
                </Button>
              ) : (
                <Button onClick={handleContinueOffline} className="flex-1 min-h-[44px]">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Continue with Offline Payment
                </Button>
              )}
              <Button variant="outline" onClick={handleSkipForNow} className="flex-1 min-h-[44px]">
                I'll Configure Later
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
