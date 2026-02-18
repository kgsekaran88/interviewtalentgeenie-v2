import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  Search, 
  Settings, 
  Eye,
  Calendar,
  Globe,
  Briefcase,
  Loader2,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Send,
  Target,
  Activity,
  Mail
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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
import { logPlatformAdminAccess } from '@/lib/audit-logger';
import { formatDistanceToNow } from 'date-fns';
import { isHireDecision, isNoHireDecision, isConsiderDecision, normalizeHiringDecision } from '@/lib/hiringDecisionUtils';

interface Organization {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  status: string;
  created_at: string;
  member_count?: number;
  interview_count?: number; // Open positions/roles
  subscription_status?: string;
  plan_name?: string;
  // Enhanced details
  max_interviews?: number;
  interviews_used?: number;
  subscription_end?: string | null;
  usage_percentage?: number;
  // Attempt stats
  total_attempts?: number;
  attempts_pending?: number;
  attempts_upload_issues?: number;
  attempts_in_progress?: number;
  attempts_completed?: number;
  // Core metrics
  invitations_sent?: number;
  invitations_completed?: number;
  avg_score?: number | null;
  success_rate?: number | null; // % recommended
  last_activity?: string | null;
  // Key metrics
  total_candidates?: number;
  pending_invitations?: number;
  completion_rate?: number | null;
  flagged_for_review?: number;
  // Status breakdown
  in_progress_count?: number;
  upload_failed_count?: number;
  abandoned_count?: number;
  // Hiring breakdown (Considered, Hire, Strong Hire, Reject)
  consider_count?: number;
  hire_count?: number;
  strong_hire_count?: number;
  reject_count?: number;
}

