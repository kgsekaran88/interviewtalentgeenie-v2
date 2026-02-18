import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/AppLayout';
import { logger } from '@/lib/logger';

interface AssessmentHistory {
  id: string;
  title: string;
  topic_description: string;
  mode: string;
  status: string;
  created_at: string;
  attempts: any[];
}

export default function LearningHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentHistory[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<AssessmentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');

  useEffect(() => {
    if (user) {
      fetchAssessmentHistory();
    }
  }, [user]);

  useEffect(() => {
    filterAssessments();
  }, [assessments, searchQuery, statusFilter, modeFilter]);

  const fetchAssessmentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_assessments')
        .select(`
          *,
          learning_assessment_attempts (
            id,
            status,
            score,
            submitted_at,
            learning_assessment_feedback (
              overall_score,
              percentage,
              strengths,
              weaknesses
            )
          )
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map the data to match AssessmentHistory interface
      const mappedData = (data || []).map(item => ({
        ...item,
        attempts: item.learning_assessment_attempts || []
      }));
      
      setAssessments(mappedData);
    } catch (error) {
      logger.error('Error fetching history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assessment history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAssessments = () => {
    let filtered = [...assessments];

    if (searchQuery) {
      filtered = filtered.filter(
        a =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.topic_description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    if (modeFilter !== 'all') {
      filtered = filtered.filter(a => a.mode === modeFilter);
    }

    setFilteredAssessments(filtered);
  };

  const getLatestAttempt = (assessment: AssessmentHistory) => {
    if (!assessment.attempts || assessment.attempts.length === 0) return null;
    return assessment.attempts.sort(
      (a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
    )[0];
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
      case 'evaluated':
        return 'default';
      case 'generating':
        return 'secondary';
      case 'draft':
        return 'outline';
      default:
        return 'secondary';
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
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/learning-dashboard')} className="self-start min-h-[44px] min-w-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">Assessment History</h1>
            <p className="text-sm sm:text-base text-muted-foreground">View all your past assessments and scores</p>
          </div>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Filters</CardTitle>
            <CardDescription className="text-sm">Search and filter your assessment history</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assessments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 min-h-[44px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="generating">Generating</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Filter by mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="assessment">Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Your Assessments ({filteredAssessments.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {/* Mobile card view */}
            <div className="sm:hidden space-y-3 p-4">
              {filteredAssessments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No assessments found</p>
              ) : (
                filteredAssessments.map((assessment) => {
                  const latestAttempt = getLatestAttempt(assessment);
                  const feedback = latestAttempt?.learning_assessment_feedback?.[0];

                  return (
                    <Card key={assessment.id} className="p-4">
                      <div className="space-y-3">
                        <div>
                          <div className="font-medium text-sm">{assessment.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {assessment.topic_description}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="capitalize text-xs">
                            {assessment.mode}
                          </Badge>
                          <Badge variant={getStatusBadgeVariant(assessment.status)} className="text-xs">
                            {assessment.status}
                          </Badge>
                          {feedback && (
                            <Badge variant="secondary" className="text-xs">
                              {feedback.percentage}%
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {new Date(assessment.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/learning-progress/${assessment.id}`)}
                              className="min-h-[36px] text-xs"
                            >
                              View
                            </Button>
                            {feedback && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/learning-feedback/${latestAttempt.id}`)}
                                className="min-h-[36px] text-xs"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssessments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No assessments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssessments.map((assessment) => {
                      const latestAttempt = getLatestAttempt(assessment);
                      const feedback = latestAttempt?.learning_assessment_feedback?.[0];

                      return (
                        <TableRow key={assessment.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{assessment.title}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-xs">
                                {assessment.topic_description}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {assessment.mode}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(assessment.status)}>
                              {assessment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {feedback ? (
                              <div className="font-medium">{feedback.percentage}%</div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(assessment.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/learning-progress/${assessment.id}`)}
                              >
                                View
                              </Button>
                              {feedback && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/learning-feedback/${latestAttempt.id}`)}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Feedback
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}