import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Play, AlertTriangle, Clock, Eye, CheckCircle, XCircle, Flag, Video } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LiveStreamViewer from "./LiveStreamViewer";

interface ProctoringSessionModalProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate?: () => void;
}

export default function ProctoringSessionModal({
  sessionId,
  open,
  onOpenChange,
  onStatusUpdate
}: ProctoringSessionModalProps) {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [screenUrl, setScreenUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (sessionId && open) {
      fetchSessionDetails();
    }
  }, [sessionId, open]);

  const fetchSessionDetails = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('proctoring_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      setSession(data);
      setReviewNotes(data.reviewer_notes || "");

      // Get signed URLs for video playback
      if (data.video_recording_url) {
        const { data: videoData } = await supabase.storage
          .from('proctoring-recordings')
          .createSignedUrl(data.video_recording_url, 3600);
        if (videoData) setVideoUrl(videoData.signedUrl);
      }

      if (data.screen_recording_url) {
        const { data: screenData } = await supabase.storage
          .from('proctoring-recordings')
          .createSignedUrl(data.screen_recording_url, 3600);
        if (screenData) setScreenUrl(screenData.signedUrl);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeViolations = async () => {
    if (!sessionId) return;
    
    setAnalyzing(true);
    try {
      const { data, error } = await invokeFunction('analyze-violations', {
        body: { sessionId }
      });

      if (error) throw error;

      setAnalysis(data.analysis);
      toast({
        title: "Analysis Complete",
        description: "AI has analyzed the violation patterns",
      });
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const updateReviewStatus = async (status: 'approved' | 'rejected' | 'flagged') => {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('proctoring_sessions')
        .update({
          review_status: status,
          reviewer_notes: reviewNotes,
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Session marked as ${status}`,
      });

      onStatusUpdate?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'tab_switch': return '🔀';
      case 'multiple_persons': return '👥';
      case 'multiple_voices': return '🔊';
      case 'look_away': return '👀';
      case 'copy_attempt': return '📋';
      default: return '⚠️';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-yellow-500';
      case 'medium': return 'text-orange-500';
      case 'high': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <div className="flex items-center justify-center p-8">
            Loading session details...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!session) return null;

  const violations = session.violations || [];
  const detailedViolations = session.detailed_violations || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Proctoring Session Review
            <Badge variant={session.flagged_for_review ? "destructive" : "secondary"}>
              {session.review_status || 'pending'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Session ID: {sessionId}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="live" disabled={!!session.ended_at}>
              <Video className="w-4 h-4 mr-1" />
              Live
              {session.live_stream_active && !session.ended_at && (
                <span className="ml-1 relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="violations">Violations</TabsTrigger>
            <TabsTrigger value="recordings">Recordings</TabsTrigger>
            <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="py-4">
            {session.ended_at ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Video className="w-12 h-12 mb-4 opacity-50" />
                <p>Interview has ended. Live streaming is not available.</p>
                <p className="text-sm mt-2">Check the Recordings tab to review the session.</p>
              </div>
            ) : (
              <div className="flex justify-center">
                <LiveStreamViewer 
                  sessionId={sessionId!}
                  candidateName={session.interview_attempts?.candidate_name}
                  candidateEmail={session.interview_attempts?.candidate_email}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Integrity Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{session.integrity_score || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tab Switches</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{session.tab_switch_count || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Multiple Persons</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{session.multiple_person_detections || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Copy Attempts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{session.copy_attempt_count || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Reviewer Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add your review notes here..."
                  rows={4}
                />
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={() => updateReviewStatus('approved')} className="flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button onClick={() => updateReviewStatus('rejected')} variant="destructive" className="flex-1">
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button onClick={() => updateReviewStatus('flagged')} variant="outline" className="flex-1">
                <Flag className="w-4 h-4 mr-2" />
                Flag for Review
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="violations">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {violations.length === 0 && detailedViolations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No violations recorded</p>
                ) : (
                  <>
                    {[...violations, ...detailedViolations].map((violation: any, index: number) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{getViolationIcon(violation.type)}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold capitalize">{violation.type.replace('_', ' ')}</span>
                                <Badge className={getSeverityColor(violation.severity)}>
                                  {violation.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{violation.details}</p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(violation.timestamp)}
                                {violation.videoTimestamp && (
                                  <span className="ml-2">Video: {violation.videoTimestamp}s</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recordings" className="space-y-4">
            {videoUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Camera Recording
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <video 
                    src={videoUrl} 
                    controls 
                    className="w-full rounded-lg"
                  />
                </CardContent>
              </Card>
            )}

            {screenUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Screen Recording
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <video 
                    src={screenUrl} 
                    controls 
                    className="w-full rounded-lg"
                  />
                </CardContent>
              </Card>
            )}

            {!videoUrl && !screenUrl && (
              <p className="text-center text-muted-foreground py-8">No recordings available</p>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            {!analysis ? (
              <div className="text-center py-8">
                <Button onClick={analyzeViolations} disabled={analyzing}>
                  {analyzing ? 'Analyzing...' : 'Run AI Analysis'}
                </Button>
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Risk Score:</span>
                      <span className="text-2xl font-bold">{analysis.riskScore}/100</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Risk Level:</span>
                      <Badge variant={analysis.riskLevel === 'high' || analysis.riskLevel === 'critical' ? 'destructive' : 'secondary'}>
                        {analysis.riskLevel}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Behavioral Patterns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.patterns.map((pattern: string, index: number) => (
                        <li key={index} className="text-sm">{pattern}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="text-sm">{rec}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{analysis.summary}</p>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}