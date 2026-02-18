import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  FileText,
  Shield,
  Activity,
  ArrowRight,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

interface PlatformStats {
  totalOrgs: number;
  pendingApps: number;
  activeOrgs: number;
  totalRevenue: number;
  totalInterviews: number;
  totalUsers: number;
}

interface OrgStats {
  memberCount: number;
  interviewCount: number;
  attemptCount: number;
  aiUsageUsed: number;
  interviewsUsed: number;
  planName: string;
}

const UnifiedDashboard = () => {
  const { user, hasRole, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    totalOrgs: 0,
    pendingApps: 0,
    activeOrgs: 0,
    totalRevenue: 0,
    totalInterviews: 0,
    totalUsers: 0,
  });
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("platform");

  const isPlatformAdmin = hasAnyRole(['platform_admin']);
  const isPartnerAdmin = hasAnyRole(['partner_admin']);
  const isHRRecruiter = hasRole('hr_recruiter');
  const isTechSPOC = hasRole('tech_spoc');

  // tech_spoc should not access dashboard - redirect to recruiting
  useEffect(() => {
    if (isTechSPOC && !isPlatformAdmin && !isPartnerAdmin && !isHRRecruiter) {
      navigate('/partner/recruiting/pending-reviews');
    }
  }, [isTechSPOC, isPlatformAdmin, isPartnerAdmin, isHRRecruiter, navigate]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    // If user has both roles, show unified view
    if (isPlatformAdmin && isPartnerAdmin) {
      fetchPlatformStats();
      fetchOrgStats();
    } else if (isPlatformAdmin) {
      setActiveTab("platform");
      fetchPlatformStats();
    } else if (isPartnerAdmin || isHRRecruiter) {
      // hr_recruiter gets limited org view
      setActiveTab("organization");
      fetchOrgStats();
    }
    setLoading(false);
  }, [user, isPlatformAdmin, isPartnerAdmin, isHRRecruiter]);

  const fetchPlatformStats = async () => {
    // Log platform admin access
    await logAuditAction("VIEW_PLATFORM_STATS", null);

    const [orgsRes, appsRes, interviewsRes, usersRes] = await Promise.all([
      supabase.from("organizations" as any).select("*", { count: 'exact' }),
      supabase.from("partner_applications" as any).select("*", { count: 'exact' }).eq("status", "pending"),
      supabase.from("interviews").select("*", { count: 'exact' }),
      supabase.from("profiles").select("*", { count: 'exact' }),
    ]);

    const activeOrgs = orgsRes.data?.filter((o: any) => o.status === 'approved').length || 0;
    
    setPlatformStats({
      totalOrgs: orgsRes.count || 0,
      pendingApps: appsRes.count || 0,
      activeOrgs,
      totalRevenue: 0,
      totalInterviews: interviewsRes.count || 0,
      totalUsers: usersRes.count || 0,
    });
  };

  const fetchOrgStats = async () => {
    if (!user) return;

    // Get user's organization
    const { data: memberData, error: memberError } = await supabase
      .from("organization_members" as any)
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (memberError || !memberData) return;

    const orgId = (memberData as any).organization_id as string;
    if (!orgId) return;

    // First get interview IDs
    const { data: interviewsData, count: interviewCount } = await supabase
      .from("interviews")
      .select("id", { count: 'exact' })
      .eq("organization_id", orgId);

    const interviewIds = interviewsData?.map((i: any) => i.id) || [];

    // Fetch organization statistics
    const [membersRes, attemptsRes, subscriptionRes] = await Promise.all([
      supabase
        .from("organization_members" as any)
        .select("*", { count: 'exact' })
        .eq("organization_id", orgId)
        .eq("status", "active"),
      interviewIds.length > 0 
        ? supabase.from("interview_attempts").select("id").in("interview_id", interviewIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("organization_subscriptions" as any)
        .select("ai_usage_used, interviews_used, subscription_plans(name)")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    setOrgStats({
      memberCount: membersRes.count || 0,
      interviewCount: interviewCount || 0,
      attemptCount: Array.isArray(attemptsRes.data) ? attemptsRes.data.length : 0,
      aiUsageUsed: (subscriptionRes.data as any)?.ai_usage_used || 0,
      interviewsUsed: (subscriptionRes.data as any)?.interviews_used || 0,
      planName: (subscriptionRes.data as any)?.subscription_plans?.name || "Free",
    });
  };

  const logAuditAction = async (action: string, organizationId: string | null) => {
    await supabase.from("audit_logs").insert({
      user_id: user?.id,
      action,
      table_name: "platform_admin_access",
      metadata: {
        organization_id: organizationId,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
      },
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  // If user has both roles, show tabs
  if (isPlatformAdmin && isPartnerAdmin) {
    return (
      <AppLayout>
        <div className="space-y-4 sm:space-y-6 animate-fade-in px-1 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text">Unified Dashboard</h1>
              <p className="text-sm text-muted-foreground">Platform and organization insights in one place</p>
            </div>
            <Badge variant="outline" className="gap-2 self-start sm:self-auto">
              <Shield className="w-4 h-4" />
              <span className="hidden xs:inline">Multi-Role Access</span>
              <span className="xs:hidden">Multi-Role</span>
            </Badge>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-2 h-auto">
              <TabsTrigger value="platform" className="text-xs sm:text-sm min-h-[44px] py-2">Platform Metrics</TabsTrigger>
              <TabsTrigger value="organization" className="text-xs sm:text-sm min-h-[44px] py-2">Organization</TabsTrigger>
            </TabsList>

            <TabsContent value="platform" className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <Card className="glass hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold gradient-text">{platformStats.totalOrgs}</p>
                        <p className="text-sm text-muted-foreground">Total Organizations</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-success">{platformStats.activeOrgs}</p>
                        <p className="text-sm text-muted-foreground">Active Organizations</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-warning" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-warning">{platformStats.pendingApps}</p>
                        <p className="text-sm text-muted-foreground">Pending Applications</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold gradient-text">{platformStats.totalInterviews}</p>
                        <p className="text-sm text-muted-foreground">Total Interviews</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold gradient-text">{platformStats.totalUsers}</p>
                        <p className="text-sm text-muted-foreground">Total Users</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-success">${platformStats.totalRevenue}</p>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex">
                <Button onClick={() => navigate("/platform-admin")} className="gap-2 min-h-[44px] w-full sm:w-auto">
                  View Full Platform Admin <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="organization" className="space-y-4 sm:space-y-6">
              {orgStats ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    <Card className="glass hover-lift">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold gradient-text">{orgStats.memberCount}</p>
                            <p className="text-sm text-muted-foreground">Team Members</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="glass hover-lift">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-accent" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold gradient-text">{orgStats.interviewCount}</p>
                            <p className="text-sm text-muted-foreground">Interviews Created</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="glass hover-lift">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
                            <Activity className="w-6 h-6 text-success" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-success">{orgStats.attemptCount}</p>
                            <p className="text-sm text-muted-foreground">Total Attempts</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="glass hover-lift col-span-full">
                      <CardHeader>
                        <CardTitle>Subscription Usage</CardTitle>
                        <CardDescription>Current plan: {orgStats.planName}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Interviews Used</p>
                            <p className="text-2xl font-bold gradient-text">{orgStats.interviewsUsed}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">AI Usage</p>
                            <p className="text-2xl font-bold gradient-text">{orgStats.aiUsageUsed}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={() => navigate("/partner/portal")} className="gap-2 min-h-[44px]">
                      <span className="hidden sm:inline">View Full Organization Portal</span>
                      <span className="sm:hidden">Organization Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => navigate("/partner/analytics")} variant="outline" className="gap-2 min-h-[44px]">
                      View Analytics <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <Card className="glass">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No organization data available</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    );
  }

  // Single role - redirect to appropriate dashboard
  if (isPlatformAdmin) {
    navigate("/platform-admin");
    return null;
  }

  if (isPartnerAdmin) {
    navigate("/partner/portal");
    return null;
  }

  // hr_recruiter with only that role - show limited org stats
  if (isHRRecruiter) {
    return (
      <AppLayout>
        <div className="space-y-4 sm:space-y-6 animate-fade-in px-1 sm:px-0">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Your organization overview</p>
          </div>

          {orgStats ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Card className="glass hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold gradient-text">{orgStats.interviewCount}</p>
                      <p className="text-sm text-muted-foreground">Interviews Created</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
                      <Activity className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-success">{orgStats.attemptCount}</p>
                      <p className="text-sm text-muted-foreground">Total Attempts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass hover-lift col-span-2 md:col-span-1">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold gradient-text">{orgStats.memberCount}</p>
                      <p className="text-sm text-muted-foreground">Team Members</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="glass">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No organization data available</p>
              </CardContent>
            </Card>
          )}

          <div className="flex">
            <Button onClick={() => navigate("/partner/recruiting/interviews")} className="gap-2 min-h-[44px]">
              View Interviews <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Card className="glass">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">You don't have access to administrative dashboards</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default UnifiedDashboard;
