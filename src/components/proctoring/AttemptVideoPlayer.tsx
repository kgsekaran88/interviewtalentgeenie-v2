import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Play, AlertTriangle, Users, Volume2, Eye, Monitor as MonitorIcon, Download, SkipBack, SkipForward, FastForward, Rewind, Wrench, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface AttemptVideoPlayerProps {
  proctoringSession: any;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 6, 8, 10];
const SKIP_SECONDS = 10;

const AttemptVideoPlayer = ({ proctoringSession }: AttemptVideoPlayerProps) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [screenUrl, setScreenUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [screenDuration, setScreenDuration] = useState<number>(0);
  const [videoSpeed, setVideoSpeed] = useState<number>(1);
  const [screenSpeed, setScreenSpeed] = useState<number>(1);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState<'video' | 'screen' | null>(null);
  const [preloading, setPreloading] = useState<'video' | 'screen' | null>(null);
  const [preloadProgress, setPreloadProgress] = useState<number>(0);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [screenBlobUrl, setScreenBlobUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

  const handleSpeedChange = (speed: number, isScreen: boolean) => {
    const videoElement = isScreen ? screenRef.current : videoRef.current;
    if (videoElement) {
      videoElement.playbackRate = speed;
      if (isScreen) {
        setScreenSpeed(speed);
      } else {
        setVideoSpeed(speed);
      }
    }
  };

  const skipTime = (seconds: number, isScreen: boolean) => {
    const videoElement = isScreen ? screenRef.current : videoRef.current;
    if (videoElement) {
      videoElement.currentTime = Math.max(0, Math.min(videoElement.duration, videoElement.currentTime + seconds));
    }
  };

  const jumpToEnd = (isScreen: boolean) => {
    const videoElement = isScreen ? screenRef.current : videoRef.current;
    if (videoElement) {
      // Jump to last 30 seconds of the video
      videoElement.currentTime = Math.max(0, videoElement.duration - 30);
      videoElement.play();
      toast.info("Jumped to last 30 seconds");
    }
  };

  const jumpToStart = (isScreen: boolean) => {
    const videoElement = isScreen ? screenRef.current : videoRef.current;
    if (videoElement) {
      videoElement.currentTime = 0;
      videoElement.play();
    }
  };

  useEffect(() => {
    loadVideos();
  }, [proctoringSession]);

  const loadVideos = async () => {
    setLoading(true);
    setVideoError(null);
    setScreenError(null);

    // Get signed URLs for video recordings
    if (proctoringSession?.video_recording_url) {
      const { data, error } = await supabase.storage
        .from('proctoring-recordings')
        .createSignedUrl(proctoringSession.video_recording_url, 3600); // 1 hour expiry

      if (data) {
        setVideoUrl(data.signedUrl);
      } else if (error) {
        setVideoError(`Failed to load video: ${error.message}`);
      }
    }

    if (proctoringSession?.screen_recording_url) {
      const { data, error } = await supabase.storage
        .from('proctoring-recordings')
        .createSignedUrl(proctoringSession.screen_recording_url, 3600);

      if (data) {
        setScreenUrl(data.signedUrl);
      } else if (error) {
        setScreenError(`Failed to load screen recording: ${error.message}`);
      }
    }

    setLoading(false);
  };

  const handleVideoError = (isScreen: boolean) => {
    const errorMsg = "Video failed to load. The file may be corrupted or have missing metadata. Try the Repair option.";
    if (isScreen) {
      setScreenError(errorMsg);
    } else {
      setVideoError(errorMsg);
    }
  };

  const repairVideo = async (recordingType: 'video' | 'screen') => {
    setRepairing(recordingType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to repair videos");
        return;
      }

      const response = await supabase.functions.invoke('repair-webm-metadata', {
        body: {
          sessionId: proctoringSession.id,
          recordingType
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      
      if (result.success) {
        toast.success(result.message);
        if (result.repairedPath) {
          // Reload videos to get the repaired version
          await loadVideos();
        }
      } else {
        toast.info(result.message);
        if (result.analysis) {
          logger.info('WebM Analysis:', result.analysis);
        }
      }
    } catch (error) {
      logger.error('Repair failed:', error);
      toast.error(`Repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRepairing(null);
    }
  };

  // Pre-load video into memory to bypass streaming issues
  const preloadVideo = async (type: 'video' | 'screen') => {
    const url = type === 'video' ? videoUrl : screenUrl;
    if (!url) return;

    setPreloading(type);
    setPreloadProgress(0);

    try {
      toast.info(`Loading ${type} into memory... This may take a moment for large files.`);
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch video');
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
      
      const chunks: BlobPart[] = [];
      let received = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value.buffer);
        received += value.length;
        
        if (total > 0) {
          setPreloadProgress(Math.round((received / total) * 100));
        }
      }
      
      // Combine chunks into a single blob
      const blob = new Blob(chunks, { type: 'video/webm' });
      const blobUrl = URL.createObjectURL(blob);
      
      if (type === 'video') {
        // Revoke old blob URL if exists
        if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
        setVideoBlobUrl(blobUrl);
        setVideoError(null);
      } else {
        if (screenBlobUrl) URL.revokeObjectURL(screenBlobUrl);
        setScreenBlobUrl(blobUrl);
        setScreenError(null);
      }
      
      const sizeMB = (received / 1024 / 1024).toFixed(1);
      toast.success(`${type} loaded (${sizeMB} MB). Playback should now work.`);
      
    } catch (error) {
      logger.error('Preload failed:', error);
      toast.error(`Failed to load ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPreloading(null);
      setPreloadProgress(0);
    }
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
      if (screenBlobUrl) URL.revokeObjectURL(screenBlobUrl);
    };
  }, []);

  if (!proctoringSession) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No proctoring data available for this attempt
        </AlertDescription>
      </Alert>
    );
  }

  const violations = proctoringSession.detailed_violations || proctoringSession.violations || [];
  
  // Calculate integrity score from violation counts when stored score is 0/NULL
  const totalViolations = (proctoringSession.tab_switch_count || 0) + 
    (proctoringSession.multiple_person_detections || 0) + 
    (proctoringSession.look_away_count || 0) + 
    (proctoringSession.copy_attempt_count || 0) + 
    (proctoringSession.multiple_voice_detections || 0);
  const computedScore = totalViolations === 0 ? 100 : Math.max(0, 100 - 
    (proctoringSession.tab_switch_count || 0) * 5 - 
    (proctoringSession.multiple_person_detections || 0) * 15 - 
    (proctoringSession.look_away_count || 0) * 3 - 
    (proctoringSession.copy_attempt_count || 0) * 10 - 
    (proctoringSession.multiple_voice_detections || 0) * 10);
  const integrityScore = (proctoringSession.integrity_score != null && proctoringSession.integrity_score > 0) 
    ? proctoringSession.integrity_score 
    : computedScore;

  const downloadVideo = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(`Downloading ${filename}`);
    } catch (error) {
      logger.error('Download failed:', error);
      toast.error('Failed to download video');
    }
  };

  const seekToViolation = (violation: any, isScreen: boolean) => {
    const videoElement = isScreen ? screenRef.current : videoRef.current;
    if (!videoElement) return;

    // Use videoTimestamp if available (elapsed seconds from recording start)
    // Otherwise fall back to calculating from system timestamp
    let seekSeconds: number;
    if (violation.videoTimestamp !== undefined && violation.videoTimestamp > 0) {
      seekSeconds = violation.videoTimestamp;
    } else {
      const violationTime = new Date(violation.timestamp).getTime();
      const sessionStart = new Date(proctoringSession.created_at).getTime();
      seekSeconds = Math.max(0, (violationTime - sessionStart) / 1000);
    }

    videoElement.currentTime = seekSeconds;
    videoElement.play();
    const mins = Math.floor(seekSeconds / 60);
    const secs = Math.floor(seekSeconds % 60);
    toast.info(`Jumped to violation at ${mins}:${String(secs).padStart(2, '0')}`);
  };

  const getViolationMarkers = (duration: number) => {
    if (!duration || violations.length === 0) return [];

    const sessionStart = new Date(proctoringSession.created_at).getTime();
    
    return violations.map((violation: any, index: number) => {
      // Use videoTimestamp if available, otherwise calculate from system timestamp
      let timeOffset: number;
      if (violation.videoTimestamp !== undefined && violation.videoTimestamp > 0) {
        timeOffset = violation.videoTimestamp;
      } else {
        const violationTime = new Date(violation.timestamp).getTime();
        timeOffset = (violationTime - sessionStart) / 1000;
      }
      const position = (timeOffset / duration) * 100;

      return {
        id: index,
        position: Math.max(0, Math.min(100, position)),
        violation,
        timeOffset
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Video Recordings */}
      {(videoUrl || screenUrl) ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Session Recordings</CardTitle>
            <CardDescription>Review candidate video and screen recordings</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="video" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="video" disabled={!videoUrl}>
                  <Play className="w-4 h-4 mr-2" />
                  Candidate Video
                </TabsTrigger>
                <TabsTrigger value="screen" disabled={!screenUrl}>
                  <MonitorIcon className="w-4 h-4 mr-2" />
                  Screen Recording
                </TabsTrigger>
              </TabsList>
              
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {videoUrl && (
                <TabsContent value="video" className="space-y-4">
                  {videoError && !videoBlobUrl && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <span className="flex-1">{videoError}</span>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => preloadVideo('video')}
                            disabled={preloading === 'video'}
                          >
                            {preloading === 'video' ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {preloadProgress}%
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Load into Memory
                              </>
                            )}
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="relative">
                    <video
                      ref={videoRef}
                      controls
                      className="w-full aspect-video bg-black rounded-lg"
                      src={videoBlobUrl || videoUrl}
                      onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                      onError={() => !videoBlobUrl && handleVideoError(false)}
                    >
                      Your browser does not support video playback.
                    </video>
                    
                    {/* Timeline markers */}
                    {videoDuration > 0 && violations.length > 0 && (
                      <div className="absolute bottom-12 left-0 right-0 h-2 px-3">
                        {getViolationMarkers(videoDuration).map((marker) => {
                          const timeDisplay = marker.violation.videoTimestamp !== undefined && marker.violation.videoTimestamp > 0
                            ? `${Math.floor(marker.violation.videoTimestamp / 60)}:${String(marker.violation.videoTimestamp % 60).padStart(2, '0')}`
                            : new Date(marker.violation.timestamp).toLocaleTimeString();
                          return (
                          <button
                            key={marker.id}
                            className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 top-1/2 rounded-full bg-destructive hover:scale-150 transition-transform cursor-pointer border-2 border-background shadow-lg"
                            style={{ left: `${marker.position}%` }}
                            onClick={() => seekToViolation(marker.violation, false)}
                            title={`${marker.violation.type} - ${timeDisplay}`}
                          />
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Playback Controls */}
                  <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => jumpToStart(false)} title="Jump to start">
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skipTime(-SKIP_SECONDS, false)} title="Rewind 10s">
                        <Rewind className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skipTime(SKIP_SECONDS, false)} title="Forward 10s">
                        <FastForward className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => jumpToEnd(false)} title="Jump to last 30s">
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Speed:</span>
                      <Select value={String(videoSpeed)} onValueChange={(v) => handleSpeedChange(Number(v), false)}>
                        <SelectTrigger className="h-8 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLAYBACK_SPEEDS.map((speed) => (
                            <SelectItem key={speed} value={String(speed)}>
                              {speed}x
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => downloadVideo(videoUrl, `candidate-video-${proctoringSession.id}.webm`)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Candidate's camera recording during the assessment
                    {violations.length > 0 && " • Click red markers to jump to violations"}
                  </p>
                </TabsContent>
              )}

              {screenUrl && (
                <TabsContent value="screen" className="space-y-4">
                  {screenError && !screenBlobUrl && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <span className="flex-1">{screenError}</span>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => preloadVideo('screen')}
                            disabled={preloading === 'screen'}
                          >
                            {preloading === 'screen' ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {preloadProgress}%
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Load into Memory
                              </>
                            )}
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="relative">
                    <video
                      ref={screenRef}
                      controls
                      className="w-full aspect-video bg-black rounded-lg"
                      src={screenBlobUrl || screenUrl}
                      onLoadedMetadata={(e) => setScreenDuration(e.currentTarget.duration)}
                      onError={() => !screenBlobUrl && handleVideoError(true)}
                    >
                      Your browser does not support video playback.
                    </video>
                    
                    {/* Timeline markers */}
                    {screenDuration > 0 && violations.length > 0 && (
                      <div className="absolute bottom-12 left-0 right-0 h-2 px-3">
                        {getViolationMarkers(screenDuration).map((marker) => {
                          const timeDisplay = marker.violation.videoTimestamp !== undefined && marker.violation.videoTimestamp > 0
                            ? `${Math.floor(marker.violation.videoTimestamp / 60)}:${String(marker.violation.videoTimestamp % 60).padStart(2, '0')}`
                            : new Date(marker.violation.timestamp).toLocaleTimeString();
                          return (
                          <button
                            key={marker.id}
                            className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 top-1/2 rounded-full bg-destructive hover:scale-150 transition-transform cursor-pointer border-2 border-background shadow-lg"
                            style={{ left: `${marker.position}%` }}
                            onClick={() => seekToViolation(marker.violation, true)}
                            title={`${marker.violation.type} - ${timeDisplay}`}
                          />
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Playback Controls */}
                  <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => jumpToStart(true)} title="Jump to start">
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skipTime(-SKIP_SECONDS, true)} title="Rewind 10s">
                        <Rewind className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skipTime(SKIP_SECONDS, true)} title="Forward 10s">
                        <FastForward className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => jumpToEnd(true)} title="Jump to last 30s">
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Speed:</span>
                      <Select value={String(screenSpeed)} onValueChange={(v) => handleSpeedChange(Number(v), true)}>
                        <SelectTrigger className="h-8 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLAYBACK_SPEEDS.map((speed) => (
                            <SelectItem key={speed} value={String(speed)}>
                              {speed}x
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => downloadVideo(screenUrl, `screen-recording-${proctoringSession.id}.webm`)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Candidate's screen recording during the assessment
                    {violations.length > 0 && " • Click red markers to jump to violations"}
                  </p>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No session recordings available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttemptVideoPlayer;
