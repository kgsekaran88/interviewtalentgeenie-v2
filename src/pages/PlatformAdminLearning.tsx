import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Users, DollarSign, TrendingUp, Award, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface AdminStats {
  totalAssessments: number;
  assessmentsToday: number;
  assessmentsThisWeek: number;
  assessmentsThisMonth: number;
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  avgCompletionRate: number;
  avgScore: number;
  popularTopics: Array<{ topic: string; count: number }>;
  recentActivity: any[];
  subscriptionBreakdown: any[];
  paymentTransactions: any[];
}

function PlatformAdminLearningContent() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    fetchAdminStats();
  }, [timeRange]);

  const fetchAdminStats = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all assessments
      const { data: assessments, count: totalCount } = await supabase
        .from('learning_assessments')
        .select('*, learning_assessment_attempts(*)', { count: 'exact' });

      // Count assessments by time period
      const assessmentsToday = assessments?.filter(
        a => new Date(a.created_at) >= today
      ).length || 0;

      const assessmentsThisWeek = assessments?.filter(
        a => new Date(a.created_at) >= weekAgo
      ).length || 0;

      const assessmentsThisMonth = assessments?.filter(
        a => new Date(a.created_at) >= monthAgo
      ).length || 0;

      // Get unique users
      const uniqueUsers = new Set(assessments?.map(a => a.user_id)).size;

      // Get active subscriptions
      const { data: subscriptions } = await supabase
        .from('learning_subscriptions')
        .select('*')
        .eq('status', 'active')
        .gt('expires_at', now.toISOString());

      // Get payments
      const { data: payments } = await supabase
        .from('learning_payments')
        .select('*')
        .eq('status', 'completed');

      const totalRevenue = payments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0;

      // Calculate completion rate
      const allAttempts = assessments?.flatMap(a => a.learning_assessment_attempts) || [];
      const completedAttempts = allAttempts.filter((a: any) => a.status === 'evaluated');
      const avgCompletionRate = allAttempts.length > 0
        ? (completedAttempts.length / allAttempts.length) * 100
        : 0;

      // Calculate average score
      const avgScore = completedAttempts.length > 0
        ? completedAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / completedAttempts.length
        : 0;

      // Get popular topics
      const topicCounts: Record<string, number> = {};
      assessments?.forEach(a => {
        const topic = a.topic_description.substring(0, 50);
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
      const popularTopics = Object.entries(topicCounts)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent activity
      const recentActivity = assessments
        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20) || [];

      setStats({
        totalAssessments: totalCount || 0,
        assessmentsToday,
        assessmentsThisWeek,
        assessmentsThisMonth,
        totalUsers: uniqueUsers,
        activeSubscriptions: subscriptions?.length || 0,
        totalRevenue: totalRevenue / 100,
        avgCompletionRate: Math.round(avgCompletionRate),
        avgScore: Math.round(avgScore),
        popularTopics,
        recentActivity,
        subscriptionBreakdown: subscriptions || [],
        paymentTransactions: payments || [],
      });
    } catch (error) {
      logger.error('Error fetching admin stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin statistics',
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
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Learning Platform Administration</h1>
        <p className="text-sm text-muted-foreground">Monitor and manage the learning system</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Assessments</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.totalAssessments}</div>
            <p className="text-xs text-muted-foreground">+{stats?.assessmentsToday} today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.totalUsers}</div>
            <p className="text-xs text-muted-foreground">{stats?.activeSubscriptions} subscribed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">${stats?.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{stats?.paymentTransactions.length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Avg Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.avgScore}%</div>
            <p className="text-xs text-muted-foreground">{stats?.avgCompletionRate}% completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Time-based Stats */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Assessment Activity</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Assessments created over time</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Today</span>
              </div>
              <div className="text-2xl font-bold">{stats?.assessmentsToday}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">This Week</span>
              </div>
              <div className="text-2xl font-bold">{stats?.assessmentsThisWeek}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">This Month</span>
              </div>
              <div className="text-2xl font-bold">{stats?.assessmentsThisMonth}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="h-auto grid grid-cols-2 sm:inline-flex sm:grid-cols-4">
          <TabsTrigger value="activity" className="text-xs sm:text-sm min-h-[40px]">Activity</TabsTrigger>
          <TabsTrigger value="topics" className="text-xs sm:text-sm min-h-[40px]">Topics</TabsTrigger>
          <TabsTrigger value="subscriptions" className="text-xs sm:text-sm min-h-[40px]">Subscriptions</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs sm:text-sm min-h-[40px]">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.recentActivity.map((assessment: any) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">{assessment.title}</TableCell>
                      <TableCell>{assessment.user_id.substring(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline">{assessment.status}</Badge>
                      </TableCell>
                      <TableCell>{new Date(assessment.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Popular Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.popularTopics.map((topic, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{topic.topic}</p>
                    </div>
                    <Badge>{topic.count} assessments</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.subscriptionBreakdown.map((sub: any) => (
                    <TableRow key={sub.id}>
                      <TableCell>{sub.user_id.substring(0, 8)}...</TableCell>
                      <TableCell className="capitalize">{sub.plan_type}</TableCell>
                      <TableCell>
                        <Badge variant={sub.is_unlimited ? 'default' : 'secondary'}>
                          {sub.is_unlimited ? 'Unlimited' : 'Pay-per-use'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(sub.expires_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.paymentTransactions.slice(0, 20).map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.user_id.substring(0, 8)}...</TableCell>
                      <TableCell>${(payment.amount_cents / 100).toFixed(2)}</TableCell>
                      <TableCell className="capitalize">{payment.payment_method}</TableCell>
                      <TableCell>
                        <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
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

export default function PlatformAdminLearning() {
  return (
    <ProtectedRoute requiredRoles={['platform_admin']}>
      <PlatformAdminLearningContent />
    </ProtectedRoute>
  );
}