export default function OrganizationsList() {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { enterImpersonationMode } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [deleteUsers, setDeleteUsers] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);

      // Fetch organizations with their member counts
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (orgsError) throw orgsError;

      // Enrich with counts and subscription info
      const enrichedOrgs = await Promise.all(
        (orgs || []).map(async (org) => {
          // Get member count
          const { count: memberCount } = await supabase
            .from('organization_members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('status', 'active');

          // Get total interview count (roles/positions created)
          const { count: interviewCount } = await supabase
            .from('interviews')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id);

          // Get interview IDs for this org to query attempts
          const { data: orgInterviews } = await supabase
            .from('interviews')
            .select('id')
            .eq('organization_id', org.id);
          
          const interviewIds = orgInterviews?.map(i => i.id) || [];
          
          // Get attempt data with assessments for scoring
          let attemptCounts = { total: 0, pending: 0, upload_issues: 0, in_progress: 0, completed: 0 };
          let avgScore: number | null = null;
          let successRate: number | null = null;
          let lastActivity: string | null = null;
          
          // Key metrics
          let totalCandidates = 0;
          let pendingInvitations = 0;
          let completionRate: number | null = null;
          let flaggedForReview = 0;
          let inProgressCount = 0;
          let uploadFailedCount = 0;
          let abandonedCount = 0;
          let strongHireCount = 0;
          let hireCount = 0;
          let considerCount = 0;
          let rejectCount = 0;
          
          if (interviewIds.length > 0) {
            // Get all attempts with more details
            const { data: attempts } = await supabase
              .from('interview_attempts')
              .select('id, status, submitted_at, started_at, candidate_email, interview_id')
              .in('interview_id', interviewIds)
              .order('submitted_at', { ascending: false });
            
            attemptCounts = {
              total: attempts?.length || 0,
              pending: attempts?.filter(a => !a.status || a.status === 'pending' || a.status === 'submitted').length || 0,
              upload_issues: attempts?.filter(a => a.status === 'pending_upload' || a.status === 'upload_failed').length || 0,
              in_progress: attempts?.filter(a => a.status === 'in_progress').length || 0,
              completed: attempts?.filter(a => a.status === 'evaluated' || a.status === 'terminated').length || 0,
            };
            
            // Status counts for new metrics
            inProgressCount = attempts?.filter(a => a.status === 'in_progress').length || 0;
            uploadFailedCount = attempts?.filter(a => a.status === 'upload_failed' || a.status === 'pending_upload').length || 0;
            abandonedCount = attempts?.filter(a => a.status === 'abandoned').length || 0;
            
            // Get unique candidate emails (total candidates)
            const uniqueCandidates = new Set(attempts?.map(a => a.candidate_email) || []);
            totalCandidates = uniqueCandidates.size;
            
            // Get last activity
            const lastAttempt = attempts?.find(a => a.submitted_at);
            lastActivity = lastAttempt?.submitted_at || null;
            
            // Get evaluated attempt IDs for assessments query
            const evaluatedAttemptIds = attempts?.filter(a => a.status === 'evaluated').map(a => a.id) || [];
            
            if (evaluatedAttemptIds.length > 0) {
              // Get CPI hiring_recommendation (source of truth) with fallback to assessments
              const { data: cpiData } = await supabase
                .from('candidate_performance_index')
                .select('hiring_recommendation, attempt_id')
                .in('attempt_id', evaluatedAttemptIds);
              
              // Get assessments as fallback for attempts without CPI
              const { data: assessments } = await supabase
                .from('assessments')
                .select('hiring_decision, attempt_id')
                .in('attempt_id', evaluatedAttemptIds);
              
              // Create a map for quick lookup - CPI first, then assessments
              const decisionMap = new Map<string, string>();
              assessments?.forEach(a => {
                if (a.hiring_decision) decisionMap.set(a.attempt_id, a.hiring_decision);
              });
              cpiData?.forEach(c => {
                if (c.hiring_recommendation) decisionMap.set(c.attempt_id, c.hiring_recommendation);
              });
              
              // Count decisions using centralized utility for consistent mapping
              decisionMap.forEach(decision => {
                const normalized = normalizeHiringDecision(decision);
                if (normalized === 'strongly_recommend') {
                  strongHireCount++;
                } else if (normalized === 'recommend') {
                  hireCount++;
                } else if (normalized === 'consider') {
                  considerCount++;
                } else if (normalized === 'not_recommended') {
                  rejectCount++;
                }
              });
            }
            
            // Get proctoring sessions for flagged count
            const attemptIds: string[] = attempts?.map(a => a.id) || [];
            if (attemptIds.length > 0) {
              const { data: proctoringSessions } = await supabase
                .from('proctoring_sessions')
                .select('flagged_for_review')
                .filter('attempt_id', 'in', `(${attemptIds.slice(0, 100).join(',')})`);
              
              if (proctoringSessions && proctoringSessions.length > 0) {
                // Flagged for review count
                flaggedForReview = proctoringSessions.filter(s => s.flagged_for_review).length;
              }
            }
          }

          // Get invitation stats
          const { data: invitations } = await supabase
            .from('interview_invitations')
            .select('status')
            .in('interview_id', interviewIds);
          
          const invitationsSent = invitations?.length || 0;
          const invitationsCompleted = invitations?.filter(i => i.status === 'completed').length || 0;
          pendingInvitations = invitations?.filter(i => i.status === 'invited' || i.status === 'pending').length || 0;
          
          // Completion rate (completed / sent)
          completionRate = invitationsSent > 0 
            ? Math.round((invitationsCompleted / invitationsSent) * 100) 
            : null;

          // Get subscription info with plan limits
          const { data: subscription } = await supabase
            .from('organization_subscriptions')
            .select('status, interviews_used, current_period_end, subscription_plans(name, max_interviews)')
            .eq('organization_id', org.id)
            .eq('status', 'active')
            .single();

          const planData = subscription?.subscription_plans as any;
          const maxInterviews = planData?.max_interviews || 0;
          const interviewsUsed = subscription?.interviews_used || 0;
          const usagePercentage = maxInterviews > 0 ? Math.round((interviewsUsed / maxInterviews) * 100) : 0;

          return {
            ...org,
            member_count: memberCount || 0,
            interview_count: interviewCount || 0,
            subscription_status: subscription?.status || 'none',
            plan_name: planData?.name || 'No Plan',
            max_interviews: maxInterviews,
            interviews_used: interviewsUsed,
            subscription_end: subscription?.current_period_end || null,
            usage_percentage: usagePercentage,
            // Attempt stats
            total_attempts: attemptCounts.total,
            attempts_pending: attemptCounts.pending,
            attempts_upload_issues: attemptCounts.upload_issues,
            attempts_in_progress: attemptCounts.in_progress,
            attempts_completed: attemptCounts.completed,
            // Key metrics
            invitations_sent: invitationsSent,
            total_candidates: totalCandidates,
            pending_invitations: pendingInvitations,
            completion_rate: completionRate,
            flagged_for_review: flaggedForReview,
            // Status breakdown
            in_progress_count: inProgressCount,
            upload_failed_count: uploadFailedCount,
            abandoned_count: abandonedCount,
            // Hiring breakdown
            strong_hire_count: strongHireCount,
            hire_count: hireCount,
            consider_count: considerCount,
            reject_count: rejectCount,
          };
        })
      );

      setOrganizations(enrichedOrgs);
    } catch (error) {
      logger.error('Error fetching organizations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organizations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManagePortal = (orgId: string) => {
    enterImpersonationMode(orgId);
    // Pass org ID as URL param to avoid race condition with context state
    navigate(`/partner?impersonate=${orgId}`);
  };

  const handleManageSettings = (orgId: string) => {
    navigate(`/partner/manage/${orgId}`);
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrg) return;

    try {
      setIsDeleting(true);
      
      const { data, error } = await invokeFunction('delete-organization', {
        body: { 
          organizationId: selectedOrg.id,
          deleteUsers: deleteUsers
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete organization');
      }

      await logPlatformAdminAccess(
        'DELETE_ORGANIZATION_COMPLETE',
        selectedOrg.id,
        { 
          organization_name: selectedOrg.name,
          deleted_counts: data.deleted_counts,
          users_deleted: data.users_deleted
        }
      );

      toast({
        title: 'Organization deleted',
        description: `${selectedOrg.name} and all related data (${data.total_deleted} records) have been permanently deleted`,
      });

      setShowDeleteDialog(false);
      setSelectedOrg(null);
      setDeleteUsers(false);
      fetchOrganizations();
    } catch (error) {
      logger.error('Error deleting organization:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete organization',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         org.industry?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'suspended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2">Partner Organizations</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Manage and monitor all partner organizations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Total Orgs</p>
                <p className="text-lg sm:text-2xl font-bold">{organizations.length}</p>
              </div>
              <Building2 className="h-5 w-5 sm:h-8 sm:w-8 text-primary/60 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Active</p>
                <p className="text-lg sm:text-2xl font-bold">
                  {organizations.filter(o => o.status === 'active').length}
                </p>
              </div>
              <div className={`h-3 w-3 rounded-full ${getStatusColor('active')} shrink-0`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Pending</p>
                <p className="text-lg sm:text-2xl font-bold">
                  {organizations.filter(o => o.status === 'pending').length}
                </p>
              </div>
              <div className={`h-3 w-3 rounded-full ${getStatusColor('pending')} shrink-0`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Interviews</p>
                <p className="text-lg sm:text-2xl font-bold">
                  {organizations.reduce((sum, org) => sum + (org.interview_count || 0), 0)}
                </p>
              </div>
              <Briefcase className="h-5 w-5 sm:h-8 sm:w-8 text-primary/60 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('pending')}
              >
                Pending
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Grid */}
      {filteredOrgs.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No organizations found</p>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try adjusting your search' : 'No organizations have been created yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrgs.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Building2 className="h-10 w-10 text-primary" />
                  <Badge className={getStatusColor(org.status)}>
                    {org.status}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{org.name}</CardTitle>
                <CardDescription>
                  {org.industry || 'No industry specified'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Info */}
                <div className="space-y-2 text-sm">
                  {org.website && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <a href={org.website} target="_blank" rel="noopener noreferrer" 
                         className="hover:text-primary truncate">
                        {org.website}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{org.member_count} members</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Created {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}</span>
                  </div>
                </div>

                {/* Plan & Usage */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{org.plan_name}</Badge>
                    {org.subscription_end && (
                      <span className="text-xs text-muted-foreground">
                        Expires {formatDistanceToNow(new Date(org.subscription_end), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {org.max_interviews > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Interview Usage</span>
                        <span className={org.usage_percentage >= 80 ? 'text-destructive font-medium' : 'text-foreground'}>
                          {org.interviews_used}/{org.max_interviews}
                        </span>
                      </div>
                      <Progress 
                        value={org.usage_percentage} 
                        className={`h-2 ${org.usage_percentage >= 80 ? '[&>div]:bg-destructive' : ''}`}
                      />
                      {org.usage_percentage >= 80 && (
                        <div className="flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{org.usage_percentage >= 100 ? 'Quota exhausted' : 'Low quota remaining'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Key Metrics Row 1 - Total Candidates, Invitations Sent, Pending, Completion Rate */}
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="flex flex-col items-center p-2 bg-muted/20 rounded">
                    <Users className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-lg font-semibold">{org.total_candidates || 0}</span>
                    <span className="text-xs text-muted-foreground">Total Candidates</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted/20 rounded">
                    <Mail className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-lg font-semibold">{org.invitations_sent || 0}</span>
                    <span className="text-xs text-muted-foreground">Invitations Sent</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted/20 rounded">
                    <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-lg font-semibold">{org.pending_invitations || 0}</span>
                    <span className="text-xs text-muted-foreground">Pending</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted/20 rounded">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-lg font-semibold">
                      {org.completion_rate !== null ? `${org.completion_rate}%` : '-'}
                    </span>
                    <span className="text-xs text-muted-foreground">Completion</span>
                  </div>
                </div>

                {/* Key Metrics Row 2 - Completed, In Progress, Upload Failed, Abandoned, Flagged */}
                <div className="grid grid-cols-5 gap-1.5 text-sm">
                  <div className="flex flex-col items-center p-2 bg-green-500/10 rounded">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mb-1" />
                    <span className="text-lg font-semibold text-green-600">{org.attempts_completed || 0}</span>
                    <span className="text-[10px] text-muted-foreground">Completed</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted/20 rounded">
                    <Activity className="h-4 w-4 text-primary mb-1" />
                    <span className="text-lg font-semibold text-primary">{org.in_progress_count || 0}</span>
                    <span className="text-[10px] text-muted-foreground">In Progress</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted/20 rounded">
                    <AlertTriangle className="h-4 w-4 text-destructive mb-1" />
                    <span className="text-lg font-semibold text-destructive">{org.upload_failed_count || 0}</span>
                    <span className="text-[10px] text-muted-foreground">Upload Failed</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted/20 rounded">
                    <Clock className="h-4 w-4 text-warning mb-1" />
                    <span className="text-lg font-semibold text-warning">{org.abandoned_count || 0}</span>
                    <span className="text-[10px] text-muted-foreground">Abandoned</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted/20 rounded">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-lg font-semibold">{org.flagged_for_review || 0}</span>
                    <span className="text-[10px] text-muted-foreground">Flagged</span>
                  </div>
                </div>

                {/* Hiring Breakdown - 4 categories */}
                <div className="grid grid-cols-4 gap-2 text-center border-t pt-2">
                  <div className="p-2 bg-primary/10 rounded border border-primary/20">
                    <p className="text-lg font-semibold text-primary">{org.strong_hire_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Strong Hire</p>
                  </div>
                  <div className="p-2 bg-accent/20 rounded border border-accent/30">
                    <p className="text-lg font-semibold text-accent-foreground">{org.hire_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Hire</p>
                  </div>
                  <div className="p-2 bg-warning/10 rounded border border-warning/20">
                    <p className="text-lg font-semibold text-warning">{org.consider_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Considered</p>
                  </div>
                  <div className="p-2 bg-destructive/10 rounded border border-destructive/20">
                    <p className="text-lg font-semibold text-destructive">{org.reject_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Reject</p>
                  </div>
                </div>
                {/* Last Activity */}
                {org.last_activity && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                    <Activity className="h-3 w-3" />
                    <span>Last activity: {formatDistanceToNow(new Date(org.last_activity), { addSuffix: true })}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => handleManagePortal(org.id)}
                    className="flex-1"
                    variant="default"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Portal
                  </Button>
                  <Button 
                    onClick={() => handleManageSettings(org.id)}
                    variant="outline"
                    size="icon"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={() => {
                      setSelectedOrg(org);
                      setShowDeleteDialog(true);
                    }}
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 border-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) {
          setDeleteUsers(false);
          setSelectedOrg(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Delete Organization Completely</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to permanently delete <strong>{selectedOrg?.name}</strong> and ALL related data:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>All interviews, questions, and attempts</li>
                <li>All proctoring sessions and recordings</li>
                <li>All assessments and evaluation reports</li>
                <li>All organization members and their roles</li>
                <li>All subscriptions, invoices, and payments</li>
                <li>All analytics and generated reports</li>
              </ul>
              <p className="text-destructive font-medium">This action cannot be undone!</p>
              
              <div className="flex items-center space-x-2 pt-2 border-t">
                <Checkbox 
                  id="deleteUsers" 
                  checked={deleteUsers}
                  onCheckedChange={(checked) => setDeleteUsers(checked === true)}
                />
                <label 
                  htmlFor="deleteUsers" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Also delete user accounts (only if not in other orgs)
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteOrganization}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Everything'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
