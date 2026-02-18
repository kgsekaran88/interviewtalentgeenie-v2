import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProctoringSessionModal from "@/components/proctoring/ProctoringSessionModal";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { 
  Video, 
  AlertTriangle, 
  Eye, 
  Flag, 
  CheckCircle2, 
  XCircle,
  Clock,
  User,
  Activity,
  PlayCircle,
  Smartphone,
  Monitor,
  Keyboard,
  Headphones,
  Copy,
  Shield,
  Users,
  Volume2,
  RefreshCw,
  Upload
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { logger } from '@/lib/logger';
import { getStuckUploads, fixAllStuckUploads } from '@/lib/uploadTimeoutHandler';

// Violation type icons for real-time display
const VIOLATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  multiple_persons: Users,
  multiple_voices: Volume2,
  tab_switch: Monitor,
  look_away: Eye,
  eye_movement: Eye,
  phone_detected: Smartphone,
  prohibited_object: Shield,
  multiple_monitors: Monitor,
  print_screen: Copy,
  virtual_machine: Monitor,
  suspicious_typing: Keyboard,
  audio_playback: Headphones,
  silence_anomaly: Volume2,
  copy_attempt: Copy,
};

const getViolationIcon = (type: string) => {
  return VIOLATION_ICONS[type] || AlertTriangle;
};

interface ProctoringSession {
  id: string;
  interview_attempt_id?: string;
  created_at?: string;
  ended_at?: string;
  violations: any[] | any;
  integrity_score?: number;
  status?: string;
  review_status?: string;
  flagged_for_review?: boolean;
  live_stream_active?: boolean;
  interview_attempts?: {
    candidate_name: string;
    candidate_email: string;
    interview?: {
      title: string;
    };
  };
}

