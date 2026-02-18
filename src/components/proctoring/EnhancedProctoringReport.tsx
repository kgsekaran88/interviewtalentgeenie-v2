import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, Video, Eye, Users, Volume2, Activity,
  Smartphone, Monitor, Camera, Keyboard, Headphones, Shield, Copy, Loader2, ImageIcon
} from 'lucide-react';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import VideoPlayerWithControls from './VideoPlayerWithControls';

interface Violation {
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
  videoTimestamp?: number;
  metadata?: any;
  screenshotUrl?: string;
  screenScreenshotUrl?: string;
}

const VIOLATION_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>, label: string, severity: 'low' | 'medium' | 'high' }> = {
  multiple_persons: { icon: Users, label: 'Multiple Persons', severity: 'high' },
  multiple_voices: { icon: Volume2, label: 'Multiple Voices', severity: 'high' },
  tab_switch: { icon: Monitor, label: 'Tab Switch', severity: 'medium' },
  look_away: { icon: Eye, label: 'Look Away', severity: 'low' },
  eye_movement: { icon: Eye, label: 'Eye Movement', severity: 'low' },
  phone_detected: { icon: Smartphone, label: 'Phone Detected', severity: 'high' },
  prohibited_object: { icon: Shield, label: 'Prohibited Object', severity: 'high' },
  multiple_monitors: { icon: Monitor, label: 'Multiple Monitors', severity: 'high' },
  print_screen: { icon: Copy, label: 'Screenshot Attempt', severity: 'high' },
  virtual_machine: { icon: Monitor, label: 'Virtual Machine', severity: 'high' },
  suspicious_typing: { icon: Keyboard, label: 'Suspicious Typing', severity: 'medium' },
  audio_playback: { icon: Headphones, label: 'Audio Playback', severity: 'medium' },
  silence_anomaly: { icon: Volume2, label: 'Silence Anomaly', severity: 'low' },
  copy_attempt: { icon: Copy, label: 'Copy Attempt', severity: 'medium' },
};

// Session data passed directly from parent
interface ProctoringSessionData {
  id: string;
  video_recording_url?: string;
  screen_recording_url?: string;
  integrity_score: number;
  flagged_for_review?: boolean;
  violations?: any;
  detailed_violations?: any;
  multiple_person_detections?: number;
  multiple_voice_detections?: number;
  tab_switch_count?: number;
  look_away_count?: number;
  periodic_screenshots?: string[];
  created_at: string;
  ended_at?: string;
  ignored_violations?: string[];
}

interface EnhancedProctoringReportProps {
  session: ProctoringSessionData;
}

// Violation card with screenshot thumbnail support
const ViolationCardWithScreenshot: React.FC<{
  violation: Violation;
  onClick: () => void;
  getViolationIcon: (type: string) => React.ReactNode;
  getSeverityColor: (severity: string) => string;
}> = ({ violation, onClick, getViolationIcon, getSeverityColor }) => {
  const [cameraScreenshotUrl, setCameraScreenshotUrl] = useState<string | null>(null);
  const [screenScreenshotUrl, setScreenScreenshotUrl] = useState<string | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);

  useEffect(() => {
    const loadScreenshots = async () => {
      setLoadingScreenshot(true);
      try {
        if (violation.screenshotUrl) {
          const { data } = await supabase.storage
            .from('proctoring-recordings')
            .createSignedUrl(violation.screenshotUrl, 3600);
          if (data?.signedUrl) {
            setCameraScreenshotUrl(data.signedUrl);
          }
        }
        
        if (violation.screenScreenshotUrl) {
          const { data } = await supabase.storage
            .from('proctoring-recordings')
            .createSignedUrl(violation.screenScreenshotUrl, 3600);
          if (data?.signedUrl) {
            setScreenScreenshotUrl(data.signedUrl);
          }
        }
      } catch (error) {
        logger.error('Failed to load screenshots:', error);
      } finally {
        setLoadingScreenshot(false);
      }
    };

    if (violation.screenshotUrl || violation.screenScreenshotUrl) {
      loadScreenshots();
    }
  }, [violation.screenshotUrl, violation.screenScreenshotUrl]);

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
    >
      <div className="flex-shrink-0 mt-0.5">
        {getViolationIcon(violation.type)}
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm capitalize">
            {VIOLATION_CONFIG[violation.type]?.label || violation.type.replace(/_/g, ' ')}
          </span>
          <Badge variant={getSeverityColor(violation.severity) as any} className="text-xs">
            {violation.severity}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {/* Handle timestamp: could be videoTimestamp, numeric timestamp (seconds), or ISO date string */}
            {violation.videoTimestamp !== undefined && violation.videoTimestamp > 0
              ? `${Math.floor(violation.videoTimestamp / 60)}:${String(Math.floor(violation.videoTimestamp % 60)).padStart(2, '0')} in video`
              : typeof violation.timestamp === 'number'
                ? `${Math.floor(violation.timestamp / 60)}:${String(Math.floor(violation.timestamp % 60)).padStart(2, '0')} in video`
                : new Date(violation.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{violation.details}</p>
        
        {/* Screenshot thumbnails */}
        {(cameraScreenshotUrl || screenScreenshotUrl) && (
          <div className="flex gap-2 mt-2">
            {cameraScreenshotUrl && (
              <div className="relative">
                <img 
                  src={cameraScreenshotUrl} 
                  alt="Camera screenshot" 
                  className="w-20 h-14 object-cover rounded border"
                />
                <Badge variant="secondary" className="absolute -top-1 -left-1 text-[10px] px-1">
                  <Camera className="h-2 w-2 mr-0.5" />
                  Cam
                </Badge>
              </div>
            )}
            {screenScreenshotUrl && (
              <div className="relative">
                <img 
                  src={screenScreenshotUrl} 
                  alt="Screen screenshot" 
                  className="w-20 h-14 object-cover rounded border"
                />
                <Badge variant="secondary" className="absolute -top-1 -left-1 text-[10px] px-1">
                  <Monitor className="h-2 w-2 mr-0.5" />
                  Screen
                </Badge>
              </div>
            )}
          </div>
        )}
        {loadingScreenshot && !cameraScreenshotUrl && !screenScreenshotUrl && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading screenshots...
          </div>
        )}
      </div>
    </div>
  );
};

