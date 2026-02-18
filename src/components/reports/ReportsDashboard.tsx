import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2, 
  XCircle,
  Clock,
  Shield,
  AlertTriangle,
  Target,
  Award,
  BarChart3
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { isHireDecision, isNoHireDecision, isConsiderDecision } from "@/lib/hiringDecisionUtils";

interface ReportsDashboardProps {
  data: any[];
  dateFrom: string;
  dateTo: string;
  loading: boolean;
}

export function ReportsDashboard({ data, dateFrom, dateTo, loading }: ReportsDashboardProps) {
  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!data.length) return null;

    const totalCandidates = data.length;
    const withScores = data.filter(d => d.overall_score != null);
    const avgScore = withScores.length > 0
      ? Math.round(withScores.reduce((sum, d) => sum + d.overall_score, 0) / withScores.length)
      : 0;

    // Use centralized hiring decision utilities for consistent counting
    const hireCount = data.filter(d => isHireDecision(d.hiring_decision)).length;
    const noHireCount = data.filter(d => isNoHireDecision(d.hiring_decision)).length;
    const maybeCount = data.filter(d => isConsiderDecision(d.hiring_decision)).length;
    const hireRate = totalCandidates > 0 ? Math.round((hireCount / totalCandidates) * 100) : 0;

    const withIntegrity = data.filter(d => d.integrity_score != null);
    const avgIntegrity = withIntegrity.length > 0
      ? Math.round(withIntegrity.reduce((sum, d) => sum + d.integrity_score, 0) / withIntegrity.length)
      : 0;

    const withTime = data.filter(d => d.time_taken != null);
    const avgTimeMins = withTime.length > 0
      ? Math.round(withTime.reduce((sum, d) => sum + d.time_taken, 0) / withTime.length / 60)
      : 0;

    // Top performing interviews
    const byInterview = data.reduce((acc, d) => {
      if (!d.interview_title) return acc;
      if (!acc[d.interview_title]) {
        acc[d.interview_title] = { count: 0, scores: [], hires: 0 };
      }
      acc[d.interview_title].count++;
      if (d.overall_score != null) acc[d.interview_title].scores.push(d.overall_score);
      if (isHireDecision(d.hiring_decision)) acc[d.interview_title].hires++;
      return acc;
    }, {} as Record<string, { count: number; scores: number[]; hires: number }>);

    const interviewStats = Object.entries(byInterview).map(([title, statsData]) => {
      const stats = statsData as { count: number; scores: number[]; hires: number };
      return {
        title,
        count: stats.count,
        avgScore: stats.scores.length > 0 ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) : 0,
        hireRate: stats.count > 0 ? Math.round((stats.hires / stats.count) * 100) : 0,
      };
    }).sort((a, b) => b.count - a.count).slice(0, 5);

    // Violations summary - use violations_detected from CPI which counts all 30+ violation types
    const totalViolations = data.reduce((sum, d) => sum + (d.violations_detected || 0), 0);

    const highRiskCandidates = data.filter(d => d.integrity_score != null && d.integrity_score < 70).length;

    return {
      totalCandidates,
      avgScore,
      hireCount,
      noHireCount,
      maybeCount,
      hireRate,
      avgIntegrity,
      avgTimeMins,
      interviewStats,
      totalViolations,
      highRiskCandidates,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Generate a report to see dashboard metrics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalCandidates}</div>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(dateFrom), "MMM d")} - {format(parseISO(dateTo), "MMM d, yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avgScore}%</div>
            <div className="flex items-center gap-1 text-xs">
              {kpis.avgScore >= 70 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={kpis.avgScore >= 70 ? "text-green-600" : "text-red-600"}>
                {kpis.avgScore >= 70 ? "Above threshold" : "Below threshold"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Hire Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.hireRate}%</div>
            <p className="text-xs text-muted-foreground">
              {kpis.hireCount} hired of {kpis.totalCandidates}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Integrity</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avgIntegrity}%</div>
            <p className="text-xs text-muted-foreground">
              {kpis.highRiskCandidates} high-risk candidates
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hiring Decision Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hiring Decisions</CardTitle>
            <CardDescription>Breakdown of candidate outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Strong Hire / Hire</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{kpis.hireCount}</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    {kpis.totalCandidates > 0 ? Math.round((kpis.hireCount / kpis.totalCandidates) * 100) : 0}%
                  </Badge>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${kpis.totalCandidates > 0 ? (kpis.hireCount / kpis.totalCandidates) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Maybe</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{kpis.maybeCount}</span>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                    {kpis.totalCandidates > 0 ? Math.round((kpis.maybeCount / kpis.totalCandidates) * 100) : 0}%
                  </Badge>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full" 
                  style={{ width: `${kpis.totalCandidates > 0 ? (kpis.maybeCount / kpis.totalCandidates) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Reject</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{kpis.noHireCount}</span>
                  <Badge variant="secondary" className="bg-red-100 text-red-700">
                    {kpis.totalCandidates > 0 ? Math.round((kpis.noHireCount / kpis.totalCandidates) * 100) : 0}%
                  </Badge>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ width: `${kpis.totalCandidates > 0 ? (kpis.noHireCount / kpis.totalCandidates) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Stats</CardTitle>
            <CardDescription>Performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Avg Time Taken</span>
                </div>
                <span className="text-sm font-medium">{kpis.avgTimeMins} min</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Violations</span>
                </div>
                <span className="text-sm font-medium">{kpis.totalViolations}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">High Risk Candidates</span>
                </div>
                <Badge variant={kpis.highRiskCandidates > 0 ? "destructive" : "secondary"}>
                  {kpis.highRiskCandidates}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Interviews */}
      {kpis.interviewStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Interviews by Volume</CardTitle>
            <CardDescription>Most active interviews in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpis.interviewStats.map((interview, idx) => (
                <div key={interview.title} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[300px]">{interview.title}</p>
                      <p className="text-xs text-muted-foreground">{interview.count} candidates</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{interview.avgScore}%</p>
                      <p className="text-xs text-muted-foreground">Avg Score</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{interview.hireRate}%</p>
                      <p className="text-xs text-muted-foreground">Hire Rate</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