const ProctoringDashboard = () => {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [activeSessions, setActiveSessions] = useState<ProctoringSession[]>([]);
  const [recentSessions, setRecentSessions] = useState<ProctoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ProctoringSession | null>(null);
  const [filter, setFilter] = useState<'all' | 'needs_review' | 'approved' | 'upload_incomplete'>('all');
  const [stuckUploadsCount, setStuckUploadsCount] = useState(0);
  const [fixingUploads, setFixingUploads] = useState(false);

  useEffect(() => {
    fetchSessions();
    
    // Set up realtime subscription for active sessions
    const channel = supabase
      .channel('proctoring-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proctoring_sessions'
        },
        (payload) => {
          logger.proctoring('Proctoring session update:', payload);
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSessions = async () => {
    try {
      // Fetch active interview proctoring sessions only (not learning assessments)
      // Only show sessions from the last 24 hours as truly "active"
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: activeData, error: activeError } = await supabase
        .from('proctoring_sessions')
        .select(`
          *,
          interview_attempts (
            candidate_name,
            candidate_email,
            interview:interviews (title)
          )
        `)
        .not('interview_attempt_id', 'is', null)
        .is('ended_at', null)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;

      // Fetch recent completed interview proctoring sessions only
      const { data: recentData, error: recentError } = await supabase
        .from('proctoring_sessions')
        .select(`
          *,
          interview_attempts (
            candidate_name,
            candidate_email,
            interview:interviews (title)
          )
        `)
        .not('interview_attempt_id', 'is', null)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(20);

      if (recentError) throw recentError;

      setActiveSessions(activeData as any || []);
      setRecentSessions(recentData as any || []);
      
      // Check for stuck uploads
      const stuckUploads = await getStuckUploads();
      setStuckUploadsCount(stuckUploads.length);
    } catch (error: any) {
      logger.error('Error fetching sessions:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load proctoring sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleFixStuckUploads = async () => {
    setFixingUploads(true);
    try {
      const fixedCount = await fixAllStuckUploads();
      if (fixedCount > 0) {
        successToast(`Fixed ${fixedCount} stuck upload(s)`, 'These sessions have been marked as failed so they no longer appear as pending.');
        setStuckUploadsCount(0);
        fetchSessions(); // Refresh the list
      } else {
        toast({
          title: "No stuck uploads",
          description: "All uploads are processing normally.",
        });
      }
    } catch (error: any) {
      errorToast('Failed to fix uploads', error.message);
    } finally {
      setFixingUploads(false);
    }
  };

  const handleRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const updatedSession = newRecord as ProctoringSession;
      
      // Update active sessions
      if (!updatedSession.ended_at) {
        setActiveSessions(prev => {
          const exists = prev.find(s => s.id === updatedSession.id);
          if (exists) {
            return prev.map(s => s.id === updatedSession.id ? updatedSession : s);
          }
          return [updatedSession, ...prev];
        });

                        // Show toast for new violations
        if (updatedSession.violations && Array.isArray(updatedSession.violations) && updatedSession.violations.length > 0) {
          const latestViolation = updatedSession.violations[updatedSession.violations.length - 1];
          toast({
            title: "New Violation Detected",
            description: `${latestViolation.type}: ${latestViolation.details}`,
            variant: "destructive",
          });
        }
      } else {
        // Move to recent if ended
        setActiveSessions(prev => prev.filter(s => s.id !== updatedSession.id));
        setRecentSessions(prev => [updatedSession, ...prev].slice(0, 20));
      }
    } else if (eventType === 'DELETE') {
      setActiveSessions(prev => prev.filter(s => s.id !== oldRecord.id));
      setRecentSessions(prev => prev.filter(s => s.id !== oldRecord.id));
    }
  };

  const flagSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('proctoring_sessions')
        .update({ flagged_for_review: true })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session Flagged",
        description: "This session has been marked for review",
      });

      fetchSessions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to flag session",
        variant: "destructive",
      });
    }
  };

  const closeSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('proctoring_sessions')
        .update({ 
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session Closed",
        description: "Proctoring session has been manually closed",
      });

      fetchSessions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to close session",
        variant: "destructive",
      });
    }
  };

  const approveSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('proctoring_sessions')
        .update({ 
          flagged_for_review: false,
          review_status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      successToast("Session approved and marked as done");
      fetchSessions();
    } catch (error: any) {
      errorToast("Failed to approve session", error.message);
    }
  };

  // Filter sessions based on current filter
  const filteredRecentSessions = recentSessions.filter(session => {
    if (filter === 'needs_review') {
      return session.flagged_for_review === true && session.review_status !== 'upload_incomplete';
    }
    if (filter === 'approved') {
      return session.review_status === 'approved';
    }
    if (filter === 'upload_incomplete') {
      return session.review_status === 'upload_incomplete';
    }
    return true;
  });

  const needsReviewCount = recentSessions.filter(s => s.flagged_for_review === true && s.review_status !== 'upload_incomplete').length;
  const approvedCount = recentSessions.filter(s => s.review_status === 'approved').length;
  const uploadIncompleteCount = recentSessions.filter(s => s.review_status === 'upload_incomplete').length;

  const getViolationColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-muted-foreground';
    }
  };

  const formatVideoTimestamp = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSessionDuration = (startedAt?: string, endedAt?: string) => {
    if (!startedAt) return '0m';
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    return `${diffMinutes}m`;
  };

  const getCandidateName = (session: ProctoringSession) => {
    if (session.interview_attempts) {
      return session.interview_attempts.candidate_name;
    }
    return "Unknown Candidate";
  };

  const getAssessmentTitle = (session: ProctoringSession) => {
    if (session.interview_attempts?.interview) {
      return session.interview_attempts.interview.title;
    }
    return "Unknown Interview";
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading proctoring sessions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Proctoring Dashboard
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm md:text-base mt-1">
              Real-time monitoring of active assessments
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {stuckUploadsCount > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleFixStuckUploads}
                disabled={fixingUploads}
                className="w-full sm:w-auto min-h-[44px]"
              >
                {fixingUploads ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Fix {stuckUploadsCount} Stuck Upload{stuckUploadsCount > 1 ? 's' : ''}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => window.location.href = window.location.pathname.replace('/proctoring', '/proctoring-test')}
              className="w-full sm:w-auto min-h-[44px]"
            >
              <Shield className="h-4 w-4 mr-2" />
              Test Proctoring
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
          <Card className="border border-primary/20">
            <CardContent className="pt-4 md:pt-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold">{activeSessions.length}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-destructive/20">
            <CardContent className="pt-4 md:pt-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold">
                    {activeSessions.reduce((acc, s) => acc + (Array.isArray(s.violations) ? s.violations.length : 0), 0)}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">Violations</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-warning/20 col-span-2 lg:col-span-1">
            <CardContent className="pt-4 md:pt-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
                  <Flag className="w-5 h-5 md:w-6 md:h-6 text-warning" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold">
                    {[...activeSessions, ...recentSessions].filter(s => s.flagged_for_review).length}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">Flagged for Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Sessions */}
        <Card className="mb-6 md:mb-8">
          <CardHeader className="pb-3 md:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Video className="h-4 w-4 md:h-5 md:w-5" />
                  Active Proctored Sessions
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">Live monitoring of ongoing assessments</CardDescription>
              </div>
              {activeSessions.length > 0 && (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 self-start sm:self-auto">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                  {activeSessions.length} Live
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {activeSessions.length === 0 ? (
              <div className="text-center py-12">
                <Eye className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No active proctored sessions</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <Card key={session.id} className="border border-primary/10">
                    <CardContent className="pt-4 md:pt-6">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                              Live
                            </Badge>
                            <span className="font-semibold text-sm md:text-base truncate">{getCandidateName(session)}</span>
                            {session.flagged_for_review && (
                              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                                <Flag className="h-3 w-3 mr-1" />
                                Flagged
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-xs md:text-sm text-muted-foreground mb-3 truncate">
                            {getAssessmentTitle(session)}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground mb-3">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 md:h-4 md:w-4" />
                              {getSessionDuration(session.created_at)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4" />
                              {Array.isArray(session.violations) ? session.violations.length : 0} violations
                            </div>
                            {session.integrity_score !== undefined && (
                              <div className="flex items-center gap-1.5">
                                <Activity className="h-3 w-3 md:h-4 md:w-4" />
                                {session.integrity_score}%
                              </div>
                            )}
                          </div>

                          {/* Recent Violations */}
                          {session.violations && Array.isArray(session.violations) && session.violations.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Recent Violations:</p>
                              <ScrollArea className="h-24">
                                <div className="space-y-1">
                                  {session.violations.slice(-5).reverse().map((violation: any, idx: number) => {
                                    const videoTime = formatVideoTimestamp(violation.videoTimestamp);
                                    const systemTime = new Date(violation.timestamp).toLocaleTimeString();
                                    const ViolationIcon = getViolationIcon(violation.type);
                                    
                                    return (
                                      <Alert key={idx} className="py-2">
                                        <ViolationIcon className={`h-3 w-3 ${getViolationColor(violation.severity)}`} />
                                        <AlertDescription className="text-xs">
                                          <span className="font-medium">{violation.type.replace(/_/g, ' ')}</span>: {violation.details}
                                          <span className="text-muted-foreground ml-2 inline-flex items-center gap-1">
                                            {videoTime && (
                                              <>
                                                <PlayCircle className="h-3 w-3" />
                                                <span className="font-medium">at {videoTime}</span>
                                                <span className="mx-1">|</span>
                                              </>
                                            )}
                                            {systemTime}
                                          </span>
                                        </AlertDescription>
                                      </Alert>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-row md:flex-col gap-2">
                          {session.live_stream_active && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setSelectedSession(session)}
                              className="bg-green-600 hover:bg-green-700 text-white min-h-[36px] flex-1 md:flex-none"
                            >
                              <Video className="h-4 w-4 md:mr-2 animate-pulse" />
                              <span className="hidden md:inline">Watch Live</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSession(session)}
                            className="min-h-[36px] flex-1 md:flex-none"
                          >
                            <Eye className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">View</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => closeSession(session.id)}
                            className="text-orange-600 hover:text-orange-700 min-h-[36px] flex-1 md:flex-none"
                          >
                            <XCircle className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Close</span>
                          </Button>
                          {!session.flagged_for_review && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => flagSession(session.id)}
                              className="text-warning hover:text-warning min-h-[36px] flex-1 md:flex-none"
                            >
                              <Flag className="h-4 w-4 md:mr-2" />
                              <span className="hidden md:inline">Flag</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Completed Sessions */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                  Completed Sessions
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">Past 20 proctored assessments</CardDescription>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="w-full sm:w-auto">
                <TabsList className="grid w-full grid-cols-4 h-9">
                  <TabsTrigger value="all" className="text-xs">All ({recentSessions.length})</TabsTrigger>
                  <TabsTrigger value="needs_review" className="text-xs">
                    Review ({needsReviewCount})
                  </TabsTrigger>
                  <TabsTrigger value="upload_incomplete" className="text-xs text-orange-600">
                    Upload Issue ({uploadIncompleteCount})
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="text-xs">Approved ({approvedCount})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            {filteredRecentSessions.length === 0 ? (
              <div className="text-center py-6 md:py-8">
                <XCircle className="h-8 w-8 md:h-10 md:w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {filter === 'needs_review' ? 'No sessions need review' : 
                   filter === 'approved' ? 'No approved sessions' : 
                   filter === 'upload_incomplete' ? 'No sessions with upload issues' : 'No completed sessions'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {filteredRecentSessions.map((session) => (
                  <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-3 md:p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{getCandidateName(session)}</span>
                        {session.flagged_for_review && (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                            <Flag className="h-3 w-3 mr-1" />
                            Review
                          </Badge>
                        )}
                        {session.status === 'approved' && (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {session.review_status === 'upload_incomplete' && (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Upload Incomplete
                          </Badge>
                        )}
                        {session.integrity_score !== undefined && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${session.integrity_score >= 70 
                              ? "bg-success/10 text-success border-success/20" 
                              : "bg-destructive/10 text-destructive border-destructive/20"
                            }`}
                          >
                            {session.integrity_score}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{getAssessmentTitle(session)}</p>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-2 md:gap-3 text-xs text-muted-foreground">
                      <span>{Array.isArray(session.violations) ? session.violations.length : 0} violations</span>
                      <span className="hidden sm:inline">{getSessionDuration(session.created_at, session.ended_at)}</span>
                      {session.flagged_for_review && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveSession(session.id)}
                          className="min-h-[36px] text-success hover:text-success hover:bg-success/10"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedSession(session)}
                        className="min-h-[36px]"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Detail Modal */}
        <ProctoringSessionModal
          sessionId={selectedSession?.id || null}
          open={!!selectedSession}
          onOpenChange={(open) => {
            if (!open) setSelectedSession(null);
          }}
          onStatusUpdate={fetchSessions}
        />
      </div>
  );
};

export default ProctoringDashboard;