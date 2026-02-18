import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  TrendingUp, 
  Award, 
  Target, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Trophy,
  ListChecks,
  Activity,
  Calendar,
  BarChart3
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/AppLayout';
import { LearningSubscriptionBanner } from '@/components/LearningSubscriptionBanner';

interface DashboardStats {
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  certificationsEarned: number;
  activeLearningPlans: number;
  recentActivity: any[];
  progressStats: {
    completed: number;
    inProgress: number;
    notStarted: number;
  };
}

export default function LearningDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      // Get learning assessment attempts
      const { data: attempts, count: totalCount } = await supabase
        .from('learning_assessment_attempts')
        .select('*, learning_assessments(title, mode)', { count: 'exact' })
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      const completedAttempts = attempts?.filter((a: any) => a.status === 'evaluated') || [];
      const inProgressAttempts = attempts?.filter((a: any) => a.status === 'in_progress') || [];
      
      const avgScore = completedAttempts.length > 0
        ? Math.round(completedAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / completedAttempts.length)
        : 0;

      // Get certificates
      const { count: certsCount } = await supabase
        .from('certificates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_revoked', false);

      // Get learning plans (user_topic_progress)
      const { count: plansCount } = await supabase
        .from('user_topic_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .in('status', ['in_progress', 'not_started']);

      // Recent activity - last 5 attempts
      const recentActivity = attempts?.slice(0, 5).map((attempt: any) => ({
        id: attempt.id,
        type: 'assessment',
        title: attempt.learning_assessments?.title || 'Assessment',
        status: attempt.status,
        score: attempt.score,
        created_at: attempt.created_at,
        mode: attempt.learning_assessments?.mode,
      })) || [];

      setStats({
        totalAttempts: totalCount || 0,
        completedAttempts: completedAttempts.length,
        averageScore: avgScore,
        certificationsEarned: certsCount || 0,
        activeLearningPlans: plansCount || 0,
        recentActivity,
        progressStats: {
          completed: completedAttempts.length,
          inProgress: inProgressAttempts.length,
          notStarted: (totalCount || 0) - completedAttempts.length - inProgressAttempts.length,
        },
      });
    } catch (error) {
      logger.error('Error fetching dashboard stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'evaluated':
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'submitted':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in px-3 sm:px-0">
        {/* Subscription Banner */}
        <LearningSubscriptionBanner />

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shrink-0">
              <GraduationCap className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Learning Hub</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Your personalized learning and certification center</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Assessments</CardTitle>
              <BookOpen className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.totalAttempts}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.completedAttempts} completed
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.averageScore}%</div>
              <p className="text-xs text-muted-foreground">
                Across all attempts
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Certifications</CardTitle>
              <Trophy className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.certificationsEarned}</div>
              <p className="text-xs text-muted-foreground">
                Earned certificates
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Active Plans</CardTitle>
              <Target className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.activeLearningPlans}</div>
              <p className="text-xs text-muted-foreground">
                In progress
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Feature Cards */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {/* Certifications Card */}
          <Card className="hover-lift border-2 border-amber-500/20 hover:border-amber-500/50 transition-all">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Award className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                </div>
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 text-xs">
                  {stats?.certificationsEarned} Earned
                </Badge>
              </div>
              <CardTitle className="text-lg sm:text-xl">Certifications</CardTitle>
              <CardDescription className="text-sm">
                Earn industry-recognized certifications from leading platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>AWS, Azure, GCP & more</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Proctored exam environment</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Downloadable certificates</span>
              </div>
            </CardContent>
            <CardFooter className="p-4 sm:p-6 pt-0 sm:pt-0 flex gap-2">
              <Button 
                className="flex-1 min-h-[44px]" 
                onClick={() => navigate('/certifications')}
              >
                Browse
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 min-h-[44px]"
                onClick={() => navigate('/my-certificates')}
              >
                My Certs
              </Button>
            </CardFooter>
          </Card>

          {/* My Learning Plan Card */}
          <Card className="hover-lift border-2 border-blue-500/20 hover:border-blue-500/50 transition-all">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <ListChecks className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 text-xs">
                  {stats?.activeLearningPlans} Active
                </Badge>
              </div>
              <CardTitle className="text-lg sm:text-xl">My Learning Plan</CardTitle>
              <CardDescription className="text-sm">
                Personalized learning paths tailored to your goals and progress
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Curated learning materials</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Track progress & milestones</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>AI-recommended topics</span>
              </div>
            </CardContent>
            <CardFooter className="p-4 sm:p-6 pt-0 sm:pt-0">
              <Button 
                className="w-full min-h-[44px]" 
                onClick={() => navigate('/my-learning-plan')}
              >
                View My Plan
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Progress Stats & Recent Activity */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {/* Progress Stats */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <CardTitle className="text-base sm:text-lg">Learning Progress</CardTitle>
              </div>
              <CardDescription className="text-sm">Your overall learning statistics</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium">{stats?.progressStats.completed} assessments</span>
                </div>
                <Progress value={(stats?.progressStats.completed / (stats?.totalAttempts || 1)) * 100} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">In Progress</span>
                  <span className="font-medium">{stats?.progressStats.inProgress} assessments</span>
                </div>
                <Progress value={(stats?.progressStats.inProgress / (stats?.totalAttempts || 1)) * 100} className="h-2 [&>*]:bg-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-green-600">{stats?.averageScore}%</div>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats?.completedAttempts}</div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
              </div>
              <CardDescription className="text-sm">Your latest assessment attempts</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              {stats?.recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Start your first assessment!</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {stats?.recentActivity.map((activity: any) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => navigate(`/learning-feedback/${activity.id}`)}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {activity.mode === 'exam' ? (
                          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                        ) : (
                          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-xs sm:text-sm">{activity.title}</p>
                        <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(activity.created_at).toLocaleDateString()}</span>
                          {activity.score && (
                            <>
                              <span>•</span>
                              <span className="font-medium">{activity.score}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant={getStatusBadgeVariant(activity.status)} className="shrink-0 text-xs">
                        {activity.status === 'evaluated' ? 'Done' : 
                         activity.status === 'in_progress' ? 'Active' : 
                         activity.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="p-4 sm:p-6 pt-0 sm:pt-0">
              <Button 
                variant="outline" 
                className="w-full min-h-[44px]"
                onClick={() => navigate('/learning-history')}
              >
                View All History
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}