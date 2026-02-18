import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { logger } from "@/lib/logger";
import { getHiringDecisionInfo } from "@/lib/hiringDecisionUtils";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Copy, Eye, Play, Archive, Trash2, FileText, RefreshCw, Loader2, Shield, Brain, Mail, Unlock, Video, ChevronDown, Users, Send, Upload, CheckCircle2, UserCheck, Shuffle, Pencil, Check, X, Info, AlertCircle } from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useOnboarding } from "@/hooks/useOnboarding";
import { InvitationDialog } from "@/components/InvitationDialog";
import { QuestionPreviewCard } from "@/components/interview/QuestionPreviewCard";
import { InvitationList } from "@/components/interview/InvitationList";
import { SampleInterviewModal } from "@/components/interview/SampleInterviewModal";
import AttemptVideoPlayer from "@/components/proctoring/AttemptVideoPlayer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { AttemptFilters, AttemptFiltersState, defaultFilters, filterAttempts } from "@/components/interview/AttemptFilters";

const InterviewDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { user } = useAuth();
  const { updateProgress } = useOnboarding();
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<string | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [reEvaluatingId, setReEvaluatingId] = useState<string | null>(null);
  const [recordingsDialogOpen, setRecordingsDialogOpen] = useState(false);
  const [selectedProctoringSession, setSelectedProctoringSession] = useState<any | null>(null);
  const [invitationsOpen, setInvitationsOpen] = useState(true);
  const [attemptsOpen, setAttemptsOpen] = useState(true);
  
  // Review workflow state
  const [sendForReviewOpen, setSendForReviewOpen] = useState(false);
  const [techSpocs, setTechSpocs] = useState<any[]>([]);
  const [selectedTechSpoc, setSelectedTechSpoc] = useState<string>("");
  const [sendingForReview, setSendingForReview] = useState(false);
  const [approvingQuestions, setApprovingQuestions] = useState(false);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  // Attempt filters state
  const [attemptFilters, setAttemptFilters] = useState<AttemptFiltersState>(defaultFilters);

  // Determine the correct base path based on current location
  const getBasePath = () => {
    if (location.pathname.startsWith('/interviewer')) {
      return '/interviewer';
    } else if (location.pathname.startsWith('/partner')) {
      return '/partner/recruiting';
    }
    return '/partner/recruiting';
  };

  const basePath = getBasePath();

  // Memoized filtered attempts and filter options
  const filteredAttempts = useMemo(() => filterAttempts(attempts, attemptFilters), [attempts, attemptFilters]);
  
  const statusOptions = useMemo(() => {
    const statuses = [...new Set(attempts.map((a) => a.status).filter(Boolean))];
    return statuses.sort();
  }, [attempts]);

  // Get decision options from CPI (primary) with fallback to assessments
  const decisionOptions = useMemo(() => {
    const decisions = [...new Set(attempts.map((a) => {
      // Prefer CPI hiring_recommendation, fallback to assessments
      const cpi = Array.isArray(a.candidate_performance_index) ? a.candidate_performance_index[0] : a.candidate_performance_index;
      return cpi?.hiring_recommendation || a.assessments?.hiring_decision;
    }).filter(Boolean))];
    return decisions.sort();
  }, [attempts]);

  useEffect(() => {
    fetchInterviewDetails();
  }, [id]);

  // Auto-refresh when generation is in progress
  useEffect(() => {
    if (!interview || interview.generation_status !== 'generating') return;
    
    const refreshInterval = setInterval(() => {
      fetchInterviewDetails();
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(refreshInterval);
  }, [interview?.generation_status]);

  // Auto-refresh when there are submitted/pending attempts awaiting evaluation
  useEffect(() => {
    const hasPendingAttempts = attempts.some(
      a => (a.status === 'submitted' || a.status === 'pending_upload') && !a.assessments?.id
    );
    
    if (!hasPendingAttempts) return;
    
    const refreshInterval = setInterval(() => {
      logger.debug('Auto-refreshing to check for completed evaluations...');
      fetchInterviewDetails();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(refreshInterval);
  }, [attempts]);

  const fetchInterviewDetails = async () => {
    // Fetch interview with organization slug
    const { data: interviewData, error: interviewError } = await supabase
      .from("interviews")
      .select("*, organization:organizations(id, name, slug)")
      .eq("id", id)
      .single();

    if (interviewError) {
      toast({
        title: "Error",
        description: "Failed to load interview",
        variant: "destructive",
      });
      return;
    }

    const { data: questionsData } = await supabase
      .from("questions")
      .select("*")
      .eq("interview_id", id)
      .order("order_index");

    const { data: attemptsData, error: attemptsError } = await supabase
      .from("interview_attempts")
      .select(`
        *,
        assessments (*),
        candidate_performance_index (
          hiring_recommendation,
          overall_cpi,
          integrity_score,
          technical_score,
          problem_solving_score,
          violations_detected
        ),
        proctoring_sessions (
          id,
          integrity_score,
          flagged_for_review,
          multiple_person_detections,
          multiple_voice_detections,
          tab_switch_count,
          look_away_count,
          violations,
          detailed_violations,
          ignored_violations,
          video_recording_url,
          screen_recording_url,
          review_status,
          reviewer_notes,
          upload_status,
          upload_error,
          upload_started_at,
          upload_completed_at
        )
      `)
      .eq("interview_id", id)
      .order("created_at", { ascending: false });

    // Fetch invitations (without join - we'll fetch sender profiles separately)
    const { data: invitationsData, error: invitationsError } = await supabase
      .from("interview_invitations")
      .select("*")
      .eq("interview_id", id)
      .order("created_at", { ascending: false });
    
    logger.debug("Invitations data:", invitationsData);
    logger.debug("Invitations error:", invitationsError);

    // Fetch sender profiles for invitations that have sent_by
    let invitationsWithSenders = invitationsData || [];
    if (invitationsData && invitationsData.length > 0) {
      const senderIds = [...new Set(invitationsData.map(inv => inv.sent_by).filter(Boolean))];
      
      if (senderIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", senderIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        invitationsWithSenders = invitationsData.map(inv => ({
          ...inv,
          sender_profile: inv.sent_by ? profilesMap.get(inv.sent_by) || null : null
        }));
      }
    }

    logger.debug("Attempts data:", attemptsData);
    logger.debug("Attempts error:", attemptsError);
    
    // Debug each attempt's assessment
    attemptsData?.forEach((attempt: any, idx: number) => {
      logger.debug(`Attempt ${idx}:`, {
        id: attempt.id,
        status: attempt.status,
        assessments: attempt.assessments,
        assessmentsType: Array.isArray(attempt.assessments) ? 'array' : typeof attempt.assessments
      });
    });

    setInterview(interviewData);
    setQuestions(questionsData || []);
    setAttempts(attemptsData || []);
    setInvitations(invitationsWithSenders);
    setLoading(false);
  };

  const copyInvitationLink = (token: string) => {
    // Use readable URL format with org and interview slugs
    const orgSlug = interview?.organization?.slug;
    const interviewSlug = interview?.slug;
    const shareLink = orgSlug && interviewSlug
      ? `${window.location.origin}/i/${orgSlug}/${interviewSlug}/${token}`
      : `${window.location.origin}/take-interview/${token}`;
    navigator.clipboard.writeText(shareLink);
    toast({
      title: "Link Copied!",
      description: "Invitation link copied to clipboard",
    });
  };

  const handleInvitationSuccess = () => {
    fetchInterviewDetails();
    updateProgress("shared_interview", true);
  };

  const copyShareLink = () => {
    // Use readable URL format with org and interview slugs
    const orgSlug = interview?.organization?.slug;
    const interviewSlug = interview?.slug;
    const link = orgSlug && interviewSlug
      ? `${window.location.origin}/i/${orgSlug}/${interviewSlug}/${interview.share_link}`
      : `${window.location.origin}/take-interview/${interview.share_link}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied!",
      description: link,
      duration: 5000,
    });
  };

  const archiveInterview = async () => {
    const { error } = await supabase
      .from("interviews")
      .update({ status: 'archived' })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to archive interview",
        variant: "destructive",
      });
    } else {
      // Send notification about status change if interview has team members
      if (interview?.organization_id) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.rpc('create_notification', {
              p_user_id: interview.creator_id,
              p_organization_id: interview.organization_id,
              p_type: 'interview_status',
              p_title: 'Interview Status Update',
              p_message: `Interview "${interview.title}" has been archived`,
              p_link: `${basePath}/interview/${id}`,
              p_metadata: { interviewId: id, status: 'archived' }
            });
          }
        } catch (notifError) {
          logger.error('Failed to send status notification:', notifError);
        }
      }
      
      fetchInterviewDetails();
      toast({
        title: "Success",
        description: "Interview archived",
      });
    }
  };

  const reactivateInterview = async () => {
    try {
      // Reactivate archived interview back to active (not draft) since questions are already approved
      const { error } = await supabase
        .from("interviews")
        .update({ status: "active" })
        .eq("id", id);

      if (error) throw error;

      // Send notification about status change
      if (interview?.organization_id) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.rpc('create_notification', {
              p_user_id: interview.creator_id,
              p_organization_id: interview.organization_id,
              p_type: 'interview_status',
              p_title: 'Interview Status Update',
              p_message: `Interview "${interview.title}" has been reactivated`,
              p_link: `${basePath}/interview/${id}`,
              p_metadata: { interviewId: id, status: 'active' }
            });
          }
        } catch (notifError) {
          logger.error('Failed to send status notification:', notifError);
        }
      }

      toast({
        title: "Success",
        description: "Interview reactivated! You can now send invitations.",
      });

      fetchInterviewDetails();
    } catch (error: any) {
      logger.error("Error reactivating interview:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reactivate interview",
        variant: "destructive",
      });
    }
  };

  const regenerateQuestions = async () => {
    try {
      setLoading(true);
      
      const { error } = await invokeFunction('regenerate-questions', {
        body: { interviewId: id }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Question generation restarted. This may take a few minutes.",
      });

      // Start auto-refresh
      fetchInterviewDetails();
    } catch (error: any) {
      logger.error("Error regenerating questions:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate questions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteInterview = async () => {
    setDeleting(true);
    try {
      const { error } = await invokeFunction('delete-interview', {
        body: { interviewId: id }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Interview and all related data deleted successfully",
      });
      
      // Navigate after successful deletion - don't update state after navigation
      navigate("/partner/recruiting/interviews", { replace: true });
      return; // Exit early to prevent state update after unmount
    } catch (error: any) {
      logger.error('Error deleting interview:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete interview",
        variant: "destructive",
      });
      setDeleting(false); // Only reset on error
    }
  };

  const deleteAttempt = async (attemptId: string, candidateName: string) => {
    if (!confirm(`Are you sure you want to delete the attempt by ${candidateName}? This will also delete any associated assessment.`)) {
      return;
    }

    const { error } = await supabase
      .from("interview_attempts")
      .delete()
      .eq("id", attemptId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete attempt",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Attempt deleted successfully",
      });
      fetchInterviewDetails();
    }
  };

  const evaluateAttempt = async (attemptId: string) => {
    toast({
      title: "Starting Evaluation",
      description: "AI is analyzing the responses (this may take 1-2 minutes)...",
    });

    const { data, error } = await invokeFunction('evaluate-interview', {
      body: { attemptId }
    });

    if (error) {
      // Check if it's an "already in progress" error
      const isInProgress = error.message?.includes('already in progress') || 
                          (data as any)?.inProgress;
      toast({
        title: isInProgress ? "Evaluation In Progress" : "Error",
        description: isInProgress 
          ? "An evaluation is already running. Please wait for it to complete."
          : (error.message || "Failed to evaluate interview"),
        variant: isInProgress ? "default" : "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Interview evaluated successfully",
      });
      fetchInterviewDetails();
    }
  };

  const reEvaluateAttempt = async (attemptId: string) => {
    setReEvaluatingId(attemptId);
    
    try {
      // Step 1: Run video analysis first to capture new violations from recording
      toast({
        title: "Analyzing Recording",
        description: "Running AI analysis on proctoring video...",
      });
      
      const { error: analysisError } = await invokeFunction('analyze-proctoring-video', {
        body: { attemptId }
      });
      
      if (analysisError) {
        logger.warn('Video analysis warning:', analysisError);
        // Continue with evaluation even if video analysis fails
      }
      
      // Step 2: Re-evaluate with updated integrity data
      toast({
        title: "Re-evaluating",
        description: "Calculating scores with updated integrity data (this may take 1-2 minutes)...",
      });
      
      const { data, error } = await invokeFunction('evaluate-interview', {
        body: { attemptId }
      });

      if (error) {
        // Check if it's an "already in progress" error
        const isInProgress = error.message?.includes('already in progress') || 
                            (data as any)?.inProgress;
        if (isInProgress) {
          toast({
            title: "Evaluation In Progress",
            description: "An evaluation is already running. Please wait for it to complete.",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Re-evaluated with AI video analysis",
      });
      fetchInterviewDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to re-evaluate interview",
        variant: "destructive",
      });
    } finally {
      setReEvaluatingId(null);
    }
  };


  const handleRegenerateSingleQuestion = async (questionId: string, feedback?: string) => {
    setRegeneratingQuestionId(questionId);
    
    // Set a timeout to reset regenerating state if it takes too long
    const timeoutId = setTimeout(() => {
      setRegeneratingQuestionId(null);
      toast({
        title: "Regeneration Timeout",
        description: "The regeneration is taking longer than expected. Please check and try again.",
        variant: "destructive",
      });
    }, 30000); // 30 second timeout
    
    try {
      const { error } = await invokeFunction('regenerate-single-question', {
        body: {
          questionId,
          interviewId: id,
          feedback,
        },
      });

      clearTimeout(timeoutId);
      
      if (error) throw error;

      toast({
        title: "Success",
        description: feedback 
          ? "Question regenerated with your feedback" 
          : "Question regenerated successfully",
      });
      fetchInterviewDetails();
    } catch (error: any) {
      clearTimeout(timeoutId);
      logger.error('Error regenerating question:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate question",
        variant: "destructive",
      });
    } finally {
      setRegeneratingQuestionId(null);
    }
  };

  const markAsDraft = async () => {
    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from('interviews')
        .update({ status: 'draft' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Interview marked as draft. You can now edit questions.",
      });
      fetchInterviewDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark as draft",
        variant: "destructive",
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const activateInterview = async () => {
    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from('interviews')
        .update({ status: 'active' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Interview activated! You can now send invitations.",
      });
      fetchInterviewDetails();
      updateProgress("shared_interview", true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to activate interview",
        variant: "destructive",
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  // Note: deactivateInterview removed - once activated, interviews cannot go back to draft
  // If changes are needed, archive the interview and create a new one

  // Save edited title
  const saveTitle = async () => {
    if (!editedTitle.trim() || editedTitle.trim() === interview.title) {
      setIsEditingTitle(false);
      return;
    }
    
    setSavingTitle(true);
    try {
      const { error } = await supabase
        .from('interviews')
        .update({ title: editedTitle.trim() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Job title updated successfully",
      });
      fetchInterviewDetails();
      setIsEditingTitle(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update title",
        variant: "destructive",
      });
    } finally {
      setSavingTitle(false);
    }
  };

  const startEditingTitle = () => {
    setEditedTitle(interview.title);
    setIsEditingTitle(true);
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle("");
  };

  const fetchTechSpocs = async () => {
    if (!interview?.organization_id) return;
    
    // Query user_roles directly with organization_id to match RLS policy
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'tech_spoc')
      .eq('organization_id', interview.organization_id);

    if (rolesError) {
      logger.error('Error fetching tech spoc roles:', rolesError);
      setTechSpocs([]);
      return;
    }

    const techSpocIds = rolesData?.map(r => r.user_id) || [];
    if (techSpocIds.length === 0) {
      setTechSpocs([]);
      return;
    }

    // Fetch profiles for tech SPOCs
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', techSpocIds);

    if (profilesError) {
      logger.error('Error fetching tech spoc profiles:', profilesError);
      setTechSpocs([]);
      return;
    }

    const techSpocList = profilesData?.map(p => ({
      id: p.id,
      full_name: p.full_name || 'Unknown',
      email: p.email || ''
    })) || [];

    setTechSpocs(techSpocList);
  };

  const handleSendForReview = async () => {
    if (!selectedTechSpoc) {
      toast({
        title: "Select Reviewer",
        description: "Please select a Tech SPOC to review the questions",
        variant: "destructive",
      });
      return;
    }

    setSendingForReview(true);
    try {
      const { error } = await invokeFunction('send-review-request', {
        body: { interviewId: id, techSpocId: selectedTechSpoc },
      });

      if (error) throw error;

      toast({
        title: "Review Request Sent",
        description: "Tech SPOC has been notified to review the questions",
      });
      setSendForReviewOpen(false);
      setSelectedTechSpoc("");
      fetchInterviewDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send review request",
        variant: "destructive",
      });
    } finally {
      setSendingForReview(false);
    }
  };

  const handleApproveQuestions = async () => {
    setApprovingQuestions(true);
    try {
      const { error } = await invokeFunction('approve-questions', {
        body: { interviewId: id, action: 'approve' },
      });

      if (error) throw error;

      toast({
        title: "Questions Approved",
        description: "You can now send invitations to candidates",
      });
      fetchInterviewDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve questions",
        variant: "destructive",
      });
    } finally {
      setApprovingQuestions(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success text-success-foreground";
      case "draft": return "bg-warning text-warning-foreground";
      case "archived": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getQuestionsStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'pending_review':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30"><Loader2 className="w-3 h-3 mr-1" /> Pending Review</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-700 border-gray-500/30">Draft</Badge>;
    }
  };

  const getHiringDecisionColor = (decision: string) => {
    return getHiringDecisionInfo(decision).color;
  };

  const getHiringDecisionLabel = (decision: string) => {
    return getHiringDecisionInfo(decision).label;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-6 px-2 sm:px-3 md:px-4 lg:px-6 box-border overflow-x-hidden">
        <div className="grid gap-4 sm:gap-6">
          {/* Header Card */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="min-w-0">
                <div className="space-y-2">
                  {isEditingTitle ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="text-lg sm:text-xl font-semibold h-9 w-full sm:w-auto sm:min-w-[200px] sm:max-w-[400px]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTitle();
                          if (e.key === 'Escape') cancelEditingTitle();
                        }}
                        disabled={savingTitle}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={saveTitle}
                          disabled={savingTitle}
                          className="h-8 w-8"
                        >
                          {savingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-success" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={cancelEditingTitle}
                          disabled={savingTitle}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 group min-w-0">
                      <CardTitle className="text-xl sm:text-2xl break-words hyphens-auto leading-tight flex-1 min-w-0">{interview.title}</CardTitle>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={startEditingTitle}
                        className="h-7 w-7 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getStatusColor(interview.status)}>
                      {interview.status}
                    </Badge>
                    {interview.generation_status === 'completed' && questions.length > 0 && (
                      getQuestionsStatusBadge(interview.questions_status || 'draft')
                    )}
                  </div>
                </div>
                <CardDescription className="mt-3 line-clamp-3 sm:line-clamp-2 break-words text-sm">
                  {interview.job_description.substring(0, 200)}...
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {/* Generation Status Alert */}
              {interview.generation_status === 'generating' && (
                <div className="mb-4 p-3 sm:p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0 mt-0.5 sm:mt-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-blue-500 text-sm sm:text-base">Generating Questions...</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          AI is creating your question bank. Questions: {questions.length}/{interview.question_bank_size || interview.question_count || 0}
                        </p>
                      </div>
                    </div>
                    <Button onClick={regenerateQuestions} disabled={loading} variant="outline" size="sm" className="w-full sm:w-auto">
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      <span className="truncate">Cancel & Regenerate</span>
                    </Button>
                  </div>
                </div>
              )}

              {interview.generation_status === 'failed' && (
                <div className="mb-4 p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <Brain className="h-5 w-5 text-destructive shrink-0 mt-0.5 sm:mt-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-destructive text-sm sm:text-base">Generation Failed</p>
                        <p className="text-xs sm:text-sm text-muted-foreground break-words">
                          {interview.generation_error || 'Question generation encountered an error.'}
                        </p>
                      </div>
                    </div>
                    <Button onClick={regenerateQuestions} disabled={loading} variant="outline" size="sm" className="w-full sm:w-auto">
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {/* Needs Changes Alert - Tech SPOC requested changes */}
              {interview.questions_status === 'needs_changes' && (
                <div className="mb-4 p-3 sm:p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-amber-600 dark:text-amber-400 text-sm sm:text-base">Changes Requested</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {interview.review_feedback || 'Tech SPOC has requested changes to the questions.'}
                        </p>
                        {interview.last_reviewed_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Reviewed {new Date(interview.last_reviewed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-8">
                      <Button 
                        onClick={() => navigate(`${basePath}/create-interview?id=${id}&reconfigure=true`)} 
                        variant="outline" 
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reconfigure & Regenerate
                      </Button>
                      <Button 
                        onClick={() => navigate(`${basePath}/interview/${id}/preview`)} 
                        variant="outline" 
                        size="sm"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Questions Directly
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div className="p-2 sm:p-4 bg-primary/5 rounded-lg">
                  <p className="text-xs sm:text-sm text-muted-foreground">Questions</p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {questions.length}
                    {(interview.question_bank_size || interview.question_count) && questions.length < (interview.question_bank_size || interview.question_count) && (
                      <span className="text-xs sm:text-base text-muted-foreground"> / {interview.question_bank_size || interview.question_count}</span>
                    )}
                  </p>
                  {interview.generation_status === 'generating' && (
                    <p className="text-[10px] sm:text-xs text-blue-500 mt-1">Generating...</p>
                  )}
                  {interview.generation_status === 'failed' && (
                    <p className="text-[10px] sm:text-xs text-destructive mt-1">Failed</p>
                  )}
                  {interview.generation_status === 'completed' && questions.length === 0 && (
                    <p className="text-[10px] sm:text-xs text-amber-500 mt-1">No questions</p>
                  )}
                </div>
                <div className="p-2 sm:p-4 bg-accent/5 rounded-lg">
                  <p className="text-xs sm:text-sm text-muted-foreground">Attempts</p>
                  <p className="text-lg sm:text-2xl font-bold">{attempts.length}</p>
                </div>
                <div className="p-2 sm:p-4 bg-success/5 rounded-lg">
                  <p className="text-xs sm:text-sm text-muted-foreground">Evaluated</p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {attempts.filter(a => a.status === 'evaluated').length}
                  </p>
                </div>
              </div>

              {/* Workflow info banner for active interviews */}
              {interview.status === 'active' && (
                <div className="mb-4 p-2 sm:p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2 sm:gap-3">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Interview is active.</span> Questions are locked. Archive to make changes.
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 sm:gap-3">
                {/* Status-based action buttons */}
                {interview.status === 'failed' && (
                  <Button onClick={markAsDraft} variant="outline" disabled={statusUpdating}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Mark as Draft
                  </Button>
                )}
                
                {interview.status === 'draft' && questions.length > 0 && interview.generation_status === 'completed' && interview.questions_status === 'approved' && (
                  <Button onClick={activateInterview} disabled={statusUpdating} className="bg-gradient-to-r from-primary to-accent">
                    <Play className="w-4 h-4 mr-2" />
                    Activate Interview
                  </Button>
                )}
                
                {interview.status === 'draft' && questions.length > 0 && interview.generation_status === 'completed' && interview.questions_status !== 'approved' && (
                  <Button disabled variant="outline" className="cursor-not-allowed opacity-50">
                    <Play className="w-4 h-4 mr-2" />
                    Activate (Approve Questions First)
                  </Button>
                )}
                
                {interview.status === 'draft' && interview.generation_status !== 'completed' && (
                  <Button disabled variant="outline" className="cursor-not-allowed opacity-50">
                    <Play className="w-4 h-4 mr-2" />
                    Activate (waiting for questions...)
                  </Button>
                )}
                
                {interview.status === 'active' && (
                  <>
                    {interview.questions_status === 'approved' ? (
                      <Button onClick={() => setInvitationDialogOpen(true)}>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Invitations
                      </Button>
                    ) : (
                      <Button disabled variant="outline" className="cursor-not-allowed opacity-50">
                        <Mail className="w-4 h-4 mr-2" />
                        Send Invitations (Approve Questions First)
                      </Button>
                    )}
                    <Button onClick={archiveInterview} variant="outline">
                      <Archive className="w-4 h-4 mr-2" />
                      Archive
                    </Button>
                  </>
                )}

                {/* Review Workflow Buttons - Show when questions are ready but not yet approved */}
                {interview.generation_status === 'completed' && questions.length > 0 && interview.questions_status !== 'approved' && (
                  <>
                    <Button 
                      onClick={() => {
                        fetchTechSpocs();
                        setSendForReviewOpen(true);
                      }} 
                      variant="outline"
                      disabled={interview.questions_status === 'pending_review'}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {interview.questions_status === 'pending_review' ? 'Pending Review' : 'Send for Review'}
                    </Button>
                    <Button 
                      onClick={handleApproveQuestions} 
                      disabled={approvingQuestions}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {approvingQuestions ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Approve Questions
                    </Button>
                  </>
                )}
                
                {interview.status === 'archived' && (
                  <Button onClick={reactivateInterview} variant="outline">
                    <Play className="w-4 h-4 mr-2" />
                    Reactivate
                  </Button>
                )}

                {interview.generation_status === 'failed' && (
                  <Button onClick={regenerateQuestions} disabled={loading} variant="default">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Regenerate Questions
                  </Button>
                )}

                <Button onClick={() => navigate(`${basePath}/interview/${id}/preview`)} variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Questions
                </Button>

                <Button 
                  onClick={() => setSampleModalOpen(true)} 
                  variant="outline"
                  disabled={questions.length === 0}
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  Sample Interview
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={deleting}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deleting ? 'Deleting...' : 'Delete Interview'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Interview & All Data</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this interview, all {questions.length} questions in the bank, and all {attempts.length} candidate attempts with their assessments and proctoring data. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteInterview} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Configuration Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Interview Configuration</CardTitle>
              <CardDescription>Review the interview settings before activation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Settings */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Question Bank Size</p>
                  <p className="text-lg font-semibold">{interview.question_bank_size || 100} questions</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Questions Per Interview</p>
                  <p className="text-lg font-semibold">{interview.question_count || 10} questions</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Time Limit</p>
                  <p className="text-lg font-semibold">{interview.time_limit ? `${interview.time_limit} minutes` : 'No limit'}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Proctoring</p>
                  <p className="text-lg font-semibold">{interview.proctoring_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>

              {/* Skill Domain */}
              {interview.skill_domain && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Skill Domain</p>
                  <Badge variant="secondary" className="capitalize">{interview.skill_domain.replace('_', ' ')}</Badge>
                </div>
              )}

              {/* Per-Category Difficulty Distribution */}
              {interview.category_difficulty_distribution && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Per-Category Difficulty Distribution</p>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(interview.category_difficulty_distribution as Record<string, { easy: number; medium: number; hard: number }>).map(([category, difficulty]) => (
                      <div key={category} className="p-3 border rounded-lg">
                        <p className="text-sm font-medium mb-2 capitalize">{category}</p>
                        <div className="flex flex-wrap gap-1 text-xs">
                          <Badge variant="outline" className="border-green-500 text-green-600">Easy: {difficulty.easy}%</Badge>
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">Med: {difficulty.medium}%</Badge>
                          <Badge variant="outline" className="border-red-500 text-red-600">Hard: {difficulty.hard}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy Overall Difficulty Distribution (for older interviews) */}
              {!interview.category_difficulty_distribution && interview.difficulty_distribution && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Difficulty Distribution</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(interview.difficulty_distribution as Record<string, number>).map(([level, percentage]) => (
                      <Badge 
                        key={level} 
                        variant="outline" 
                        className={`capitalize ${
                          level === 'easy' ? 'border-green-500 text-green-600' : 
                          level === 'medium' ? 'border-yellow-500 text-yellow-600' : 
                          'border-red-500 text-red-600'
                        }`}
                      >
                        {level}: {percentage}%
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Topic Distribution */}
              {interview.topic_distribution && Object.keys(interview.topic_distribution as Record<string, number>).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Topic Distribution ({Object.keys(interview.topic_distribution as Record<string, number>).length} topics)</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {Object.entries(interview.topic_distribution as Record<string, number>).map(([topic, percentage]) => (
                      <Badge key={topic} variant="outline">
                        {topic}: {percentage}%
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Proctoring Settings Summary */}
              {interview.proctoring_enabled && interview.proctoring_settings && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Proctoring Settings</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {Object.entries(interview.proctoring_settings as Record<string, any>)
                      .filter(([_, value]) => value !== undefined && value !== null)
                      .map(([key, value]) => {
                        // Format key from camelCase to readable text
                        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
                        // Format value based on type
                        const formattedValue = typeof value === 'boolean' 
                          ? (value ? 'Enabled' : 'Disabled')
                          : typeof value === 'number' && key.toLowerCase().includes('score')
                            ? `${value}%`
                            : String(value);
                        return (
                          <Badge key={key} variant="outline">
                            {formattedKey}: {formattedValue}
                          </Badge>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Collapsible Job Description */}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className="h-4 w-4" />
                  View Job Description
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="bg-muted/30 p-4 rounded-md mt-2">
                    <MarkdownContent content={interview.job_description} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>


          {/* Invitations Section - Always show for active interviews */}
          {interview.status === 'active' && (
            <Collapsible open={invitationsOpen} onOpenChange={setInvitationsOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Send className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Invitations ({invitations.length})</CardTitle>
                          <CardDescription>
                            Manage candidate invitations
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${invitationsOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <InvitationList 
                      invitations={invitations} 
                      interviewId={id!}
                      orgSlug={interview?.organization?.slug}
                      interviewSlug={interview?.slug}
                      onRefresh={fetchInterviewDetails}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Attempts Section */}
          <Collapsible open={attemptsOpen} onOpenChange={setAttemptsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <Users className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Candidate Attempts ({attempts.length})</CardTitle>
                        <CardDescription>
                          View all candidates who have taken this interview
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${attemptsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {attempts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No attempts yet</p>
                  ) : (
                    <>
                      {/* Filters */}
                      <AttemptFilters
                        filters={attemptFilters}
                        onFiltersChange={setAttemptFilters}
                        statusOptions={statusOptions}
                        decisionOptions={decisionOptions}
                      />
                      
                      {filteredAttempts.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No attempts match your filters</p>
                      ) : (
                        <>
                          {/* Mobile card view */}
                          <div className="md:hidden space-y-3">
                            {filteredAttempts.map((attempt) => (
                          <Card key={attempt.id} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{attempt.candidate_name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{attempt.candidate_email}</p>
                                </div>
                                <Badge variant={attempt.status === 'evaluated' ? 'default' : 'secondary'} className="text-xs shrink-0">
                                  {attempt.status}
                                </Badge>
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                {attempt.assessments?.overall_score && (
                                  <Badge variant="outline" className="text-xs">
                                    Score: {attempt.assessments.overall_score}%
                                  </Badge>
                                )}
                                {attempt.proctoring_sessions?.[0] && (() => {
                                  const ps = attempt.proctoring_sessions[0];
                                  const ignoredViolations: string[] = Array.isArray(ps.ignored_violations) 
                                    ? (ps.ignored_violations as string[]) 
                                    : [];
                                  const detailedViolations = ps.detailed_violations || [];
                                  let computedScore = 100;
                                  
                                  if (Array.isArray(detailedViolations) && detailedViolations.length > 0) {
                                    for (const v of detailedViolations) {
                                      const violationType = (v as any).type || '';
                                      if (ignoredViolations.includes(violationType)) continue;
                                      const severity = (v as any).severity || 'low';
                                      if (severity === 'high') computedScore -= 15;
                                      else if (severity === 'medium') computedScore -= 8;
                                      else computedScore -= 3;
                                    }
                                    computedScore = Math.max(0, computedScore);
                                  } else {
                                    computedScore = Math.max(0, 100 - 
                                      (ps.tab_switch_count || 0) * 5 - 
                                      (ps.multiple_person_detections || 0) * 15 - 
                                      (ps.look_away_count || 0) * 3 - 
                                      (ps.multiple_voice_detections || 0) * 10);
                                  }
                                  
                                  const score = (ignoredViolations.length === 0 && ps.integrity_score != null && ps.integrity_score > 0 && ps.integrity_score < 100) 
                                    ? ps.integrity_score 
                                    : computedScore;
                                  
                                  return (
                                    <Badge variant={score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive'} className="text-xs">
                                      Integrity: {score}/100
                                    </Badge>
                                  );
                                })()}
                                {/* Use CPI hiring_recommendation as source of truth, fallback to assessments */}
                                {(() => {
                                  const cpi = Array.isArray(attempt.candidate_performance_index) ? attempt.candidate_performance_index[0] : attempt.candidate_performance_index;
                                  const decision = cpi?.hiring_recommendation || attempt.assessments?.hiring_decision;
                                  if (!decision) return null;
                                  return (
                                    <Badge className={`${getHiringDecisionColor(decision)} text-xs`}>
                                      {getHiringDecisionLabel(decision)}
                                    </Badge>
                                  );
                                })()}
                              </div>
                              
                              <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(attempt.created_at).toLocaleDateString()}
                                </span>
                                <div className="flex gap-1.5">
                                  {attempt.status === 'evaluated' && attempt.assessments?.id && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate(`${basePath}/assessment/${attempt.assessments.id}`)}
                                        className="h-8 px-2 text-xs"
                                      >
                                        <FileText className="w-3 h-3" />
                                      </Button>
                                      {attempt.proctoring_sessions?.[0] && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setSelectedProctoringSession(attempt.proctoring_sessions[0]);
                                            setRecordingsDialogOpen(true);
                                          }}
                                          className="h-8 px-2 text-xs"
                                        >
                                          <Video className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                  {attempt.status === 'submitted' && !attempt.assessments && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => evaluateAttempt(attempt.id)}
                                      className="h-8 px-2 text-xs"
                                    >
                                      <Brain className="w-3 h-3 mr-1" />
                                      Eval
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteAttempt(attempt.id, attempt.candidate_name)}
                                    className="h-8 px-2 text-xs"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

          {/* Desktop table view */}
                      <div className="hidden md:block border rounded-lg overflow-x-auto">
                        <div className="max-h-[500px] overflow-y-auto">
                            <Table className="w-full table-fixed">
                            <TableHeader className="sticky top-0 bg-background z-10">
                              <TableRow>
                                <TableHead className="w-[14%] min-w-[120px]">Candidate</TableHead>
                                <TableHead className="w-[18%] min-w-[150px]">Email</TableHead>
                                <TableHead className="w-[12%] min-w-[90px]">Status</TableHead>
                                <TableHead className="w-[8%] min-w-[50px]">Score</TableHead>
                                <TableHead className="w-[10%] min-w-[70px]">Integrity</TableHead>
                                <TableHead className="w-[10%] min-w-[70px]">Decision</TableHead>
                                <TableHead className="w-[10%] min-w-[80px]">Date</TableHead>
                                <TableHead className="w-[18%] min-w-[130px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredAttempts.map((attempt) => (
                                <TableRow key={attempt.id}>
                                  <TableCell className="font-medium">
                                    <span className="block truncate" title={attempt.candidate_name}>{attempt.candidate_name}</span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="block truncate text-muted-foreground" title={attempt.candidate_email}>{attempt.candidate_email}</span>
                                  </TableCell>
                                  <TableCell>
                                    {(() => {
                                      const ps = attempt.proctoring_sessions?.[0];
                                      const uploadStatus = ps?.upload_status || 'pending';
                                      
                                      // Show upload issues in status column for non-completed uploads
                                      if (ps && uploadStatus === 'failed') {
                                        return (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Badge variant="destructive" className="text-xs cursor-help">
                                                  upload_failed
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent className="max-w-xs">
                                                <p className="font-semibold">Upload Failed</p>
                                                <p className="text-xs">{ps.upload_error || 'Candidate may have closed browser'}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      } else if (ps && uploadStatus === 'uploading') {
                                        return (
                                          <Badge variant="secondary" className="text-xs">
                                            <Upload className="w-3 h-3 mr-1 animate-pulse" />
                                            uploading
                                          </Badge>
                                        );
                                      } else if (ps && uploadStatus === 'pending' && attempt.status === 'submitted') {
                                        return (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Badge variant="outline" className="text-xs cursor-help text-amber-600 border-amber-400">
                                                  upload_pending
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent className="max-w-xs">
                                                <p className="font-semibold">Upload Pending</p>
                                                <p className="text-xs">Recordings queued but not started yet.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      } else {
                                        // Normal status display
                                        return (
                                          <Badge variant={attempt.status === 'evaluated' ? 'default' : 'secondary'} className="text-xs whitespace-nowrap">
                                            {attempt.status === 'pending_upload' ? 'pending' : attempt.status}
                                          </Badge>
                                        );
                                      }
                                    })()}
                                  </TableCell>
                                  <TableCell>
                                    {attempt.assessments?.overall_score 
                                      ? `${attempt.assessments.overall_score}%`
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {attempt.proctoring_sessions?.[0] ? (() => {
                                      const ps = attempt.proctoring_sessions[0];
                                      
                                      const ignoredViolations: string[] = Array.isArray(ps.ignored_violations) 
                                        ? (ps.ignored_violations as string[]) 
                                        : [];
                                      
                                      const detailedViolations = ps.detailed_violations || [];
                                      let computedScore = 100;
                                      
                                      if (Array.isArray(detailedViolations) && detailedViolations.length > 0) {
                                        for (const v of detailedViolations) {
                                          const violationType = (v as any).type || '';
                                          if (ignoredViolations.includes(violationType)) continue;
                                          
                                          const severity = (v as any).severity || 'low';
                                          if (severity === 'high') computedScore -= 15;
                                          else if (severity === 'medium') computedScore -= 8;
                                          else computedScore -= 3;
                                        }
                                        computedScore = Math.max(0, computedScore);
                                      } else {
                                        computedScore = Math.max(0, 100 - 
                                          (ps.tab_switch_count || 0) * 5 - 
                                          (ps.multiple_person_detections || 0) * 15 - 
                                          (ps.look_away_count || 0) * 3 - 
                                          (ps.multiple_voice_detections || 0) * 10);
                                      }
                                      
                                      const score = (ignoredViolations.length === 0 && ps.integrity_score != null && ps.integrity_score > 0 && ps.integrity_score < 100) 
                                        ? ps.integrity_score 
                                        : computedScore;
                                      
                                      return (
                                        <div className="flex items-center gap-1">
                                          <Badge variant={score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive'} className="text-xs">
                                            {score}/100
                                          </Badge>
                                          {ps.flagged_for_review && <Shield className="w-3 h-3 text-warning" />}
                                        </div>
                                      );
                                    })() : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {/* Use CPI hiring_recommendation as source of truth, fallback to assessments */}
                                    {(() => {
                                      const cpi = Array.isArray(attempt.candidate_performance_index) ? attempt.candidate_performance_index[0] : attempt.candidate_performance_index;
                                      const decision = cpi?.hiring_recommendation || attempt.assessments?.hiring_decision;
                                      if (!decision) return null;
                                      return (
                                        <Badge className={`${getHiringDecisionColor(decision)} text-xs`}>
                                          {getHiringDecisionLabel(decision)}
                                        </Badge>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-sm">{new Date(attempt.created_at).toLocaleDateString()}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {attempt.status === 'evaluated' && attempt.assessments?.id ? (
                                        <>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={() => {
                                              logger.debug("Navigating to assessment:", attempt.assessments.id);
                                              navigate(`${basePath}/assessment/${attempt.assessments.id}`);
                                            }}
                                            className="h-7 w-7"
                                            title="View Report"
                                          >
                                            <FileText className="w-3.5 h-3.5" />
                                          </Button>
                                          {attempt.proctoring_sessions?.[0] && (
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              onClick={() => {
                                                setSelectedProctoringSession(attempt.proctoring_sessions[0]);
                                                setRecordingsDialogOpen(true);
                                              }}
                                              className="h-7 w-7"
                                              title="View Recordings"
                                            >
                                              <Video className="w-3.5 h-3.5" />
                                            </Button>
                                          )}
                                          <Button
                                            size="icon"
                                            variant="secondary"
                                            onClick={() => reEvaluateAttempt(attempt.id)}
                                            disabled={reEvaluatingId === attempt.id}
                                            className="h-7 w-7"
                                            title="Re-evaluate"
                                          >
                                            {reEvaluatingId === attempt.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <RefreshCw className="w-3.5 h-3.5" />
                                            )}
                                          </Button>
                                        </>
                                      ) : null}
                                      {attempt.status === 'submitted' && attempt.proctoring_sessions?.[0] && !attempt.assessments?.id && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          className="cursor-wait h-7 px-2 text-xs"
                                        >
                                          <Brain className="w-3 h-3 mr-1 animate-pulse" />
                                          Evaluating...
                                        </Button>
                                      )}
                                      {attempt.status === 'pending_upload' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          className="cursor-wait h-7 px-2 text-xs"
                                        >
                                          <Upload className="w-3 h-3 mr-1 animate-pulse" />
                                          Uploading...
                                        </Button>
                                      )}
                                      {attempt.status === 'submitted' && !attempt.assessments && (
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => evaluateAttempt(attempt.id)}
                                          className="h-7 px-2 text-xs"
                                        >
                                          <Brain className="w-3 h-3 mr-1" />
                                          Evaluate
                                        </Button>
                                      )}
                                      {!attempt.assessments && attempt.status === 'evaluated' && !attempt.proctoring_sessions?.[0] && (
                                        <span className="text-xs text-muted-foreground">No report</span>
                                      )}
                                      <Button
                                        size="icon"
                                        variant="destructive"
                                        onClick={() => deleteAttempt(attempt.id, attempt.candidate_name)}
                                        className="h-7 w-7"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>


        </div>


        <InvitationDialog
          interviewId={id!}
          open={invitationDialogOpen}
          onOpenChange={setInvitationDialogOpen}
          onSuccess={handleInvitationSuccess}
        />

        {/* Recordings Dialog */}
        <Dialog open={recordingsDialogOpen} onOpenChange={setRecordingsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Proctoring Recordings</DialogTitle>
              <DialogDescription>
                View candidate video and screen recordings from this assessment
              </DialogDescription>
            </DialogHeader>
            {selectedProctoringSession && (
              <AttemptVideoPlayer proctoringSession={selectedProctoringSession} />
            )}
          </DialogContent>
        </Dialog>

        {/* Send for Review Dialog */}
        <Dialog open={sendForReviewOpen} onOpenChange={setSendForReviewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Questions for Review</DialogTitle>
              <DialogDescription>
                Select a Tech SPOC to review the interview questions before sending invitations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Tech SPOC Reviewer</Label>
                {techSpocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Tech SPOCs found in your organization. You can approve questions yourself instead.
                  </p>
                ) : (
                  <Select value={selectedTechSpoc} onValueChange={setSelectedTechSpoc}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Tech SPOC..." />
                    </SelectTrigger>
                    <SelectContent>
                      {techSpocs.map((spoc) => (
                        <SelectItem key={spoc.id} value={spoc.id}>
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4" />
                            <span>{spoc.full_name}</span>
                            <span className="text-muted-foreground">({spoc.email})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSendForReviewOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendForReview} 
                  disabled={!selectedTechSpoc || sendingForReview}
                >
                  {sendingForReview ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send for Review
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sample Interview Modal */}
        <SampleInterviewModal
          open={sampleModalOpen}
          onOpenChange={setSampleModalOpen}
          interviewId={id || ''}
          questionCount={interview?.question_count || 10}
          questionBankSize={interview?.question_bank_size || questions.length}
          questionTypeDistribution={interview?.question_type_distribution}
          difficultyDistribution={interview?.difficulty_distribution}
          timeLimit={interview?.time_limit || 60}
          onConfigSaved={fetchInterviewDetails}
          isApproved={interview?.questions_status === 'approved'}
        />
      </div>
  );
};

export default InterviewDetail;