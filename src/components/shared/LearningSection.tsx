import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Award, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface LearningStats {
  totalCertificates: number;
  activeLearners: number;
  avgScore: number;
}

interface LearningSectionProps {
  organizationId?: string | null;
  userId?: string | null;
}

export const LearningSection = ({ organizationId, userId }: LearningSectionProps) => {
  const [stats, setStats] = useState<LearningStats>({ totalCertificates: 0, activeLearners: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLearningStats();
  }, [organizationId, userId]);

  const fetchLearningStats = async () => {
    try {
      setLoading(true);

      if (userId) {
        // Fetch user-specific stats
        const { data: certs, error } = await supabase
          .from('certificates')
          .select('score')
          .eq('user_id', userId)
          .eq('is_revoked', false);

        if (error) throw error;

        const avgScore = certs && certs.length > 0
          ? certs.reduce((sum, cert) => sum + cert.score, 0) / certs.length
          : 0;

        setStats({
          totalCertificates: certs?.length || 0,
          activeLearners: 1,
          avgScore: Math.round(avgScore)
        });
      } else if (organizationId) {
        // Fetch org-specific stats
        const { data: members } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organizationId)
          .eq('status', 'active');

        const userIds = members?.map(m => m.user_id) || [];

        if (userIds.length > 0) {
          const { data: certs } = await supabase
            .from('certificates')
            .select('score, user_id')
            .in('user_id', userIds)
            .eq('is_revoked', false);

          const uniqueLearners = new Set(certs?.map(c => c.user_id)).size;
          const avgScore = certs && certs.length > 0
            ? certs.reduce((sum, cert) => sum + cert.score, 0) / certs.length
            : 0;

          setStats({
            totalCertificates: certs?.length || 0,
            activeLearners: uniqueLearners,
            avgScore: Math.round(avgScore)
          });
        }
      } else {
        // Fetch all stats
        const { data: certs } = await supabase
          .from('certificates')
          .select('score, user_id')
          .eq('is_revoked', false);

        const uniqueLearners = new Set(certs?.map(c => c.user_id)).size;
        const avgScore = certs && certs.length > 0
          ? certs.reduce((sum, cert) => sum + cert.score, 0) / certs.length
          : 0;

        setStats({
          totalCertificates: certs?.length || 0,
          activeLearners: uniqueLearners,
          avgScore: Math.round(avgScore)
        });
      }
    } catch (error) {
      logger.error('Error fetching learning stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Learning Hub</h3>
          <p className="text-muted-foreground">Track learning progress and certifications</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/learning')}>
          <GraduationCap className="h-4 w-4 mr-2" />
          View Certifications
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Certificates</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCertificates}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Learners</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeLearners}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgScore}%</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
