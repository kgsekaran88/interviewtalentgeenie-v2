import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ProctoringSession {
  id: string;
  created_at: string;
  ended_at: string | null;
  tab_switch_count: number | null;
  multiple_person_detections: number | null;
  look_away_count: number | null;
  integrity_score: number | null;
  interview_attempts: {
    candidate_name: string;
    candidate_email: string;
    interviews: {
      title: string;
      organization_id: string;
    };
  } | null;
}

interface ProctoringSectionProps {
  organizationId?: string | null;
}

export const ProctoringSection = ({ organizationId }: ProctoringSectionProps) => {
  const [sessions, setSessions] = useState<ProctoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, [organizationId]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('proctoring_sessions')
        .select(`
          id,
          created_at,
          ended_at,
          tab_switch_count,
          multiple_person_detections,
          look_away_count,
          integrity_score,
          interview_attempts(
            candidate_name,
            candidate_email,
            interviews(
              title,
              organization_id
            )
          )
        `)
        .not('interview_attempt_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data, error } = await query;

      if (error) throw error;

      // Filter by organization if specified
      let filteredData = data || [];
      if (organizationId) {
        filteredData = filteredData.filter((session: any) => 
          session.interview_attempts?.interviews?.organization_id === organizationId
        );
      }

      setSessions(filteredData as ProctoringSession[]);
    } catch (error) {
      logger.error('Error fetching proctoring sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateViolations = (session: ProctoringSession) => {
    return (
      (session.tab_switch_count || 0) +
      (session.multiple_person_detections || 0) +
      (session.look_away_count || 0)
    );
  };

  const getIntegrityBadge = (score: number | null) => {
    if (!score) score = 0;
    if (score >= 80) {
      return <Badge className="bg-success"><CheckCircle className="h-3 w-3 mr-1" />High</Badge>;
    } else if (score >= 50) {
      return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" />Medium</Badge>;
    } else {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Low</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Proctoring Dashboard</h3>
          <p className="text-muted-foreground">Monitor interview integrity</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/interviewer/proctoring')}>
          <Eye className="h-4 w-4 mr-2" />
          View All Sessions
        </Button>
      </div>

      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No proctoring sessions found.
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => {
            const violations = calculateViolations(session);
            return (
              <Card key={session.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        {session.interview_attempts?.candidate_name || 'Unknown'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {session.interview_attempts?.interviews?.title || 'N/A'}
                        <br />
                        {session.interview_attempts?.candidate_email || 'N/A'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {getIntegrityBadge(session.integrity_score)}
                      {violations > 0 && (
                        <Badge variant="destructive">
                          {violations} violations
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
