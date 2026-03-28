import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Receipt, Download, CreditCard, TrendingUp, AlertCircle, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { logger } from '@/lib/logger';

interface Invoice {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

interface Subscription {
  id: string;
  status: string;
  interviews_used: number;
  ai_usage_used: number;
  current_period_start: string;
  current_period_end: string;
  subscription_plans: {
    name: string;
    price_cents: number;
    max_interviews: number;
    max_ai_usage: number;
    max_users: number;
  };
}

export default function PartnerBilling() {
  const { user, hasAnyRole, loading: authLoading } = useAuth();
  const { userOrgId } = useOrganization();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Only partner_admin, platform_admin, and billing_contact can access billing
  const canAccessBilling = hasAnyRole(['partner_admin', 'platform_admin', 'billing_contact']);

  useEffect(() => {
    // Don't check access until auth is fully loaded
    if (authLoading) return;

    if (!canAccessBilling) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    // Reset access denied if roles loaded and user has access
    setAccessDenied(false);

    if (user && userOrgId) {
      fetchBillingData();
    }
  }, [user, userOrgId, canAccessBilling, authLoading]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);

      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from("organization_subscriptions")
        .select(`
          *,
          subscription_plans(*)
        `)
        .eq("organization_id", userOrgId)
        .eq("status", "active")
        .maybeSingle();

      if (subError) throw subError;
      setSubscription(subData as any);

      // Fetch invoices
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("organization_id", userOrgId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (invoiceError) throw invoiceError;
      setInvoices(invoiceData || []);
    } catch (error: any) {
      logger.error("Error fetching billing data:", error);
      toast.error("Failed to load billing information");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-success/10 text-success border-success/20",
      pending: "bg-warning/10 text-warning border-warning/20",
      overdue: "bg-destructive/10 text-destructive border-destructive/20",
      draft: "bg-muted text-muted-foreground border-border",
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.draft}>
        {status}
      </Badge>
    );
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  if (accessDenied) {
    return (
      <div className="max-w-4xl mx-auto mt-20 p-6">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive">Access Denied</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Only partner admins and billing contacts can access billing information.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => navigate('/partner/portal')}
                >
                  Go to Portal
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-4xl mx-auto mt-20 p-6">
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <h3 className="font-semibold text-warning">No Active Subscription</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your organization doesn't have an active subscription. Please contact Support@talentgeenie.com.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = subscription.subscription_plans;
  const interviewUsage = getUsagePercentage(subscription.interviews_used || 0, plan.max_interviews);
  const aiUsage = getUsagePercentage(subscription.ai_usage_used || 0, plan.max_ai_usage);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-fade-in p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text flex items-center gap-2 sm:gap-3 mb-2">
          <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
          Billing & Subscription
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          View your subscription details, usage, and invoices
        </p>
      </div>

      {/* Subscription Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="group relative overflow-hidden border-primary/10 hover:border-primary/30 transition-all duration-300 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              {getStatusBadge(subscription.status)}
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">{formatCurrency(plan.price_cents)}</p>
            <p className="text-sm text-muted-foreground font-medium">{plan.name}</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-primary/10 hover:border-primary/30 transition-all duration-300 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">Current Period</p>
            <p className="text-sm font-semibold text-foreground">
              {format(new Date(subscription.current_period_start), "MMM d")} - {format(new Date(subscription.current_period_end), "MMM d, yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-primary/10 hover:border-primary/30 transition-all duration-300 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">{plan.max_users}</p>
            <p className="text-sm text-muted-foreground font-medium">Max Team Members</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Tracking */}
      <Card className="group relative overflow-hidden border-primary/10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
        <CardHeader className="border-b border-border/50 relative">
          <CardTitle className="text-lg">Usage This Period</CardTitle>
          <CardDescription className="text-sm">Track your monthly usage against plan limits</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 relative space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Interviews Conducted</span>
              <span className="text-sm text-muted-foreground">
                {subscription.interviews_used || 0} / {plan.max_interviews}
              </span>
            </div>
            <Progress value={interviewUsage} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">AI Usage (Tokens)</span>
              <span className="text-sm text-muted-foreground">
                {subscription.ai_usage_used || 0} / {plan.max_ai_usage}
              </span>
            </div>
            <Progress value={aiUsage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card className="group relative overflow-hidden border-primary/10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
        <CardHeader className="border-b border-border/50 relative">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Invoice History
          </CardTitle>
          <CardDescription className="text-sm">View and download your invoices</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 relative">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No invoices yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Invoice #</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Period</TableHead>
                    <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">Due Date</TableHead>
                    <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="group/row hover:bg-primary/5 transition-colors">
                      <TableCell className="font-medium text-xs sm:text-sm">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                        {format(new Date(invoice.period_start), "MMM d")} - {format(new Date(invoice.period_end), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{formatCurrency(invoice.total_cents)}</TableCell>
                      <TableCell className="text-xs sm:text-sm hidden md:table-cell">{format(new Date(invoice.due_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="min-h-[44px] px-2 sm:px-3">
                          <Download className="w-4 h-4 sm:mr-2" />
                          <span className="hidden sm:inline">Download</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card className="border-muted/50 bg-muted/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Need help with billing?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Contact Support@talentgeenie.com for subscription changes, payment methods, or billing inquiries.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