// Thumbnails gallery component
const ThumbnailsGallery: React.FC<{ screenshots: string[] }> = ({ screenshots }) => {
  const [signedUrls, setSignedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const loadThumbnails = async () => {
      setLoading(true);
      const urls: string[] = [];
      
      for (const path of screenshots.slice(0, 20)) { // Limit to 20 thumbnails
        try {
          const { data } = await supabase.storage
            .from('proctoring-recordings')
            .createSignedUrl(path, 3600);
          if (data?.signedUrl) {
            urls.push(data.signedUrl);
          }
        } catch (error) {
          logger.error('Failed to load thumbnail:', path, error);
        }
      }
      
      setSignedUrls(urls);
      setLoading(false);
    };

    if (screenshots.length > 0) {
      loadThumbnails();
    } else {
      setLoading(false);
    }
  }, [screenshots]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading thumbnails...</span>
      </div>
    );
  }

  if (signedUrls.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No periodic screenshots captured
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {signedUrls.map((url, index) => (
          <div 
            key={index}
            className="relative aspect-video cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setSelectedImage(url)}
          >
            <img 
              src={url} 
              alt={`Screenshot ${index + 1}`}
              className="w-full h-full object-cover rounded border"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-0.5">
              #{index + 1}
            </div>
          </div>
        ))}
      </div>
      
      {/* Lightbox for selected image */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img 
            src={selectedImage} 
            alt="Enlarged screenshot"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <Button 
            variant="secondary" 
            className="absolute top-4 right-4"
            onClick={() => setSelectedImage(null)}
          >
            Close
          </Button>
        </div>
      )}
    </>
  );
};

