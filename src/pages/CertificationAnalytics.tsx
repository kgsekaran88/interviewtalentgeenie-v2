import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Award, TrendingUp, Users, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/layouts/AdminLayout';

interface CertificationStats {
  totalAttempts: number;
  totalCertificatesIssued: number;
  overallPassRate: number;
  avgScore: number;
  avgIntegrityScore: number;
  topicStats: Array<{
    topic: string;
    attempts: number;
    passed: number;
    passRate: number;
    avgScore: number;
  }>;
  recentAttempts: any[];
  trendingTopics: Array<{ topic: string; count: number }>;
}

function CertificationAnalyticsContent() {
  const [stats, setStats] = useState<CertificationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch all certification attempts with related data
      const { data: attempts } = await supabase
        .from('certification_attempts' as any)
        .select('*, certification_assessments(*, certification_topics(*))') as any;

      if (!attempts) {
        setStats({
          totalAttempts: 0,
          totalCertificatesIssued: 0,
          overallPassRate: 0,
          avgScore: 0,
          avgIntegrityScore: 0,
          topicStats: [],
          recentAttempts: [],
          trendingTopics: [],
        });
        return;
      }

      const totalAttempts = attempts.length;
      const passedAttempts = attempts.filter((a: any) => a.passed);
      const totalCertificatesIssued = passedAttempts.length;
      const overallPassRate = totalAttempts > 0 ? (totalCertificatesIssued / totalAttempts) * 100 : 0;

      const avgScore = attempts.length > 0
        ? attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / attempts.length
        : 0;

      const avgIntegrityScore = attempts.length > 0
        ? attempts.reduce((sum: number, a: any) => sum + (a.integrity_score || 0), 0) / attempts.length
        : 0;

      // Calculate topic-wise statistics
      const topicMap = new Map<string, any>();
      attempts.forEach((attempt: any) => {
        const topic = attempt.certification_assessments?.certification_topics?.name || 'Unknown';
        if (!topicMap.has(topic)) {
          topicMap.set(topic, {
            topic,
            attempts: 0,
            passed: 0,
            totalScore: 0,
          });
        }
        const stat = topicMap.get(topic);
        stat.attempts++;
        if (attempt.passed) stat.passed++;
        stat.totalScore += attempt.score || 0;
      });

      const topicStats = Array.from(topicMap.values()).map((stat: any) => ({
        topic: stat.topic,
        attempts: stat.attempts,
        passed: stat.passed,
        passRate: (stat.passed / stat.attempts) * 100,
        avgScore: stat.totalScore / stat.attempts,
      })).sort((a, b) => b.attempts - a.attempts);

      // Trending topics (most attempts in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentAttempts = attempts.filter((a: any) => 
        new Date(a.created_at) >= thirtyDaysAgo
      );

      const trendingMap = new Map<string, number>();
      recentAttempts.forEach((attempt: any) => {
        const topic = attempt.certification_assessments?.certification_topics?.name || 'Unknown';
        trendingMap.set(topic, (trendingMap.get(topic) || 0) + 1);
      });

      const trendingTopics = Array.from(trendingMap.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setStats({
        totalAttempts,
        totalCertificatesIssued,
        overallPassRate,
        avgScore,
        avgIntegrityScore,
        topicStats,
        recentAttempts: attempts.slice(0, 20),
        trendingTopics,
      });
    } catch (error) {
      logger.error('Error fetching certification analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Certification Analytics</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Track certification performance and trends</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAttempts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates Issued</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCertificatesIssued}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.overallPassRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgScore.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Integrity</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgIntegrityScore.toFixed(1)}/100</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="topics" className="space-y-4">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex h-auto">
          <TabsTrigger value="topics" className="text-xs sm:text-sm min-h-[44px]">Topics</TabsTrigger>
          <TabsTrigger value="trending" className="text-xs sm:text-sm min-h-[44px]">Trending</TabsTrigger>
          <TabsTrigger value="recent" className="text-xs sm:text-sm min-h-[44px]">Recent</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Topic</CardTitle>
              <CardDescription>Pass rates and average scores per certification</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Passed</TableHead>
                    <TableHead>Pass Rate</TableHead>
                    <TableHead>Avg Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.topicStats.map((topic: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{topic.topic}</TableCell>
                      <TableCell>{topic.attempts}</TableCell>
                      <TableCell>{topic.passed}</TableCell>
                      <TableCell>
                        <Badge variant={topic.passRate >= 70 ? 'default' : 'destructive'}>
                          {topic.passRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{topic.avgScore.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trending Certifications</CardTitle>
              <CardDescription>Most attempted in last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.trendingTopics.map((topic, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{topic.topic}</p>
                    </div>
                    <Badge>{topic.count} attempts</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Integrity</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.recentAttempts.map((attempt: any) => (
                    <TableRow key={attempt.id}>
                      <TableCell>{attempt.user_id.substring(0, 8)}...</TableCell>
                      <TableCell>
                        {attempt.certification_assessments?.certification_topics?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>{attempt.score}%</TableCell>
                      <TableCell>{attempt.integrity_score}/100</TableCell>
                      <TableCell>
                        {attempt.passed ? (
                          <Badge variant="default">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Passed
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(attempt.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CertificationAnalytics() {
  return (
    <ProtectedRoute requiredRoles={['platform_admin']}>
      <AdminLayout>
        <CertificationAnalyticsContent />
      </AdminLayout>
    </ProtectedRoute>
  );
}