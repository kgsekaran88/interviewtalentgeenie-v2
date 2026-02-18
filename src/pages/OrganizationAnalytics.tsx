import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { 
  BarChart3, 
  Users, 
  ClipboardList, 
  TrendingUp, 
  Brain,
  Loader2,
  Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const OrganizationAnalytics = () => {
  const navigate = useNavigate();
  const { toast, errorToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalInterviews: 0,
    completedAttempts: 0,
    aiTokensUsed: 0,
    averageScore: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get user's organization
      const { data: memberData } = await supabase
        .from("organization_members" as any)
        .select("*, organizations(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!memberData) {
        toast({
          title: "No Organization",
          description: "You need to be part of an organization to view analytics.",
          variant: "destructive",
        });
        navigate("/partner/portal");
        return;
      }

      const org = (memberData as any).organizations;
      setOrganization(org);

      // Fetch member statistics
      const { data: members } = await supabase
        .from("organization_members" as any)
        .select("*")
        .eq("organization_id", org.id);

      const activeMembers = members?.filter((m: any) => m.status === 'active').length || 0;

      // Fetch interview statistics
      const { data: interviews } = await supabase
        .from("interviews")
        .select("*")
        .eq("organization_id", org.id);

      // Fetch interview attempts
      const interviewIds = interviews?.map(i => i.id) || [];
      const { data: attempts } = await supabase
        .from("interview_attempts")
        .select("*")
        .in("interview_id", interviewIds)
        .eq("status", "submitted");

      // Fetch usage tracking
      const { data: usage } = await supabase
        .from("usage_tracking" as any)
        .select("*")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Calculate average assessment score
      const { data: assessments } = await supabase
        .from("assessments")
        .select("overall_score, interview_attempts!inner(*, interviews!inner(*))")
        .eq("interview_attempts.interviews.organization_id", org.id);

      const avgScore = assessments && assessments.length > 0
        ? assessments.reduce((sum, a) => sum + Number(a.overall_score), 0) / assessments.length
        : 0;

      setStats({
        totalMembers: members?.length || 0,
        activeMembers,
        totalInterviews: interviews?.length || 0,
        completedAttempts: attempts?.length || 0,
        aiTokensUsed: (usage as any)?.ai_tokens_used || 0,
        averageScore: Math.round(avgScore),
      });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto animate-fade-in px-1 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text flex items-center gap-2 sm:gap-3">
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
              <span className="hidden sm:inline">Organization Analytics</span>
              <span className="sm:hidden">Analytics</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 sm:mt-2">
              {organization?.name} - Performance Overview
            </p>
          </div>
          <Badge variant="outline" className="bg-gradient-to-r from-primary/10 to-accent/10 self-start sm:self-auto">
            <Calendar className="w-3 h-3 mr-1" />
            This Month
          </Badge>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="glass hover-lift">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Users className="w-8 h-8 text-primary" />
                  <Badge variant="secondary">{stats.activeMembers} active</Badge>
                </div>
                <p className="text-3xl font-bold">{stats.totalMembers}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass hover-lift">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <ClipboardList className="w-8 h-8 text-success" />
                  <Badge variant="secondary">{stats.completedAttempts} completed</Badge>
                </div>
                <p className="text-3xl font-bold">{stats.totalInterviews}</p>
                <p className="text-sm text-muted-foreground">Total Interviews</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass hover-lift">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Brain className="w-8 h-8 text-accent" />
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <p className="text-3xl font-bold">{stats.aiTokensUsed.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">AI Tokens Used</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Interview Performance */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Interview Performance</CardTitle>
            <CardDescription>
              Overview of candidate assessment results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Completed Assessments</span>
                  <span className="text-2xl font-bold">{stats.completedAttempts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Average Score</span>
                  <span className="text-2xl font-bold text-primary">{stats.averageScore}%</span>
                </div>
              </div>
              <div className="flex items-center justify-center p-8 rounded-lg border bg-muted/30">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">Detailed charts coming soon</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest organization events and milestones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Activity Timeline Coming Soon</p>
              <p className="text-sm">Track all organization events and member activities</p>
            </div>
          </CardContent>
        </Card>
      </div>
  );
};

export default OrganizationAnalytics;