const EnhancedProctoringReport: React.FC<EnhancedProctoringReportProps> = ({ session }) => {
  const { toast } = useUserFriendlyToast();
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [screenUrl, setScreenUrl] = useState<string | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(true);

  // Load signed URLs for recordings
  useEffect(() => {
    const loadRecordingUrls = async () => {
      setLoadingVideos(true);
      try {
        if (session.video_recording_url) {
          const { data } = await supabase.storage
            .from('proctoring-recordings')
            .createSignedUrl(session.video_recording_url, 3600);
          if (data?.signedUrl) {
            setVideoUrl(data.signedUrl);
          }
        }
        
        if (session.screen_recording_url) {
          const { data } = await supabase.storage
            .from('proctoring-recordings')
            .createSignedUrl(session.screen_recording_url, 3600);
          if (data?.signedUrl) {
            setScreenUrl(data.signedUrl);
          }
        }
      } catch (error) {
        logger.error('Failed to load recording URLs:', error);
      } finally {
        setLoadingVideos(false);
      }
    };

    loadRecordingUrls();
  }, [session.video_recording_url, session.screen_recording_url]);

  const handleViolationClick = (violation: Violation) => {
    setSelectedViolation(violation);
  };

  // PDF report generation removed - use Assessment Report's downloadPDFReport instead

  const getViolationIcon = (type: string) => {
    const config = VIOLATION_CONFIG[type];
    if (config) {
      const IconComponent = config.icon;
      return <IconComponent className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const extractConfidence = (details: string): number | null => {
    const match = details?.match(/\((\d+)%\s*confidence\)/i);
    return match ? parseInt(match[1], 10) : null;
  };

  const meetsConfidenceThreshold = (violation: Violation): boolean => {
    const objectDetectionTypes = ['prohibited_object', 'phone_detected', 'multiple_persons'];
    
    if (!objectDetectionTypes.includes(violation.type)) {
      return true;
    }
    
    const confidence = extractConfidence(violation.details);
    if (confidence === null) {
      return true;
    }
    
    return confidence >= 95;
  };

  const ignoredViolations = session.ignored_violations || [];
  const allViolations = session.detailed_violations || session.violations || [];
  
  // Filter violations: exclude ignored ones and those that don't meet confidence threshold
  const filteredViolations = (allViolations as Violation[]).filter(violation => {
    // Skip if this violation type is ignored
    if (ignoredViolations.includes(violation.type)) {
      return false;
    }
    // Apply confidence threshold filter
    return meetsConfidenceThreshold(violation);
  });
  
  // Deduplicate violations by type - keep only the first occurrence of each type
  // This prevents showing "nested_screen_sharing" 3 times when once is sufficient
  const seenTypes = new Set<string>();
  const violations = filteredViolations.filter(violation => {
    if (seenTypes.has(violation.type)) {
      return false; // Skip duplicate types
    }
    seenTypes.add(violation.type);
    return true;
  });
  
  const highSeverityCount = violations.filter(v => v.severity === 'high').length;
  const integrityScore = session.integrity_score ?? 100;
  const isFlagged = session.flagged_for_review || integrityScore < 70 || highSeverityCount > 0;

  const periodicScreenshots = session.periodic_screenshots || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Proctoring Integrity Report
              </CardTitle>
              <CardDescription className="mt-2">
                Session: {session.id.slice(0, 8)}... • 
                {' '}{new Date(session.created_at).toLocaleString()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-4xl font-bold">
                {integrityScore}
                <span className="text-lg text-muted-foreground">/100</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Integrity Score</p>
              {isFlagged && (
                <Badge variant="destructive" className="mt-2">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Flagged for Review
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted rounded p-2">
                <div className="font-semibold">{session.multiple_person_detections || 0}</div>
                <div className="text-xs text-muted-foreground">Multiple Persons</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="font-semibold">{session.multiple_voice_detections || 0}</div>
                <div className="text-xs text-muted-foreground">Multiple Voices</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="font-semibold">{session.tab_switch_count || 0}</div>
                <div className="text-xs text-muted-foreground">Tab Switches</div>
              </div>
              <div className="bg-muted rounded p-2">
                <div className="font-semibold">{session.look_away_count || 0}</div>
                <div className="text-xs text-muted-foreground">Look Away Events</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recordings, Thumbnails & Violations */}
      <Card>
        <CardHeader>
          <CardTitle>Session Recording & Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="video">
            <TabsList>
              <TabsTrigger value="video">
                <Video className="h-4 w-4 mr-2" />
                Screen Recording
              </TabsTrigger>
              <TabsTrigger value="camera">
                <Camera className="h-4 w-4 mr-2" />
                Camera Recording
              </TabsTrigger>
              <TabsTrigger value="thumbnails">
                <ImageIcon className="h-4 w-4 mr-2" />
                Thumbnails ({periodicScreenshots.length})
              </TabsTrigger>
              <TabsTrigger value="violations">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Violations ({violations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="video" className="space-y-4">
              {loadingVideos ? (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-muted-foreground">Loading recording...</span>
                </div>
              ) : screenUrl ? (
                <div className="space-y-4">
                  <VideoPlayerWithControls 
                    src={screenUrl}
                    initialTime={selectedViolation?.videoTimestamp}
                  />
                  
                  {selectedViolation && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-semibold mb-2">Selected Violation:</p>
                      <div className="flex items-center gap-2 text-sm">
                        {getViolationIcon(selectedViolation.type)}
                        <span className="capitalize">{selectedViolation.type.replace('_', ' ')}</span>
                        <Badge variant={getSeverityColor(selectedViolation.severity) as any}>
                          {selectedViolation.severity}
                        </Badge>
                        <span className="text-muted-foreground">
                          {selectedViolation.videoTimestamp !== undefined && selectedViolation.videoTimestamp > 0
                            ? `at ${Math.floor(selectedViolation.videoTimestamp / 60)}:${String(Math.floor(selectedViolation.videoTimestamp % 60)).padStart(2, '0')} in video`
                            : typeof selectedViolation.timestamp === 'number'
                              ? `at ${Math.floor(selectedViolation.timestamp / 60)}:${String(Math.floor(selectedViolation.timestamp % 60)).padStart(2, '0')} in video`
                              : `at ${new Date(selectedViolation.timestamp).toLocaleTimeString()}`}
                        </span>
                      </div>
                      <p className="text-sm mt-2">{selectedViolation.details}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <p className="text-muted-foreground">No screen recording available</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="camera" className="space-y-4">
              {loadingVideos ? (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-muted-foreground">Loading recording...</span>
                </div>
              ) : videoUrl ? (
                <VideoPlayerWithControls 
                  src={videoUrl}
                  initialTime={selectedViolation?.videoTimestamp}
                />
              ) : (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <p className="text-muted-foreground">No camera recording available</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="thumbnails">
              <ThumbnailsGallery screenshots={periodicScreenshots} />
            </TabsContent>

            <TabsContent value="violations">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {violations.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    No violations detected
                  </div>
                ) : (
                  violations.map((violation, index) => (
                    <ViolationCardWithScreenshot
                      key={index}
                      violation={violation}
                      onClick={() => handleViolationClick(violation)}
                      getViolationIcon={getViolationIcon}
                      getSeverityColor={getSeverityColor}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedProctoringReport;
