import React, { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, AlertTriangle, CheckCircle2, Video, Monitor, Eye,
  Smartphone, Keyboard, Headphones, Copy, Users, Volume2
} from 'lucide-react';
import { format } from 'date-fns';

// Violation type configuration for icons and labels
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

interface ProctoringReportProps {
  sessionId: string;
}

const ProctoringReport: React.FC<ProctoringReportProps> = ({ sessionId }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [screenUrl, setScreenUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const { data, error } = await supabase
        .from('proctoring_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      setSession(data);

      // Get signed URLs for recordings
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
    } catch (error) {
      logger.error('Error fetching proctoring session:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Proctoring session not found</AlertDescription>
      </Alert>
    );
  }

  // Get ignored violations list
  const ignoredViolations: string[] = session.ignored_violations || [];
  
  // Filter out ignored violations and deduplicate by type
  const allViolations = session.violations || [];
  const seenTypes = new Set<string>();
  const violations = allViolations.filter((v: any) => {
    // Skip if this violation type is ignored
    if (ignoredViolations.includes(v.type)) {
      return false;
    }
    // Deduplicate by type - keep only first occurrence
    if (seenTypes.has(v.type)) {
      return false;
    }
    seenTypes.add(v.type);
    return true;
  });

  // Calculate total violations from actual database counts (not just violations array)
  const totalViolationCount = 
    (session.tab_switch_count || 0) +
    (session.multiple_person_detections || 0) +
    (session.look_away_count || 0) +
    (session.copy_attempt_count || 0) +
    (session.multiple_voice_detections || 0);

  // Derive integrity score: 100 if no violations, otherwise deduct based on violation counts
  const hasStoredScore = session.integrity_score != null && session.integrity_score > 0;
  const computedScore = totalViolationCount === 0
    ? 100
    : Math.max(0, 100 - 
        (session.tab_switch_count || 0) * 5 -
        (session.multiple_person_detections || 0) * 15 -
        (session.look_away_count || 0) * 3 -
        (session.copy_attempt_count || 0) * 10 -
        (session.multiple_voice_detections || 0) * 10
      );
  const integrityScore = hasStoredScore ? session.integrity_score : computedScore;
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    return <Badge variant="destructive">Flagged</Badge>;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Integrity Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Proctoring Report
              </CardTitle>
              <CardDescription>
                Session ID: {sessionId.slice(0, 8)}...
              </CardDescription>
            </div>
            {getScoreBadge(integrityScore)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getScoreColor(integrityScore)}`}>
                {integrityScore.toFixed(0)}
              </div>
              <p className="text-muted-foreground mt-2">Integrity Score</p>
            </div>
          </div>

          {session.flagged_for_review && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This session has been flagged for manual review due to multiple violations.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Violation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Violation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Multiple Persons"
              value={session.multiple_person_detections || 0}
              icon={Users}
            />
            <StatCard
              label="Multiple Voices"
              value={session.multiple_voice_detections || 0}
              icon={Volume2}
            />
            <StatCard
              label="Tab Switches"
              value={session.tab_switch_count || 0}
              icon={Monitor}
            />
            <StatCard
              label="Look Away"
              value={session.look_away_count || 0}
              icon={Eye}
            />
            <StatCard
              label="Phone/Objects"
              value={violations.filter((v: any) => ['phone_detected', 'prohibited_object'].includes(v.type)).length}
              icon={Smartphone}
            />
            <StatCard
              label="Screenshot Attempts"
              value={violations.filter((v: any) => v.type === 'print_screen').length}
              icon={Copy}
            />
            <StatCard
              label="VM/Multi-Monitor"
              value={violations.filter((v: any) => ['virtual_machine', 'multiple_monitors'].includes(v.type)).length}
              icon={Monitor}
            />
            <StatCard
              label="Suspicious Behavior"
              value={violations.filter((v: any) => ['suspicious_typing', 'audio_playback'].includes(v.type)).length}
              icon={Keyboard}
            />
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Violations</span>
              <Badge variant={totalViolationCount > 5 ? "destructive" : totalViolationCount > 0 ? "default" : "secondary"}>
                {totalViolationCount}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Violations */}
      {violations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Violations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {violations.map((violation: any, index: number) => {
                const IconComponent = VIOLATION_ICONS[violation.type] || AlertTriangle;
                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg border"
                  >
                    <IconComponent className={`h-5 w-5 mt-0.5 ${getSeverityColor(violation.severity)}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {violation.type.replace(/_/g, ' ')}
                        </span>
                        <Badge variant="outline" className={getSeverityColor(violation.severity)}>
                          {violation.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {violation.details}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {violation.videoTimestamp !== undefined && violation.videoTimestamp > 0 ? (
                          <span className="text-primary font-medium">
                            At video time: {Math.floor(violation.videoTimestamp / 60)}:{String(violation.videoTimestamp % 60).padStart(2, '0')}
                          </span>
                        ) : (
                          <span>{format(new Date(violation.timestamp), 'PPpp')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recordings */}
      <Card>
        <CardHeader>
          <CardTitle>Recordings</CardTitle>
          <CardDescription>
            Access to candidate video and screen recordings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {videoUrl && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Video className="h-4 w-4" />
                Video Recording
              </h4>
              <video controls className="w-full rounded-lg border">
                <source src={videoUrl} type="video/webm" />
              </video>
            </div>
          )}

          {screenUrl && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Screen Recording
              </h4>
              <video controls className="w-full rounded-lg border">
                <source src={screenUrl} type="video/webm" />
              </video>
            </div>
          )}

          {!videoUrl && !screenUrl && (
            <p className="text-muted-foreground text-center py-4">
              No recordings available
            </p>
          )}
        </CardContent>
      </Card>

      {/* System Checks */}
      <Card>
        <CardHeader>
          <CardTitle>System Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <CheckStatus label="Camera" passed={session.camera_check_passed} />
            <CheckStatus label="Microphone" passed={session.microphone_check_passed} />
            <CheckStatus label="Screen Share" passed={session.screen_share_check_passed} />
            <CheckStatus label="Lighting" passed={session.lighting_check_passed} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ label, value, icon: Icon }) => (
  <div className="p-4 rounded-lg border bg-card">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <div className="text-2xl font-bold">{value}</div>
  </div>
);

const CheckStatus: React.FC<{ label: string; passed: boolean }> = ({ label, passed }) => (
  <div className="flex items-center justify-between p-2 rounded border">
    <span className="text-sm">{label}</span>
    {passed ? (
      <CheckCircle2 className="h-5 w-5 text-green-600" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-destructive" />
    )}
  </div>
);

export default ProctoringReport;
