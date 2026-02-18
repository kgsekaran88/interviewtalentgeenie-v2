import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Interview {
  id: string;
  title: string;
  status: string;
  question_count: number;
  time_limit: number;
  created_at: string;
  organization_id: string;
  organizations?: {
    name: string;
  };
}

interface InterviewManagementSectionProps {
  organizationId?: string | null;
  showOrgColumn?: boolean;
}

export const InterviewManagementSection = ({ organizationId, showOrgColumn = false }: InterviewManagementSectionProps) => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [interviewToDelete, setInterviewToDelete] = useState<Interview | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();

  useEffect(() => {
    fetchInterviews();
  }, [organizationId]);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('interviews')
        .select(`
          id,
          title,
          status,
          question_count,
          time_limit,
          created_at,
          organization_id,
          organizations(name)
        `)
        .order('created_at', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching interviews:', error);
        toast({
          title: "Error",
          description: "Failed to load interviews. Please check your permissions.",
          variant: "destructive",
        });
        setInterviews([]);
      } else {
        setInterviews(data || []);
      }
    } catch (error) {
      logger.error('Error fetching interviews:', error);
      toast({
        title: "Error",
        description: "Failed to load interviews. Please try again.",
        variant: "destructive",
      });
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, interview: Interview) => {
    e.stopPropagation();
    setInterviewToDelete(interview);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!interviewToDelete) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to delete interviews.",
          variant: "destructive",
        });
        return;
      }

      const response = await invokeFunction('delete-interview', {
        body: { interviewId: interviewToDelete.id },
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Success",
        description: "Interview deleted successfully.",
      });

      // Refresh the list
      fetchInterviews();
    } catch (error: any) {
      logger.error('Error deleting interview:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete interview.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setInterviewToDelete(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'draft':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end items-center">
          <Button onClick={() => navigate('/partner/recruiting/jd-builder')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Interview
          </Button>
        </div>

        <div className="grid gap-4">
          {interviews.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No interviews found. Create your first interview to get started.
              </CardContent>
            </Card>
          ) : (
            interviews.map((interview) => (
              <Card key={interview.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/partner/recruiting/interview/${interview.id}`)}>
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {interview.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {interview.question_count} questions • {interview.time_limit} minutes
                        {showOrgColumn && interview.organizations && (
                          <> • {interview.organizations.name}</>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={interview.status === 'active' ? 'default' : 'secondary'} className="flex items-center gap-1">
                        {getStatusIcon(interview.status)}
                        {interview.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteClick(e, interview)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Interview</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{interviewToDelete?.title}"? This will permanently delete the interview and all associated data including questions, attempts, and assessments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
