import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { logger } from '@/lib/logger';
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, FileText, TrendingUp, TrendingDown, CheckCircle, XCircle, Shield, AlertTriangle, Eye, Monitor, Video, RefreshCw, ExternalLink, Copy, Camera, EyeOff, Pencil, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { useOnboarding } from "@/hooks/useOnboarding";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType, ExternalHyperlink, ImageRun } from 'docx';

// Helper to create proper shading config for docx (ShadingType.CLEAR = solid fill)
const createShading = (fillColor: string) => ({
  type: ShadingType.CLEAR,
  color: 'auto',
  fill: fillColor,
});
import { getExportColors, getDecisionColors } from '@/lib/designTokens';
import { getHiringDecisionInfo as getCentralizedHiringDecisionInfo, normalizeHiringDecision } from '@/lib/hiringDecisionUtils';
import ReactMarkdown from "react-markdown";

import ProctoringReport from "@/components/proctoring/ProctoringReport";
import EnhancedProctoringReport from "@/components/proctoring/EnhancedProctoringReport";
import IntegrityChecksSummary, { getIntegrityChecksPDFData, INTEGRITY_CHECKS } from "@/components/proctoring/IntegrityChecksSummary";
import VideoPlayerWithControls from "@/components/proctoring/VideoPlayerWithControls";
import QuestionResponseSection from "@/components/assessment/QuestionResponseSection";
import { FeedbackEditDialog, type FeedbackSection } from "@/components/assessment/FeedbackEditDialog";

// Extract confidence from violation details or description (e.g., "book (60% confidence)")
const extractConfidence = (text: string | undefined): number | null => {
  if (!text) return null;
  const match = text.match(/\((\d+)%\s*confidence\)/i);
  return match ? parseInt(match[1], 10) : null;
};

// Check if violation meets confidence threshold (95%+ for object detections)
const meetsConfidenceThreshold = (violation: any): boolean => {
  // Only filter object detection violations by confidence
  const objectDetectionTypes = ['prohibited_object', 'phone_detected', 'multiple_persons'];
  
  if (!objectDetectionTypes.includes(violation.type)) {
    return true; // Non-object violations always pass
  }
  
  const confidence = extractConfidence(violation.details);
  if (confidence === null) {
    return true; // If no confidence info, show it
  }
  
  return confidence >= 95; // Only show 95%+ confidence detections
};

// Format object detection message for clarity
// Handles both 'details' (real-time violations) and 'description' (AI analysis violations)
const formatViolationDetails = (violation: any): string => {
  const { type, details, description } = violation;
  // Use details if available, fall back to description (AI analysis uses description)
  const text = details || description || '';
  
  // Extract object type and confidence for clearer display
  if (type === 'prohibited_object' || type === 'phone_detected') {
    const objectMatch = text?.match(/detected:\s*(\w+)\s*\((\d+)%\s*confidence\)/i);
    if (objectMatch) {
      const [, objectName, confidence] = objectMatch;
      return `${objectName.charAt(0).toUpperCase() + objectName.slice(1)} detected with ${confidence}% confidence. Candidate may be using external resources.`;
    }
  }
  
  return text || 'No details available';
};

// Determine if violation is from AI analysis (post-interview) or real-time
const getViolationSource = (violation: any): 'live' | 'ai' => {
  // AI analysis violations have specific types or source field
  const aiViolationTypes = [
    'suspicious_screen_content', 'screen_content_finding',
    'multiple_speakers', 'external_conversation', 'reading_pattern', 'audio_finding',
    'no_person_in_frame', 'face_at_edge', 'multiple_persons_video', 'look_away_video',
    'off_screen_gaze', 'reading_gaze', 'erratic_eye_movement', 'sustained_downward_gaze', 'peripheral_focus'
  ];
  
  if (violation.source === 'screen_analysis' || violation.source === 'audio_analysis' || violation.source === 'video_analysis') {
    return 'ai';
  }
  
  if (aiViolationTypes.includes(violation.type)) {
    return 'ai';
  }
  
  return 'live';
};

// Group violations by type and aggregate timestamps
interface GroupedViolation {
  type: string;
  displayName: string;
  count: number;
  severity: string;
  source: 'live' | 'ai';
  timestamps: { videoTimestamp: number; timestamp: string; confidence?: number }[];
  details: string;
}

const groupViolationsByType = (violations: any[]): GroupedViolation[] => {
  const grouped: Record<string, GroupedViolation> = {};
  
  for (const v of violations) {
    const type = v.type || 'unknown';
    const source = getViolationSource(v);
    
    if (!grouped[type]) {
      grouped[type] = {
        type,
        displayName: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        count: 0,
        severity: v.severity || 'medium',
        source,
        timestamps: [],
        details: v.description || v.details || '',
      };
    }
    
    grouped[type].count++;
    
    // Extract video timestamp - check multiple possible fields
    // AI analysis stores timestamp as seconds (number), live violations use videoTimestamp
    let videoTimestamp = 0;
    if (typeof v.videoTimestamp === 'number' && v.videoTimestamp > 0) {
      videoTimestamp = v.videoTimestamp;
    } else if (typeof v.timestamp === 'number') {
      // AI analysis violations store timestamp as seconds (e.g., 0, 60, 120)
      videoTimestamp = v.timestamp;
    }
    
    grouped[type].timestamps.push({
      videoTimestamp,
      timestamp: typeof v.timestamp === 'string' ? v.timestamp : new Date().toISOString(),
      confidence: v.metadata?.confidence,
    });
    
    // Keep highest severity
    if (v.severity === 'high') grouped[type].severity = 'high';
    else if (v.severity === 'medium' && grouped[type].severity !== 'high') grouped[type].severity = 'medium';
  }
  
  return Object.values(grouped).sort((a, b) => {
    // Sort by severity then count
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] ?? 2;
    const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] ?? 2;
    if (aSeverity !== bSeverity) return aSeverity - bSeverity;
    return b.count - a.count;
  });
};

// Derive accurate violation counts from detailed_violations
const deriveViolationCounts = (detailedViolations: any[]) => {
  const counts = {
    phone_detected: 0,
    prohibited_object: 0,
    multiple_persons: 0,
    multiple_voices: 0,
    tab_switch: 0,
    look_away: 0,
    copy_attempt: 0,
    print_screen: 0,
    multiple_monitors: 0,
    virtual_machine: 0,
    suspicious_typing: 0,
    audio_playback: 0,
  headphone_usage: 0,
    earphone_detected: 0,
    suspicious_screen: 0,
    other: 0,
  };
  
  for (const v of detailedViolations || []) {
    const type = v.type?.toLowerCase() || '';
    // IMPORTANT: Order matters! Check more specific types BEFORE generic ones
    // e.g., 'headphone' must be checked before 'phone' (headphone contains 'phone')
    if (type.includes('headphone') || type.includes('earphone') || type.includes('earbud')) counts.headphone_usage++;
    else if (type.includes('phone_detected') || type === 'phone') counts.phone_detected++;
    else if (type.includes('prohibited_object')) counts.prohibited_object++;
    else if (type.includes('multiple_person') || type.includes('multiple_persons')) counts.multiple_persons++;
    else if (type.includes('multiple_voice') || type.includes('multiple_voices')) counts.multiple_voices++;
    else if (type.includes('tab_switch')) counts.tab_switch++;
    else if (type.includes('look_away')) counts.look_away++;
    else if (type.includes('copy')) counts.copy_attempt++;
    else if (type.includes('print_screen')) counts.print_screen++;
    else if (type.includes('multiple_monitor')) counts.multiple_monitors++;
    else if (type.includes('virtual_machine')) counts.virtual_machine++;
    else if (type.includes('suspicious_typing')) counts.suspicious_typing++;
    else if (type.includes('audio_playback')) counts.audio_playback++;
    else if (type.includes('suspicious_screen') || type.includes('screen_content')) counts.suspicious_screen++;
    else counts.other++;
  }
  
  return counts;
};

// Calculate integrity score from detailed_violations array (filtering out ignored violations)
const calculateIntegrityFromViolations = (
  violations: any[], 
  storedScore?: number | null, 
  ignoredViolations: string[] = []
): number => {
  // Filter out ignored violations first
  const activeViolations = (violations || []).filter(v => !ignoredViolations.includes(v.type));
  
  // If no active violations, return 100
  if (activeViolations.length === 0) {
    return 100;
  }
  
  // Type-based deductions (matching calculate_integrity_from_violations DB function and calculate-cpi edge function)
  const getViolationDeduction = (violationType: string): number => {
    const type = violationType?.toLowerCase().replace(/-/g, '_') || '';
    
    // Very High severity (15 points)
    if (['different_person_detected', 'different_person', 'multiple_persons_video', 
         'phone_detected', 'phone_in_video', 'suspicious_screen_content', 
         'screen_content_finding', 'nested_screen_sharing'].includes(type)) {
      return 15;
    }
    
    // High severity (10 points)
    if (['no_person_in_frame', 'virtual_machine', 'vm_detected', 'external_conversation'].includes(type)) {
      return 10;
    }
    
    // Medium-High severity (8 points)
    if (['identity_verification_uncertain', 'identity_uncertain', 'multiple_voices', 
         'multiple_speakers', 'paste_in_code_editor'].includes(type)) {
      return 8;
    }
    
    // Medium severity (5 points)
    if (['headphones_detected', 'earbuds_detected', 'airpods_detected', 
         'suspicious_background_objects', 'suspicious_background', 'prohibited_object',
         'face_occluded', 'eye_gaze_off_screen', 'tab_switch', 'print_screen',
         'audio_playback', 'multiple_monitors', 'second_monitor_suspected', 
         'reading_pattern', 'screen_share_stopped'].includes(type)) {
      return 5;
    }
    
    // Low severity (3 points)
    if (['face_at_edge', 'copy_attempt', 'background_changed', 
         'suspicious_typing', 'silence_anomaly'].includes(type)) {
      return 3;
    }
    
    // Very Low severity (2 points)
    if (['poor_lighting', 'clothing_changed', 'look_away', 'look_away_video',
         'looking_away', 'eye_movement', 'glasses_reflection', 'sunglasses'].includes(type)) {
      return 2;
    }
    
    // Default for unknown types
    return 5;
  };
  
  let deductions = 0;
  for (const v of activeViolations) {
    deductions += getViolationDeduction(v.type);
  }
  
  return Math.max(0, 100 - deductions);
};

// Violation card with screenshot support and source indicator
const ViolationCard = ({ violation }: { violation: any }) => {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);
  
  const violationSource = getViolationSource(violation);

  // Load screenshot automatically on mount if available
  useEffect(() => {
    const loadScreenshot = async () => {
      if (!violation.screenshotUrl) return;
      
      setLoadingScreenshot(true);
      try {
        const { data } = await supabase.storage
          .from('proctoring-recordings')
          .createSignedUrl(violation.screenshotUrl, 3600);
        
        if (data?.signedUrl) {
          setScreenshotUrl(data.signedUrl);
        }
      } catch (error) {
        logger.error('Failed to load screenshot:', error);
      } finally {
        setLoadingScreenshot(false);
      }
    };
    
    loadScreenshot();
  }, [violation.screenshotUrl]);

  // Extract confidence for display - check both details and description
  const confidence = extractConfidence(violation.details || violation.description);
  const formattedDetails = formatViolationDetails(violation);

  // Determine object type icon label for clarity
  const getObjectLabel = () => {
    if (violation.type === 'prohibited_object') {
      const objectMatch = violation.details?.match(/detected:\s*(\w+)/i);
      return objectMatch ? objectMatch[1].toUpperCase() : 'OBJECT';
    }
    if (violation.type === 'phone_detected') return 'PHONE';
    if (violation.type === 'multiple_persons') return 'PERSON';
    return null;
  };

  const objectLabel = getObjectLabel();

  return (
    <div className="p-3 rounded-lg border space-y-2">
      <div className="flex items-start gap-3">
        {/* Thumbnail screenshot if available */}
        {screenshotUrl ? (
          <div className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border bg-muted">
            <img 
              src={screenshotUrl} 
              alt={`Screenshot of ${violation.type}`}
              className="w-full h-full object-cover"
            />
            {objectLabel && (
              <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-destructive-foreground text-[10px] font-bold text-center py-0.5">
                {objectLabel}
              </div>
            )}
          </div>
        ) : loadingScreenshot ? (
          <div className="flex-shrink-0 w-16 h-16 rounded border bg-muted flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        ) : (
          <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
            violation.severity === 'high' ? 'text-destructive' :
            violation.severity === 'medium' ? 'text-warning' :
            'text-primary'
          }`} />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-medium capitalize">
                {violation.type.replace(/_/g, ' ')}
              </span>
              {/* Source indicator - Live vs AI Analysis */}
              <Badge variant="outline" className={
                violationSource === 'ai' 
                  ? 'text-purple-600 border-purple-300 bg-purple-50 text-xs' 
                  : 'text-blue-600 border-blue-300 bg-blue-50 text-xs'
              }>
                {violationSource === 'ai' ? '🤖 AI Analysis' : '📡 Live'}
              </Badge>
              {confidence !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  confidence >= 95 ? 'bg-destructive/10 text-destructive' :
                  confidence >= 80 ? 'bg-warning/10 text-warning' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {confidence}%
                </span>
              )}
            </div>
            <Badge variant="outline" className={
              violation.severity === 'high' ? 'text-destructive border-destructive/30' :
              violation.severity === 'medium' ? 'text-warning border-warning/30' :
              'text-primary border-primary/30'
            }>
              {violation.severity}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formattedDetails}
          </p>
          <div className="text-xs text-muted-foreground mt-1">
            {violation.videoTimestamp !== undefined && violation.videoTimestamp > 0 ? (
              <span className="text-primary font-medium">
                At video time: {Math.floor(violation.videoTimestamp / 60)}:{String(violation.videoTimestamp % 60).padStart(2, '0')}
              </span>
            ) : (
              <span>{new Date(violation.timestamp).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AssessmentReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { updateProgress } = useOnboarding();
  const [assessment, setAssessment] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [proctoringSession, setProctoringSession] = useState<any>(null);
  const [cpiData, setCpiData] = useState<any>(null); // Candidate Performance Index data
  const [recordingDialogOpen, setRecordingDialogOpen] = useState(false);
  const [screenRecordingUrl, setScreenRecordingUrl] = useState<string | null>(null);
  const [screenRecordingPosterUrl, setScreenRecordingPosterUrl] = useState<string | null>(null);
  const [screenRecordingMemoryUrl, setScreenRecordingMemoryUrl] = useState<string | null>(null);
  const [loadingRecording, setLoadingRecording] = useState(false);
  const [loadingRecordingIntoMemory, setLoadingRecordingIntoMemory] = useState(false);
  const [recordingLoadProgress, setRecordingLoadProgress] = useState(0);
  const [ignoredViolations, setIgnoredViolations] = useState<string[]>([]);
  const [togglingViolation, setTogglingViolation] = useState<string | null>(null);
  const [displayIntegrityScore, setDisplayIntegrityScore] = useState<number | null>(null);
  const [proctoringReportOpen, setProctoringReportOpen] = useState(false);
  const [feedbackEditOpen, setFeedbackEditOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<FeedbackSection>('strengths');

  // Handler for feedback section updates
  const handleFeedbackUpdate = (section: FeedbackSection, newContent: string | string[]) => {
    setAssessment((prev: any) => ({
      ...prev,
      [section]: newContent,
    }));
  };

  const openFeedbackEdit = (section: FeedbackSection) => {
    setEditingSection(section);
    setFeedbackEditOpen(true);
  };
  useEffect(() => {
    fetchAssessment();
    // Mark assessment viewing as complete in onboarding
    updateProgress("viewed_report", true);
  }, [id]);

  const fetchAssessment = async () => {
    try {
      // First try to fetch assessment by id
      let assessmentData = null;
      const { data: directLookup, error: directError } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (directLookup) {
        assessmentData = directLookup;
      } else {
        // If not found by id, try looking up by attempt_id (notifications use attempt_id)
        const { data: attemptLookup, error: attemptError } = await supabase
          .from("assessments")
          .select("*")
          .eq("attempt_id", id)
          .maybeSingle();
        
        if (attemptLookup) {
          assessmentData = attemptLookup;
        } else if (directError) {
          toast({
            title: "Error",
            description: directError.message || "Failed to load assessment",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      if (!assessmentData) {
        toast({
          title: "Not Found",
          description: "Assessment not found or you don't have permission to view it",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      logger.debug("Assessment found, fetching attempt:", assessmentData.attempt_id);

      // Fetch attempt separately with organization data
      const { data: attemptData, error: attemptError } = await supabase
        .from("interview_attempts")
        .select("*, interviews(*, organizations(name))")
        .eq("id", assessmentData.attempt_id)
        .single();

      logger.debug("Attempt query result:", { data: attemptData, error: attemptError });

      if (attemptError || !attemptData) {
        logger.error("Attempt error:", attemptError);
        toast({
          title: "Error",
          description: "Failed to load interview details",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      logger.debug("Setting state with:", { assessment: assessmentData, attempt: attemptData, interview: attemptData.interviews });

      // Fetch only the questions that were asked to this candidate
      const { data: questionsData, error: questionsError } = await supabase
        .from("attempt_questions")
        .select(`
          question_id,
          display_order,
          questions (*)
        `)
        .eq("attempt_id", assessmentData.attempt_id)
        .order("display_order");

      logger.debug("Questions for attempt:", { data: questionsData, error: questionsError });

      if (!questionsError && questionsData) {
        // Extract the actual question data from the nested structure
        const actualQuestions = questionsData.map((aq: any) => ({
          ...aq.questions,
          display_order: aq.display_order
        }));
        setQuestions(actualQuestions);
      }

      setAssessment(assessmentData);
      setAttempt(attemptData);
      setInterview(attemptData.interviews);

      // Fetch CPI (Candidate Performance Index) for integrity-aware hiring recommendation
      const { data: cpiResult } = await supabase
        .from("candidate_performance_index")
        .select("*")
        .eq("attempt_id", assessmentData.attempt_id)
        .maybeSingle();
      
      if (cpiResult) {
        setCpiData(cpiResult);
      }

      // Fetch proctoring session if proctoring was enabled
      if (attemptData.interviews.proctoring_enabled) {
        const { data: proctoringData, error: proctoringError } = await supabase
          .from("proctoring_sessions")
          .select("*")
          .eq("interview_attempt_id", attemptData.id)
          .maybeSingle();

        if (!proctoringError && proctoringData) {
          setProctoringSession(proctoringData);
          // Initialize ignored violations from stored data
          const ignoredData = proctoringData.ignored_violations as unknown;
          const ignoredList = Array.isArray(ignoredData) ? (ignoredData as string[]) : [];
          setIgnoredViolations(ignoredList);
          // Set initial integrity score (with ignored violations already applied)
          const violations = proctoringData.detailed_violations as unknown;
          setDisplayIntegrityScore(calculateIntegrityFromViolations(
            Array.isArray(violations) ? violations : [], 
            proctoringData.integrity_score,
            ignoredList
          ));
        }
      }

      setLoading(false);
    } catch (err) {
      logger.error("Error loading assessment report:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const openRecordingDialog = async () => {
    if (!proctoringSession?.screen_recording_url) {
      toast({
        title: "No Recording",
        description: "No screen recording available for this session",
        variant: "destructive",
      });
      return;
    }

    // Reset any previous in-memory stream
    if (screenRecordingMemoryUrl) {
      URL.revokeObjectURL(screenRecordingMemoryUrl);
    }
    setScreenRecordingMemoryUrl(null);
    setScreenRecordingUrl(null);
    setScreenRecordingPosterUrl(null);
    setRecordingLoadProgress(0);

    setRecordingDialogOpen(true);
    setLoadingRecording(true);

    try {
      const posterPathCandidates = [
        `${proctoringSession.id}/screen-periodic-0-t0.jpg`,
        `${proctoringSession.id}/periodic-0-t0.jpg`,
      ];

      const [{ data: recData, error: recErr }, ...posterResults] = await Promise.all([
        supabase.storage
          .from('proctoring-recordings')
          .createSignedUrl(proctoringSession.screen_recording_url, 3600),
        ...posterPathCandidates.map((p) =>
          supabase.storage.from('proctoring-recordings').createSignedUrl(p, 3600)
        ),
      ]);

      if (recErr || !recData) {
        throw new Error('Failed to load recording');
      }

      setScreenRecordingUrl(recData.signedUrl);

      const poster = posterResults.find((r) => r.data?.signedUrl)?.data?.signedUrl;
      if (poster) setScreenRecordingPosterUrl(poster);

    } catch (error) {
      logger.error('Error loading recording:', error);
      toast({
        title: "Error",
        description: "Failed to load recording",
        variant: "destructive",
      });
    } finally {
      setLoadingRecording(false);
    }
  };

  const loadRecordingIntoMemory = async () => {
    if (!screenRecordingUrl) return;

    setLoadingRecordingIntoMemory(true);
    setRecordingLoadProgress(0);

    try {
      const response = await fetch(screenRecordingUrl);
      if (!response.ok) throw new Error('Failed to fetch recording');

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming not supported in this browser');

      const chunks: ArrayBuffer[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const ab = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
        chunks.push(ab);
        received += value.byteLength;

        if (total > 0) {
          setRecordingLoadProgress(Math.round((received / total) * 100));
        }
      }

      const blob = new Blob(chunks, { type: 'video/webm' });
      const blobUrl = URL.createObjectURL(blob);

      if (screenRecordingMemoryUrl) {
        URL.revokeObjectURL(screenRecordingMemoryUrl);
      }

      setScreenRecordingMemoryUrl(blobUrl);
      successToast('Recording is ready', 'Playing from memory (not downloaded to your device).');
    } catch (error) {
      logger.error('Error loading recording into memory:', error);
      errorToast('Could not load recording', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoadingRecordingIntoMemory(false);
      setRecordingLoadProgress(0);
    }
  };

  useEffect(() => {
    if (!recordingDialogOpen && screenRecordingMemoryUrl) {
      URL.revokeObjectURL(screenRecordingMemoryUrl);
      setScreenRecordingMemoryUrl(null);
    }
  }, [recordingDialogOpen, screenRecordingMemoryUrl]);

  // Toggle violation ignore status and recalculate integrity score
  const toggleViolationIgnored = async (violationType: string) => {
    if (!proctoringSession?.id) return;
    
    setTogglingViolation(violationType);
    
    try {
      const isCurrentlyIgnored = ignoredViolations.includes(violationType);
      const newIgnoreState = !isCurrentlyIgnored;
      
      const { data, error } = await supabase.rpc('toggle_violation_ignored', {
        p_session_id: proctoringSession.id,
        p_violation_id: violationType,
        p_ignore: newIgnoreState
      });
      
      if (error) throw error;
      
      // Update local state
      if (newIgnoreState) {
        setIgnoredViolations(prev => [...prev, violationType]);
      } else {
        setIgnoredViolations(prev => prev.filter(v => v !== violationType));
      }
      
      // Update integrity score and hiring decision from the database response
      if (data && data[0]) {
        setDisplayIntegrityScore(data[0].new_integrity_score);
        
        // Update assessment hiring decision if it changed
        if (data[0].new_hiring_decision && assessment) {
          setAssessment((prev: any) => ({
            ...prev,
            hiring_decision: data[0].new_hiring_decision
          }));
        }
        
        // CRITICAL: Also update cpiData since it takes precedence in effectiveHiringDecision
        if (data[0].new_hiring_decision) {
          setCpiData((prev: any) => prev ? ({
            ...prev,
            integrity_score: data[0].new_integrity_score,
            hiring_recommendation: data[0].new_hiring_decision
          }) : null);
        }
      }
      
      toast({
        title: newIgnoreState ? "Violation Ignored" : "Violation Restored",
        description: newIgnoreState 
          ? "This violation will not count toward integrity score" 
          : "This violation will now count toward integrity score",
      });
    } catch (error) {
      logger.error('Error toggling violation:', error);
      toast({
        title: "Error",
        description: "Failed to update violation status",
        variant: "destructive",
      });
    } finally {
      setTogglingViolation(null);
    }
  };

  const getShareableLink = async (recordingType: 'video' | 'screen') => {
    const recordingUrl = recordingType === 'video'
      ? proctoringSession?.video_recording_url 
      : proctoringSession?.screen_recording_url;
    
    if (!recordingUrl) {
      toast({
        title: "No Recording",
        description: `No ${recordingType} recording available`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate a 7-day shareable link
      const { data, error } = await supabase.storage
        .from('proctoring-recordings')
        .createSignedUrl(recordingUrl, 604800); // 7 days in seconds

      if (error || !data) {
        throw new Error('Failed to generate shareable link');
      }

      await navigator.clipboard.writeText(data.signedUrl);
      toast({
        title: "Link Copied!",
        description: "Shareable link valid for 7 days has been copied to clipboard",
      });
    } catch (error) {
      logger.error('Error generating shareable link:', error);
      toast({
        title: "Error",
        description: "Failed to generate shareable link",
        variant: "destructive",
      });
    }
  };

  const getHiringDecisionInfo = (decision: string) => {
    // Normalize decision to handle both old and new values
    const normalized = decision?.toLowerCase().replace(/\s+/g, '_');
    
    switch (normalized) {
      case "strongly_recommend":
      case "strong_hire":
        return {
          label: "Strong Hire",
          description: "Exceptional candidate - Highly recommended for immediate hire",
          color: "bg-success text-success-foreground",
          icon: <CheckCircle className="w-6 h-6" />,
        };
      case "recommend":
      case "hire":
        return {
          label: "Hire",
          description: "Good candidate - Recommended for hire",
          color: "bg-primary text-primary-foreground",
          icon: <CheckCircle className="w-6 h-6" />,
        };
      case "consider":
      case "maybe":
        return {
          label: "Consider",
          description: "Average candidate - Requires further evaluation",
          color: "bg-warning text-warning-foreground",
          icon: <TrendingUp className="w-6 h-6" />,
        };
      case "not_recommended":
      case "reject":
      case "no_hire":
        return {
          label: "Reject",
          description: "Not recommended for this position",
          color: "bg-destructive text-destructive-foreground",
          icon: <XCircle className="w-6 h-6" />,
        };
      default:
        return {
          label: "Unknown",
          description: "",
          color: "bg-secondary text-secondary-foreground",
          icon: null,
        };
    }
  };

  // Generate 7-day shareable links for recordings
  const generateShareableLinks = async () => {
    const links: { video?: string; screen?: string } = {};
    
    if (proctoringSession?.video_recording_url) {
      try {
        const { data } = await supabase.storage
          .from('proctoring-recordings')
          .createSignedUrl(proctoringSession.video_recording_url, 604800);
        if (data) links.video = data.signedUrl;
      } catch (e) {
        logger.error('Failed to generate video link:', e);
      }
    }
    
    if (proctoringSession?.screen_recording_url) {
      try {
        const { data } = await supabase.storage
          .from('proctoring-recordings')
          .createSignedUrl(proctoringSession.screen_recording_url, 604800);
        if (data) links.screen = data.signedUrl;
      } catch (e) {
        logger.error('Failed to generate screen link:', e);
      }
    }
    
    return links;
  };

  // Helper to load image as base64 for PDF embedding
  const loadImageAsBase64 = async (storagePath: string): Promise<string | null> => {
    try {
      const { data: signedUrlData } = await supabase.storage
        .from('proctoring-recordings')
        .createSignedUrl(storagePath, 300); // 5 min validity
      
      if (!signedUrlData?.signedUrl) return null;
      
      // Fetch image and convert to base64
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) return null;
      
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      logger.error('Failed to load image:', e);
      return null;
    }
  };

  // Load violation thumbnails for PDF - only loads first occurrence of each type
  const loadViolationThumbnails = async (violations: any[], ignoredList: string[]) => {
    const thumbnails: Record<string, { camera?: string; screen?: string }> = {};
    const seenTypes = new Set<string>();
    
    for (const v of violations) {
      // Skip ignored violations
      if (ignoredList.includes(v.type)) continue;
      // Only load first occurrence of each type
      if (seenTypes.has(v.type)) continue;
      seenTypes.add(v.type);
      
      const entry: { camera?: string; screen?: string } = {};
      
      if (v.screenshotUrl) {
        const img = await loadImageAsBase64(v.screenshotUrl);
        if (img) entry.camera = img;
      }
      if (v.screenScreenshotUrl) {
        const img = await loadImageAsBase64(v.screenScreenshotUrl);
        if (img) entry.screen = img;
      }
      
      if (entry.camera || entry.screen) {
        thumbnails[v.type] = entry;
      }
    }
    
    return thumbnails;
  };

  const downloadTextReport = async () => {
    // Generate shareable links for recordings
    const recordingLinks = await generateShareableLinks();
    
    let recordingSection = '';
    if (recordingLinks.video || recordingLinks.screen) {
      recordingSection = `

PROCTORING RECORDINGS (Links valid for 7 days):
${recordingLinks.screen ? `Screen Recording: ${recordingLinks.screen}` : ''}
${recordingLinks.video ? `Camera Recording: ${recordingLinks.video}` : ''}`;
    }

    const reportContent = `
INTERVIEW ASSESSMENT REPORT
===========================

Interview: ${interview.title}
Candidate: ${attempt.candidate_name}
Email: ${attempt.candidate_email}
Date: ${new Date(attempt.created_at).toLocaleDateString()}

OVERALL SCORE: ${assessment.overall_score}%
HIRING DECISION: ${getCentralizedHiringDecisionInfo(cpiData?.hiring_recommendation || assessment.hiring_decision).label.toUpperCase()}

STRENGTHS:
${assessment.strengths.map((s: string) => `- ${s}`).join('\n')}

WEAKNESSES:
${assessment.weaknesses.map((w: string) => `- ${w}`).join('\n')}

TOPIC SCORES:
${Object.entries(assessment.topic_scores).map(([topic, score]) => `- ${topic}: ${score}%`).join('\n')}

DETAILED ANALYSIS:
${assessment.detailed_analysis}${recordingSection}
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-${attempt.candidate_name.replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Text report downloaded successfully",
    });
  };

  const downloadPDFReport = async (includeQuestions: boolean = true) => {
    // Generate shareable links first
    const recordingLinks = await generateShareableLinks();
    
    // Load violation thumbnails for PDF embedding
    let violationThumbnails: Record<string, { camera?: string; screen?: string }> = {};
    if (proctoringSession?.detailed_violations) {
      const ignoredList: string[] = (proctoringSession.ignored_violations as string[]) || [];
      violationThumbnails = await loadViolationThumbnails(
        proctoringSession.detailed_violations as any[],
        ignoredList
      );
    }
    
    const doc = new jsPDF();
    // Use CPI hiring_recommendation as source of truth, fallback to assessment.hiring_decision
    const effectiveHiringDecision = cpiData?.hiring_recommendation || assessment.hiring_decision;
    const decisionInfo = getHiringDecisionInfo(effectiveHiringDecision);
    let yPos = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // Helper function to draw a card/section
    const drawCard = (title: string, bgColor: [number, number, number], startY: number) => {
      doc.setFillColor(...bgColor);
      doc.roundedRect(margin, startY, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(title, margin + 5, startY + 7);
      doc.setTextColor(0, 0, 0);
      return startY + 12;
    };

    // Helper to draw progress bar
    const drawProgressBar = (x: number, y: number, width: number, percentage: number) => {
      // Background
      doc.setFillColor(230, 230, 230);
      doc.roundedRect(x, y, width, 4, 1, 1, 'F');
      // Progress
      doc.setFillColor(99, 102, 241); // Primary color
      doc.roundedRect(x, y, (width * percentage) / 100, 4, 1, 1, 'F');
    };

    // Header with gradient effect (simulated)
    doc.setFillColor(243, 244, 246);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Interview Assessment Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('AI-Generated Evaluation', pageWidth / 2, 28, { align: 'center' });
    doc.text(new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }), pageWidth / 2, 35, { align: 'center' });

    yPos = 55;
    doc.setTextColor(0, 0, 0);

    // Candidate Information Card
    yPos = drawCard('Candidate Information', [59, 130, 246], yPos);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(71, 85, 105);
    
    const infoItems = [
      ['Name:', attempt.candidate_name],
      ['Email:', attempt.candidate_email],
      ['Interview:', interview.title],
      ['Date:', new Date(attempt.created_at).toLocaleDateString()]
    ];
    
    infoItems.forEach(([label, value], index) => {
      const itemY = yPos + 5 + (index * 8);
      doc.setFont(undefined, 'bold');
      doc.text(label, margin + 5, itemY);
      doc.setFont(undefined, 'normal');
      doc.text(value, margin + 35, itemY);
    });
    
    yPos += 40;
    
    // Add recording links to Candidate Information (if available)
    if (recordingLinks.screen || recordingLinks.video) {
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Session Recordings', margin + 5, yPos);
      yPos += 6;
      
      // Add instruction note
      doc.setFontSize(8);
      doc.setFont(undefined, 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Click links below to open recordings (valid for 7 days from report generation)', margin + 5, yPos);
      yPos += 6;
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      
      if (recordingLinks.screen) {
        // Draw clickable link with underline
        doc.setTextColor(37, 99, 235);
        const screenLinkText = 'Screen Recording - Click to View';
        doc.textWithLink(screenLinkText, margin + 8, yPos, { url: recordingLinks.screen });
        // Draw underline for visual affordance
        const textWidth = doc.getTextWidth(screenLinkText);
        doc.setDrawColor(37, 99, 235);
        doc.line(margin + 8, yPos + 1, margin + 8 + textWidth, yPos + 1);
        yPos += 6;
      }
      
      if (recordingLinks.video) {
        // Draw clickable link with underline
        doc.setTextColor(37, 99, 235);
        const cameraLinkText = 'Camera Recording - Click to View';
        doc.textWithLink(cameraLinkText, margin + 8, yPos, { url: recordingLinks.video });
        // Draw underline for visual affordance
        const textWidth = doc.getTextWidth(cameraLinkText);
        doc.setDrawColor(37, 99, 235);
        doc.line(margin + 8, yPos + 1, margin + 8 + textWidth, yPos + 1);
        yPos += 6;
      }
      
      // Add note about link expiration
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text('Note: If links have expired, please download a new PDF report from the assessment page.', margin + 5, yPos);
      yPos += 8;
    }
    
    yPos += 5;

    // Overall Assessment Card with color coding - use normalized decision for consistency
    const decisionColors: Record<string, [number, number, number]> = {
      strongly_recommend: [34, 197, 94],
      recommend: [99, 102, 241],
      consider: [234, 179, 8],
      not_recommended: [239, 68, 68],
    };
    
    // Use centralized utility for consistent normalization
    const normalizedDecision = normalizeHiringDecision(effectiveHiringDecision);
    const decisionColor = decisionColors[normalizedDecision] || [100, 116, 139];
    
    doc.setFillColor(...decisionColor);
    doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(decisionInfo.label, margin + 5, yPos + 12);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(decisionInfo.description, margin + 5, yPos + 20);
    
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.text(`${assessment.overall_score}%`, pageWidth - margin - 5, yPos + 20, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Overall Score', pageWidth - margin - 5, yPos + 28, { align: 'right' });
    
    yPos += 45;
    doc.setTextColor(0, 0, 0);

    // Key Strengths
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos = drawCard('Key Strengths', [34, 197, 94], yPos);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    assessment.strengths.forEach((strength: string, index: number) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      // Checkmark icon
      doc.setTextColor(34, 197, 94);
      doc.setFont(undefined, 'bold');
      doc.text('✓', margin + 5, yPos + 5);
      
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      const lines = doc.splitTextToSize(strength, contentWidth - 20);
      doc.text(lines, margin + 12, yPos + 5);
      yPos += (lines.length * 5) + 3;
    });
    
    yPos += 5;

    // Areas for Improvement
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos = drawCard('Areas for Improvement', [234, 179, 8], yPos);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    assessment.weaknesses.forEach((weakness: string, index: number) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      // Warning icon
      doc.setTextColor(234, 179, 8);
      doc.setFont(undefined, 'bold');
      doc.text('⚠', margin + 5, yPos + 5);
      
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      const lines = doc.splitTextToSize(weakness, contentWidth - 20);
      doc.text(lines, margin + 12, yPos + 5);
      yPos += (lines.length * 5) + 3;
    });
    
    yPos += 5;

    // Detailed Analysis
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos = drawCard('Detailed Analysis', [100, 116, 139], yPos);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(51, 65, 85);
    
    // Filter out Video Analysis Update text from detailed analysis for PDF
    let cleanedDetailedAnalysis = assessment.detailed_analysis || '';
    // Remove [Video Analysis Update: ...] pattern
    cleanedDetailedAnalysis = cleanedDetailedAnalysis.replace(/\[Video Analysis Update:[^\]]*\]/g, '').trim();
    // Also remove any lines that start with [Video Analysis
    cleanedDetailedAnalysis = cleanedDetailedAnalysis.split('\n')
      .filter(line => !line.trim().startsWith('[Video Analysis'))
      .join('\n')
      .trim();
    
    const analysisLines = doc.splitTextToSize(cleanedDetailedAnalysis, contentWidth - 10);
    analysisLines.forEach((line: string) => {
      if (yPos > 275) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, margin + 5, yPos + 5);
      yPos += 5;
    });

    yPos += 10;

    // Questions & Candidate Responses (only if includeQuestions is true)
    if (includeQuestions && questions && questions.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      
      yPos = drawCard('Questions & Candidate Responses', [59, 130, 246], yPos);
      
      questions.forEach((question: any, index: number) => {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }
        
        // Question number and text
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 41, 59);
        const questionText = `Q${index + 1}: ${question.question_text}`;
        const questionLines = doc.splitTextToSize(questionText, contentWidth - 10);
        questionLines.forEach((line: string) => {
          if (yPos > 275) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, margin + 5, yPos + 5);
          yPos += 5;
        });
        
        yPos += 3;
        
        // Question metadata
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Type: ${question.question_type?.toUpperCase() || 'N/A'} | Difficulty: ${question.difficulty || 'N/A'} | Topic: ${question.topic || 'N/A'}`, margin + 5, yPos + 3);
        yPos += 8;
        
        // Candidate's answer
        const answers = attempt.answers as Record<string, any>;
        const candidateAnswer = answers?.[question.id];
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('Candidate Answer:', margin + 5, yPos + 3);
        yPos += 6;
        
        doc.setFont(undefined, 'normal');
        let answerText = 'No answer provided';
        if (candidateAnswer) {
          if (question.question_type === 'mcq') {
            answerText = candidateAnswer.selected_option || candidateAnswer || 'No selection';
          } else if (question.question_type === 'coding') {
            answerText = candidateAnswer.code || candidateAnswer || 'No code submitted';
          } else {
            answerText = candidateAnswer.answer || candidateAnswer || 'No answer';
          }
        }
        
        const answerLines = doc.splitTextToSize(String(answerText).substring(0, 500), contentWidth - 15);
        answerLines.forEach((line: string) => {
          if (yPos > 275) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, margin + 10, yPos + 3);
          yPos += 5;
        });
        
        // Correct answer for MCQ
        if (question.question_type === 'mcq' && question.correct_answer) {
          yPos += 2;
          doc.setTextColor(34, 197, 94);
          doc.setFont(undefined, 'bold');
          doc.text(`Correct Answer: ${question.correct_answer}`, margin + 5, yPos + 3);
          doc.setTextColor(0, 0, 0);
          yPos += 6;
        }
        
        yPos += 8;
      });
    }

    // Proctoring & Integrity Report - Full Summary with Thumbnails
    if (proctoringSession) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      
      yPos = drawCard('Proctoring & Integrity Report', [139, 92, 246], yPos);
      
      // Calculate integrity score from detailed_violations (filtering out ignored violations)
      const allDetailedViolations = proctoringSession.detailed_violations || [];
      const ignoredList: string[] = Array.isArray(proctoringSession.ignored_violations) 
        ? (proctoringSession.ignored_violations as string[]) 
        : [];
      const integrityScore = calculateIntegrityFromViolations(allDetailedViolations, proctoringSession.integrity_score, ignoredList);
      
      // Integrity Score
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Overall Integrity Score:', margin + 5, yPos + 8);
      
      const scoreColor = integrityScore >= 90 ? [34, 197, 94] : integrityScore >= 70 ? [234, 179, 8] : [239, 68, 68];
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setFontSize(18);
      doc.text(`${integrityScore}%`, margin + 70, yPos + 8);
      
      const statusText = integrityScore >= 90 ? 'Excellent' : integrityScore >= 70 ? 'Good' : 'Flagged';
      doc.setFontSize(10);
      doc.text(statusText, margin + 95, yPos + 8);
      
      yPos += 18;
      
      // Pre-interview Checks Summary (compact)
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Pre-Interview Checks:', margin + 5, yPos + 3);
      doc.setFont(undefined, 'normal');
      
      const preChecks = [
        { label: 'Camera', passed: proctoringSession.camera_check_passed !== false },
        { label: 'Audio', passed: proctoringSession.audio_check_passed !== false },
        { label: 'Lighting', passed: proctoringSession.lighting_check_passed !== false },
        { label: 'Screen Share', passed: proctoringSession.screen_share_active !== false }
      ];
      
      let checkX = margin + 55;
      for (const check of preChecks) {
        const symbol = check.passed ? '✓' : '✗';
        doc.setTextColor(check.passed ? 22 : 220, check.passed ? 163 : 38, check.passed ? 74 : 38);
        doc.text(`${symbol} ${check.label}`, checkX, yPos + 3);
        checkX += 35;
      }
      
      yPos += 12;
      
      // COMPLETE INTEGRITY CHECKS TABLE
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Complete Integrity Checks (All 16 Checks):', margin + 5, yPos + 5);
      yPos += 10;
      
      // Get structured integrity check data (excluding ignored violations)
      const integrityCheckData = getIntegrityChecksPDFData(proctoringSession.detailed_violations || [], ignoredList);
      
      // Table header
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, yPos, contentWidth, 8, 'F');
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Check', margin + 2, yPos + 5);
      doc.text('Category', margin + 70, yPos + 5);
      doc.text('Status', margin + 100, yPos + 5);
      doc.text('Count', margin + 130, yPos + 5);
      doc.text('Timestamps', margin + 150, yPos + 5);
      yPos += 10;
      
      // Table rows
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      
      for (const check of integrityCheckData) {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }
        
        const isFail = check.status === 'FAIL';
        
        // Alternate row background for failed checks
        if (isFail) {
          doc.setFillColor(254, 242, 242);
          doc.rect(margin, yPos - 2, contentWidth, 7, 'F');
        }
        
        doc.setTextColor(51, 65, 85);
        doc.text(check.name.substring(0, 35), margin + 2, yPos + 3);
        doc.text(check.category, margin + 70, yPos + 3);
        
        // Status with color
        if (isFail) {
          doc.setTextColor(220, 38, 38);
          doc.setFont(undefined, 'bold');
        } else {
          doc.setTextColor(22, 163, 74);
        }
        doc.text(check.status, margin + 100, yPos + 3);
        
        doc.setTextColor(51, 65, 85);
        doc.setFont(undefined, 'normal');
        doc.text(String(check.count), margin + 130, yPos + 3);
        
        // Timestamps summary in main row
        if (check.timestamps.length > 0) {
          doc.text(`${check.timestamps.length} occurrence${check.timestamps.length > 1 ? 's' : ''}`, margin + 150, yPos + 3);
        } else {
          doc.text('-', margin + 150, yPos + 3);
        }
        
        yPos += 7;
        
        // If failed, show ALL timestamps expanded below the row
        if (isFail && check.timestamps.length > 0) {
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          
          // Group timestamps into rows of 5
          const timestampsPerRow = 5;
          for (let i = 0; i < check.timestamps.length; i += timestampsPerRow) {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            
            const batch = check.timestamps.slice(i, i + timestampsPerRow);
            const tsLine = batch.map((t, idx) => `#${i + idx + 1}: ${t.videoTime}`).join('  |  ');
            doc.text(`    ${tsLine}`, margin + 5, yPos + 2);
            yPos += 5;
          }
          
          doc.setFontSize(7);
          yPos += 2;
        }
      }
      
      yPos += 5;
      
      // Violations with Thumbnails Section
      // Filter and dedupe violations (same logic as UI)
      const seenViolationTypes = new Set<string>();
      const uniqueViolations = (allDetailedViolations as any[]).filter((v: any) => {
        if (ignoredList.includes(v.type)) return false;
        if (seenViolationTypes.has(v.type)) return false;
        seenViolationTypes.add(v.type);
        return meetsConfidenceThreshold(v);
      });
      
      if (uniqueViolations.length > 0 && violationThumbnails && Object.keys(violationThumbnails).length > 0) {
        if (yPos > 180) {
          doc.addPage();
          yPos = 20;
        }
        
        yPos = drawCard('Violation Evidence (Screenshots)', [239, 68, 68], yPos);
        
        for (const violation of uniqueViolations) {
          if (yPos > 220) {
            doc.addPage();
            yPos = 20;
          }
          
          const thumbnails = violationThumbnails[violation.type];
          const hasThumbnails = thumbnails && (thumbnails.camera || thumbnails.screen);
          
          // Violation header
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(220, 38, 38);
          const violationLabel = violation.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          doc.text(`⚠ ${violationLabel}`, margin + 5, yPos + 5);
          
          // Severity badge
          doc.setFontSize(7);
          doc.setFont(undefined, 'normal');
          const severityColor = violation.severity === 'high' ? [220, 38, 38] : violation.severity === 'medium' ? [234, 179, 8] : [100, 116, 139];
          doc.setTextColor(severityColor[0], severityColor[1], severityColor[2]);
          doc.text(`[${violation.severity?.toUpperCase() || 'MEDIUM'}]`, margin + 80, yPos + 5);
          
          // Timestamp
          doc.setTextColor(100, 116, 139);
          const videoTs = typeof violation.timestamp === 'number' 
            ? `${Math.floor(violation.timestamp / 60)}:${String(Math.floor(violation.timestamp % 60)).padStart(2, '0')} in video`
            : (violation.videoTimestamp 
              ? `${Math.floor(violation.videoTimestamp / 60)}:${String(Math.floor(violation.videoTimestamp % 60)).padStart(2, '0')} in video`
              : '');
          if (videoTs) {
            doc.text(videoTs, margin + 110, yPos + 5);
          }
          
          yPos += 8;
          
          // Details text
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          const detailLines = doc.splitTextToSize(violation.details || violation.description || '', contentWidth - 10);
          detailLines.slice(0, 2).forEach((line: string) => {
            doc.text(line, margin + 5, yPos + 3);
            yPos += 4;
          });
          
          // Embed thumbnails if available
          if (hasThumbnails) {
            yPos += 2;
            let thumbX = margin + 5;
            const thumbWidth = 45;
            const thumbHeight = 30;
            
            try {
              if (thumbnails.camera) {
                doc.addImage(thumbnails.camera, 'JPEG', thumbX, yPos, thumbWidth, thumbHeight);
                doc.setFontSize(6);
                doc.setTextColor(100, 116, 139);
                doc.text('Camera', thumbX, yPos + thumbHeight + 3);
                thumbX += thumbWidth + 5;
              }
              
              if (thumbnails.screen) {
                doc.addImage(thumbnails.screen, 'JPEG', thumbX, yPos, thumbWidth, thumbHeight);
                doc.setFontSize(6);
                doc.setTextColor(100, 116, 139);
                doc.text('Screen', thumbX, yPos + thumbHeight + 3);
              }
              
              yPos += thumbHeight + 8;
            } catch (imgErr) {
              logger.error('Failed to add thumbnail to PDF:', imgErr);
              yPos += 5;
            }
          }
          
          yPos += 5;
        }
      }
    }

    // Topic-wise Performance (moved to end of report)
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos = drawCard('Topic-wise Performance', [139, 92, 246], yPos);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    Object.entries(assessment.topic_scores).forEach(([topic, score]: [string, any]) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFont(undefined, 'bold');
      doc.text(topic, margin + 5, yPos + 5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(99, 102, 241);
      doc.setFontSize(14);
      doc.text(`${score}%`, pageWidth - margin - 5, yPos + 5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      
      drawProgressBar(margin + 5, yPos + 8, contentWidth - 10, score);
      yPos += 18;
    });
    
    yPos += 5;

    // Recording Links Section - REMOVED (now in Candidate Information)

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Page ${i} of ${pageCount} | Generated by TalentGeenie`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Generate standardized filename: OrgName - InterviewTitle Assessment Report - CandidateName
    const orgName = interview.organizations?.name || 'Assessment';
    const interviewTitle = interview.title || 'Interview';
    const candidateName = attempt.candidate_name || 'Candidate';
    const suffix = includeQuestions ? '' : ' Summary';
    const sanitize = (str: string) => str.replace(/[<>:"/\\|?*]/g, '').trim();
    const fileName = `${sanitize(orgName)} - ${sanitize(interviewTitle)} Assessment Report${suffix} - ${sanitize(candidateName)}.pdf`;
    doc.save(fileName);
    
    toast({
      title: "Downloaded",
      description: `PDF report ${includeQuestions ? 'with Q&A' : 'summary'} downloaded successfully`,
    });
  };

  const downloadWordReport = async (includeQuestions: boolean = true) => {
    try {
      // Generate shareable links first
      const recordingLinks = await generateShareableLinks();
      // Use CPI hiring_recommendation as source of truth, fallback to assessment.hiring_decision
      const effectiveHiringDecision = cpiData?.hiring_recommendation || assessment.hiring_decision;
      const decisionInfo = getHiringDecisionInfo(effectiveHiringDecision);
      
      // Calculate integrity score from detailed_violations (filtering out ignored violations)
      const allDetailedViolations = proctoringSession?.detailed_violations || [];
      const ignoredList: string[] = Array.isArray(proctoringSession?.ignored_violations) 
        ? (proctoringSession.ignored_violations as string[]) 
        : [];
      const integrityScore = calculateIntegrityFromViolations(allDetailedViolations as any[], proctoringSession?.integrity_score, ignoredList);
      
      // Load violation thumbnails for Word embedding (same as PDF)
      let violationThumbnailsWord: Record<string, { camera?: string; screen?: string }> = {};
      if (proctoringSession?.detailed_violations) {
        violationThumbnailsWord = await loadViolationThumbnails(
          proctoringSession.detailed_violations as any[],
          ignoredList
        );
      }
      
      // Get dynamic colors from design system
      const colors = getExportColors();
      const decisionColorSet = getDecisionColors(assessment.hiring_decision);
      
      const children: (Paragraph | Table)[] = [];

      // Helper: Create a styled section header (mimics PDF's drawCard)
      const createSectionHeader = (title: string, bgColor: string): Paragraph => {
        return new Paragraph({
          children: [
            new TextRun({
              text: `  ${title}`,
              bold: true,
              color: 'FFFFFF',
              size: 26,
            }),
          ],
          shading: createShading(bgColor),
          spacing: { before: 300, after: 150 },
          border: {
            top: { style: BorderStyle.SINGLE, size: 1, color: bgColor },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: bgColor },
            left: { style: BorderStyle.SINGLE, size: 1, color: bgColor },
            right: { style: BorderStyle.SINGLE, size: 1, color: bgColor },
          },
        });
      };

      // Helper: Create info row for candidate details
      const createInfoRow = (label: string, value: string): Paragraph => {
        return new Paragraph({
          children: [
            new TextRun({ text: label, bold: true, size: 22, color: '475569' }),
            new TextRun({ text: '   ', size: 22 }),
            new TextRun({ text: value, size: 22, color: '1E293B' }),
          ],
          spacing: { before: 80, after: 80 },
          indent: { left: 300 },
        });
      };

      // ═══════════════════════════════════════════════════════════════════════
      // HEADER SECTION (Gray background, centered title)
      // ═══════════════════════════════════════════════════════════════════════
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'Interview Assessment Report',
                          bold: true,
                          size: 52,
                          color: colors.primaryForeground,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 300, after: 120 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'AI-Generated Evaluation',
                          color: colors.primaryForeground,
                          size: 22,
                          italics: true,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 80 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: new Date().toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          }),
                          color: colors.primaryForeground,
                          size: 20,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 300 },
                    }),
                  ],
                  shading: createShading(colors.primary),
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: colors.primary },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.primary },
                    left: { style: BorderStyle.SINGLE, size: 1, color: colors.primary },
                    right: { style: BorderStyle.SINGLE, size: 1, color: colors.primary },
                  },
                }),
              ],
            }),
          ],
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
        })
      );

      // ═══════════════════════════════════════════════════════════════════════
      // CANDIDATE INFORMATION SECTION
      // ═══════════════════════════════════════════════════════════════════════
      children.push(createSectionHeader('Candidate Information', colors.primary));

      // Candidate info in a clean table layout
      const candidateInfoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Name:', bold: true, size: 22, color: colors.mutedForeground })] })],
                width: { size: 20, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                margins: { top: 100, bottom: 100, left: 200 },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: attempt.candidate_name, size: 22, color: colors.foreground, bold: true })] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                margins: { top: 100, bottom: 100 },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Email:', bold: true, size: 22, color: colors.mutedForeground })] })],
                width: { size: 15, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                margins: { top: 100, bottom: 100 },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: attempt.candidate_email, size: 22, color: colors.foreground })] })],
                width: { size: 35, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                margins: { top: 100, bottom: 100 },
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Interview:', bold: true, size: 22, color: colors.mutedForeground })] })],
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                margins: { top: 100, bottom: 100, left: 200 },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: interview.title, size: 22, color: colors.foreground })] })],
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                margins: { top: 100, bottom: 100 },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Date:', bold: true, size: 22, color: colors.mutedForeground })] })],
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                margins: { top: 100, bottom: 100 },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: new Date(attempt.created_at).toLocaleDateString(), size: 22, color: colors.foreground })] })],
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                margins: { top: 100, bottom: 100 },
              }),
            ],
          }),
        ],
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
      });
      children.push(candidateInfoTable);

      // Recording links (if available) - with proper hyperlinks
      if (recordingLinks.screen || recordingLinks.video) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Session Recordings:', bold: true, size: 22, color: colors.mutedForeground }),
            ],
            spacing: { before: 200, after: 120 },
            indent: { left: 300 },
          })
        );

        if (recordingLinks.screen) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '    ', size: 24 }),
                new ExternalHyperlink({
                  children: [
                    new TextRun({
                      text: 'View Screen Recording',
                      style: 'Hyperlink',
                      size: 24,
                      color: colors.primary,
                      underline: { type: 'single' },
                    }),
                  ],
                  link: recordingLinks.screen,
                }),
                new TextRun({ text: '  (valid 7 days)', size: 18, color: colors.mutedForeground, italics: true }),
              ],
              spacing: { after: 100 },
              indent: { left: 400 },
            })
          );
        }

        if (recordingLinks.video) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '    ', size: 24 }),
                new ExternalHyperlink({
                  children: [
                    new TextRun({
                      text: 'View Camera Recording',
                      style: 'Hyperlink',
                      size: 24,
                      color: colors.primary,
                      underline: { type: 'single' },
                    }),
                  ],
                  link: recordingLinks.video,
                }),
                new TextRun({ text: '  (valid 7 days)', size: 18, color: colors.mutedForeground, italics: true }),
              ],
              spacing: { after: 140 },
              indent: { left: 400 },
            })
          );
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // OVERALL ASSESSMENT CARD (Color-coded decision box)
      // ═══════════════════════════════════════════════════════════════════════
      // Use dynamic decision colors from design system
      const decisionColor = decisionColorSet.bg;

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: decisionInfo.label.toUpperCase(),
                          bold: true,
                          color: 'FFFFFF',
                          size: 36,
                        }),
                      ],
                      spacing: { after: 80 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: decisionInfo.description,
                          color: 'FFFFFF',
                          size: 20,
                          italics: true,
                        }),
                      ],
                    }),
                  ],
                  width: { size: 65, type: WidthType.PERCENTAGE },
                  shading: createShading(decisionColor),
                  margins: { top: 200, bottom: 200, left: 300, right: 100 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: decisionColor },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: decisionColor },
                    left: { style: BorderStyle.SINGLE, size: 1, color: decisionColor },
                    right: { style: BorderStyle.NONE },
                  },
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `${assessment.overall_score}%`,
                          bold: true,
                          color: 'FFFFFF',
                          size: 72,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'Overall Score',
                          color: 'FFFFFF',
                          size: 20,
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  width: { size: 35, type: WidthType.PERCENTAGE },
                  shading: createShading(decisionColor),
                  margins: { top: 200, bottom: 200, left: 100, right: 300 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: decisionColor },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: decisionColor },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.SINGLE, size: 1, color: decisionColor },
                  },
                }),
              ],
            }),
          ],
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
        })
      );

      // ═══════════════════════════════════════════════════════════════════════
      // KEY STRENGTHS
      // ═══════════════════════════════════════════════════════════════════════
      children.push(createSectionHeader('Key Strengths', colors.success));

      assessment.strengths.forEach((strength: string) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '  ✓  ', color: colors.success, bold: true, size: 26 }),
              new TextRun({ text: strength, size: 22, color: colors.foreground }),
            ],
            spacing: { before: 80, after: 80 },
            indent: { left: 200 },
            shading: createShading('F0FDF4'),
            border: {
              left: { style: BorderStyle.SINGLE, size: 24, color: colors.success },
            },
          })
        );
      });

      // ═══════════════════════════════════════════════════════════════════════
      // AREAS FOR IMPROVEMENT
      // ═══════════════════════════════════════════════════════════════════════
      children.push(createSectionHeader('Areas for Improvement', colors.warning));

      assessment.weaknesses.forEach((weakness: string) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '  ⚠  ', color: colors.warning, bold: true, size: 26 }),
              new TextRun({ text: weakness, size: 22, color: colors.foreground }),
            ],
            spacing: { before: 80, after: 80 },
            indent: { left: 200 },
            shading: createShading('FEFCE8'),
            border: {
              left: { style: BorderStyle.SINGLE, size: 24, color: colors.warning },
            },
          })
        );
      });

      // ═══════════════════════════════════════════════════════════════════════
      // DETAILED ANALYSIS
      // ═══════════════════════════════════════════════════════════════════════
      children.push(createSectionHeader('Detailed Analysis', colors.mutedForeground));

      let cleanedDetailedAnalysis = assessment.detailed_analysis || '';
      cleanedDetailedAnalysis = cleanedDetailedAnalysis.replace(/\[Video Analysis Update:[^\]]*\]/g, '').trim();
      cleanedDetailedAnalysis = cleanedDetailedAnalysis.split('\n')
        .filter((line: string) => !line.trim().startsWith('[Video Analysis'))
        .join('\n')
        .trim();

      // Split into paragraphs and add proper spacing
      cleanedDetailedAnalysis.split('\n\n').forEach((paragraph: string) => {
        if (paragraph.trim()) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: paragraph.trim(), size: 22, color: colors.foreground })],
              spacing: { before: 100, after: 150 },
              indent: { left: 200, right: 200 },
            })
          );
        }
      });

      // ═══════════════════════════════════════════════════════════════════════
      // QUESTIONS & CANDIDATE RESPONSES
      // ═══════════════════════════════════════════════════════════════════════
      if (includeQuestions && questions && questions.length > 0) {
        children.push(createSectionHeader('Questions & Candidate Responses', colors.primary));

        questions.forEach((question: any, index: number) => {
          // Question box with number
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: `Q${index + 1}`, bold: true, color: colors.primaryForeground, size: 24 })],
                        alignment: AlignmentType.CENTER,
                      })],
                      width: { size: 8, type: WidthType.PERCENTAGE },
                      shading: createShading(colors.primary),
                      margins: { top: 100, bottom: 100, left: 50, right: 50 },
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: colors.primary },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.primary },
                        left: { style: BorderStyle.SINGLE, size: 1, color: colors.primary },
                        right: { style: BorderStyle.NONE },
                      },
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ 
                          children: [new TextRun({ text: question.question_text, bold: true, size: 22, color: colors.foreground })],
                          spacing: { after: 60 },
                        }),
                        new Paragraph({ 
                          children: [
                            new TextRun({ text: `${question.question_type?.toUpperCase() || 'N/A'}`, size: 16, color: colors.primary, bold: true }),
                            new TextRun({ text: '  •  ', size: 16, color: colors.mutedForeground }),
                            new TextRun({ text: `${question.difficulty || 'N/A'}`, size: 16, color: colors.mutedForeground }),
                            new TextRun({ text: '  •  ', size: 16, color: colors.mutedForeground }),
                            new TextRun({ text: `${question.topic || 'N/A'}`, size: 16, color: colors.mutedForeground }),
                          ],
                        }),
                      ],
                      width: { size: 92, type: WidthType.PERCENTAGE },
                      shading: createShading(colors.secondary),
                      margins: { top: 100, bottom: 100, left: 150, right: 150 },
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: colors.border },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.SINGLE, size: 1, color: colors.border },
                      },
                    }),
                  ],
                }),
              ],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
              },
            })
          );

          // Candidate's answer
          const answers = attempt.answers as Record<string, any>;
          const candidateAnswer = answers?.[question.id];

          let answerText = 'No answer provided';
          if (candidateAnswer) {
            if (question.question_type === 'mcq') {
              answerText = candidateAnswer.selected_option || candidateAnswer || 'No selection';
            } else if (question.question_type === 'coding') {
              answerText = candidateAnswer.code || candidateAnswer || 'No code submitted';
            } else {
              answerText = candidateAnswer.answer || candidateAnswer || 'No answer';
            }
          }

          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Candidate Answer:', bold: true, color: colors.mutedForeground, size: 20 }),
              ],
              spacing: { before: 150, after: 80 },
              indent: { left: 300 },
            })
          );

          children.push(
            new Paragraph({
              children: [new TextRun({ text: String(answerText).substring(0, 1500), size: 20, color: colors.foreground })],
              spacing: { before: 60, after: 100 },
              indent: { left: 400, right: 200 },
              shading: createShading(colors.secondary),
              border: {
                left: { style: BorderStyle.SINGLE, size: 16, color: colors.mutedForeground },
              },
            })
          );

          // Correct answer for MCQ
          if (question.question_type === 'mcq' && question.correct_answer) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '✓ Correct Answer: ', bold: true, color: colors.success, size: 20 }),
                  new TextRun({ text: question.correct_answer, color: colors.success, size: 20 }),
                ],
                spacing: { before: 60, after: 200 },
                indent: { left: 300 },
              })
            );
          } else {
            children.push(new Paragraph({ children: [], spacing: { after: 150 } }));
          }
        });
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PROCTORING & INTEGRITY REPORT
      // ═══════════════════════════════════════════════════════════════════════
      if (proctoringSession) {
        children.push(createSectionHeader('Proctoring & Integrity Report', colors.accent));

        const scoreColor = integrityScore >= 90 ? colors.success : integrityScore >= 70 ? colors.warning : colors.destructive;
        const statusText = integrityScore >= 90 ? 'Excellent' : integrityScore >= 70 ? 'Good' : 'Needs Review';
        const statusBg = integrityScore >= 90 ? 'F0FDF4' : integrityScore >= 70 ? 'FEFCE8' : 'FEF2F2';

        // Integrity score card
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'Overall Integrity Score', size: 20, color: colors.mutedForeground }),
                        ],
                        spacing: { after: 50 },
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: `${integrityScore}%`, bold: true, color: scoreColor, size: 56 }),
                          new TextRun({ text: `   ${statusText}`, color: scoreColor, size: 24, bold: true }),
                        ],
                      }),
                    ],
                    shading: createShading(statusBg),
                    margins: { top: 150, bottom: 150, left: 250, right: 250 },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: scoreColor },
                      bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.border },
                      left: { style: BorderStyle.SINGLE, size: 4, color: scoreColor },
                      right: { style: BorderStyle.SINGLE, size: 1, color: colors.border },
                    },
                  }),
                ],
              }),
            ],
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
          })
        );

        // Pre-interview Checks
        const preChecks = [
          { label: 'Camera', passed: proctoringSession.camera_check_passed !== false },
          { label: 'Audio', passed: proctoringSession.audio_check_passed !== false },
          { label: 'Lighting', passed: proctoringSession.lighting_check_passed !== false },
          { label: 'Screen Share', passed: proctoringSession.screen_share_active !== false }
        ];

        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Pre-Interview Checks:   ', bold: true, size: 20, color: colors.mutedForeground }),
              ...preChecks.map(check => new TextRun({ 
                text: `${check.passed ? '✓' : '✗'} ${check.label}   `, 
                color: check.passed ? colors.success : colors.destructive,
                size: 20,
                bold: true,
              })),
            ],
            spacing: { before: 200, after: 150 },
            indent: { left: 200 },
          })
        );

        // Integrity checks table header
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Complete Integrity Checks:', bold: true, size: 22, color: '1E293B' }),
            ],
            spacing: { before: 200, after: 100 },
            indent: { left: 200 },
          })
        );

        const integrityCheckData = getIntegrityChecksPDFData(proctoringSession.detailed_violations || [], ignoredList);

        // Create table for integrity checks
        const checkTableRows = integrityCheckData.map(check => {
          const isFail = check.status === 'FAIL';
          return new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ 
                  children: [
                    new TextRun({ text: isFail ? '✗' : '✓', bold: true, color: isFail ? 'EF4444' : '22C55E', size: 22 }),
                  ],
                  alignment: AlignmentType.CENTER,
                })],
                width: { size: 5, type: WidthType.PERCENTAGE },
                shading: isFail ? createShading('FEF2F2') : undefined,
                margins: { top: 60, bottom: 60 },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ text: check.name, size: 18, color: isFail ? 'EF4444' : '334155', bold: isFail })],
                })],
                width: { size: 40, type: WidthType.PERCENTAGE },
                shading: isFail ? createShading('FEF2F2') : undefined,
                margins: { top: 60, bottom: 60, left: 100 },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ text: check.category, size: 16, color: '64748B' })],
                })],
                width: { size: 20, type: WidthType.PERCENTAGE },
                shading: isFail ? createShading('FEF2F2') : undefined,
                margins: { top: 60, bottom: 60 },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ text: check.status, bold: true, size: 16, color: isFail ? 'EF4444' : '22C55E' })],
                  alignment: AlignmentType.CENTER,
                })],
                width: { size: 15, type: WidthType.PERCENTAGE },
                shading: isFail ? createShading('FEF2F2') : undefined,
                margins: { top: 60, bottom: 60 },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              }),
              new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ 
                    text: check.count > 0 ? `${check.count}x` : '-', 
                    size: 16, 
                    color: check.count > 0 ? 'EF4444' : '94A3B8',
                    bold: check.count > 0,
                  })],
                  alignment: AlignmentType.CENTER,
                })],
                width: { size: 10, type: WidthType.PERCENTAGE },
                shading: isFail ? createShading('FEF2F2') : undefined,
                margins: { top: 60, bottom: 60 },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              }),
            ],
          });
        });

        // Add header row
        const headerRow = new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [] })],
              width: { size: 5, type: WidthType.PERCENTAGE },
              shading: createShading('F1F5F9'),
              margins: { top: 60, bottom: 60 },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Check', bold: true, size: 18, color: '475569' })] })],
              width: { size: 40, type: WidthType.PERCENTAGE },
              shading: createShading('F1F5F9'),
              margins: { top: 60, bottom: 60, left: 100 },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true, size: 18, color: '475569' })] })],
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: createShading('F1F5F9'),
              margins: { top: 60, bottom: 60 },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true, size: 18, color: '475569' })], alignment: AlignmentType.CENTER })],
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: createShading('F1F5F9'),
              margins: { top: 60, bottom: 60 },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Count', bold: true, size: 18, color: '475569' })], alignment: AlignmentType.CENTER })],
              width: { size: 10, type: WidthType.PERCENTAGE },
              shading: createShading('F1F5F9'),
              margins: { top: 60, bottom: 60 },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
          ],
        });

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...checkTableRows],
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
          })
        );
      }

      // ═══════════════════════════════════════════════════════════════════════
      // VIOLATION EVIDENCE WITH SCREENSHOTS (same as PDF)
      // ═══════════════════════════════════════════════════════════════════════
      if (proctoringSession) {
        // Filter and dedupe violations (same logic as PDF)
        const seenViolationTypes = new Set<string>();
        const uniqueViolations = (allDetailedViolations as any[]).filter((v: any) => {
          if (ignoredList.includes(v.type)) return false;
          if (seenViolationTypes.has(v.type)) return false;
          seenViolationTypes.add(v.type);
          return meetsConfidenceThreshold(v);
        });

        if (uniqueViolations.length > 0 && violationThumbnailsWord && Object.keys(violationThumbnailsWord).length > 0) {
          children.push(createSectionHeader('Violation Evidence (Screenshots)', colors.destructive));

          for (const violation of uniqueViolations) {
            const thumbnails = violationThumbnailsWord[violation.type];
            const hasThumbnails = thumbnails && (thumbnails.camera || thumbnails.screen);
            
            const violationLabel = violation.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const severityColor = violation.severity === 'high' ? 'DC2626' : violation.severity === 'medium' ? 'EAB308' : '64748B';
            
            // Violation header with severity
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '⚠ ', color: 'DC2626', size: 22 }),
                  new TextRun({ text: violationLabel, bold: true, color: 'DC2626', size: 22 }),
                  new TextRun({ text: `  [${(violation.severity || 'MEDIUM').toUpperCase()}]`, color: severityColor, size: 18, bold: true }),
                  new TextRun({ 
                    text: typeof violation.timestamp === 'number' 
                      ? `  ${Math.floor(violation.timestamp / 60)}:${String(Math.floor(violation.timestamp % 60)).padStart(2, '0')} in video`
                      : (violation.videoTimestamp 
                        ? `  ${Math.floor(violation.videoTimestamp / 60)}:${String(Math.floor(violation.videoTimestamp % 60)).padStart(2, '0')} in video`
                        : ''),
                    color: '64748B',
                    size: 18,
                    italics: true,
                  }),
                ],
                spacing: { before: 200, after: 80 },
                indent: { left: 200 },
              })
            );

            // Violation details
            if (violation.details || violation.description) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: (violation.details || violation.description || '').substring(0, 300), 
                      size: 20, 
                      color: '475569' 
                    }),
                  ],
                  spacing: { after: 100 },
                  indent: { left: 300 },
                })
              );
            }

            // Add thumbnails if available
            if (hasThumbnails) {
              const imageChildren: (TextRun | ImageRun)[] = [];
              
              // Helper to convert base64 to Uint8Array (browser compatible)
              const base64ToUint8Array = (base64: string): Uint8Array => {
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                return bytes;
              };
              
              try {
                if (thumbnails.camera) {
                  // Convert base64 to Uint8Array for docx (browser compatible)
                  const base64Data = thumbnails.camera.replace(/^data:image\/\w+;base64,/, '');
                  imageChildren.push(
                    new ImageRun({
                      type: 'jpg',
                      data: base64ToUint8Array(base64Data),
                      transformation: {
                        width: 180,
                        height: 120,
                      },
                    })
                  );
                  imageChildren.push(new TextRun({ text: '  Camera  ', size: 16, color: '64748B' }));
                }

                if (thumbnails.screen) {
                  const base64Data = thumbnails.screen.replace(/^data:image\/\w+;base64,/, '');
                  imageChildren.push(
                    new ImageRun({
                      type: 'jpg',
                      data: base64ToUint8Array(base64Data),
                      transformation: {
                        width: 180,
                        height: 120,
                      },
                    })
                  );
                  imageChildren.push(new TextRun({ text: '  Screen', size: 16, color: '64748B' }));
                }

                if (imageChildren.length > 0) {
                  children.push(
                    new Paragraph({
                      children: imageChildren,
                      spacing: { before: 80, after: 150 },
                      indent: { left: 300 },
                    })
                  );
                }
              } catch (imgErr) {
                logger.error('Failed to add thumbnail to Word:', imgErr);
              }
            }
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // TOPIC-WISE PERFORMANCE (moved to end of report)
      // ═══════════════════════════════════════════════════════════════════════
      children.push(createSectionHeader('Topic-wise Performance', colors.accent));

      // Create a table for topic scores with visual bars
      const topicRows = Object.entries(assessment.topic_scores).map(([topic, score]: [string, any]) => {
        // Visual representation of score using block characters
        const filledBlocks = Math.round(score / 10);
        const emptyBlocks = 10 - filledBlocks;
        const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
        
        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: topic, bold: true, size: 22, color: colors.foreground })],
                spacing: { before: 50, after: 50 },
              })],
              width: { size: 35, type: WidthType.PERCENTAGE },
              margins: { left: 200, top: 80, bottom: 80 },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.secondary }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: progressBar, size: 20, color: colors.primary })],
                spacing: { before: 50, after: 50 },
              })],
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80 },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.secondary }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: `${score}%`, bold: true, size: 28, color: colors.primary })],
                alignment: AlignmentType.RIGHT,
                spacing: { before: 50, after: 50 },
              })],
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { right: 200, top: 80, bottom: 80 },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: colors.secondary }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
          ],
        });
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: topicRows,
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
        })
      );

      // ═══════════════════════════════════════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════════════════════════════════════
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '━'.repeat(60),
              color: 'E5E7EB',
            }),
          ],
          spacing: { before: 400 },
          alignment: AlignmentType.CENTER,
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated by TalentGeenie  •  ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}`,
              size: 18,
              color: '9CA3AF',
              italics: true,
            }),
          ],
          spacing: { before: 100, after: 200 },
          alignment: AlignmentType.CENTER,
        })
      );

      // Create document with proper page margins
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 720,    // 0.5 inch
                  right: 720,
                  bottom: 720,
                  left: 720,
                },
              },
            },
            children: children,
          },
        ],
      });

      // Generate and download
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Generate standardized filename: OrgName - InterviewTitle Assessment Report - CandidateName
      const orgName = interview.organizations?.name || 'Assessment';
      const interviewTitle = interview.title || 'Interview';
      const candidateName = attempt.candidate_name || 'Candidate';
      const suffix = includeQuestions ? '' : ' Summary';
      const sanitize = (str: string) => str.replace(/[<>:"/\\|?*]/g, '').trim();
      link.download = `${sanitize(orgName)} - ${sanitize(interviewTitle)} Assessment Report${suffix} - ${sanitize(candidateName)}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: `Word document ${includeQuestions ? 'with Q&A' : 'summary'} downloaded successfully`,
      });
    } catch (error) {
      logger.error('Error exporting to Word:', error);
      toast({
        title: "Error",
        description: "Failed to export Word document",
        variant: "destructive",
      });
    }
  };

  const handleReEvaluate = async () => {
    if (!attempt?.id) return;
    
    setReEvaluating(true);
    try {
      // Step 1: Run video analysis first to capture new violations, screenshots, audio transcription
      toast({
        title: "Analyzing Recording",
        description: "Running AI analysis on proctoring video...",
      });
      
      const { error: analysisError } = await invokeFunction('analyze-proctoring-video', {
        body: { attemptId: attempt.id }
      });
      
      if (analysisError) {
        logger.warn('Video analysis warning (may not have recording):', analysisError);
        // Continue with evaluation even if video analysis fails
      }
      
      // Step 2: Re-evaluate interview with updated integrity data
      toast({
        title: "Re-evaluating",
        description: "Calculating scores with updated integrity data (this may take 1-2 minutes)...",
      });
      
      const { data, error } = await invokeFunction('evaluate-interview', {
        body: { attemptId: attempt.id }
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
        title: "Re-evaluation Complete",
        description: "Assessment re-evaluated with AI video analysis.",
      });

      // Refresh the assessment data
      await fetchAssessment();
    } catch (err: any) {
      logger.error('Re-evaluation error:', err);
      toast({
        title: "Re-evaluation Failed",
        description: err.message || "Failed to re-evaluate the assessment",
        variant: "destructive",
      });
    } finally {
      setReEvaluating(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading assessment...</div>;
  }

  // Guard against null assessment data
  if (!assessment || !attempt || !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Assessment data not available</p>
          <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
        </div>
      </div>
    );
  }

  // Use CPI hiring_recommendation as source of truth, fallback to assessment.hiring_decision
  const effectiveHiringDecision = cpiData?.hiring_recommendation || assessment.hiring_decision;
  const decisionInfo = getHiringDecisionInfo(effectiveHiringDecision);

  return (
    <div className="max-w-5xl mx-auto space-y-6 overflow-x-hidden">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button onClick={() => navigate(-1)} variant="outline" size="sm" className="min-h-[44px] sm:min-h-auto">
              Back
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Assessment Report</h1>
              <p className="text-muted-foreground text-xs sm:text-sm md:text-base">Detailed evaluation results</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleReEvaluate} 
              variant="outline"
              disabled={reEvaluating}
              size="sm"
              className="min-h-[44px] text-xs sm:text-sm"
            >
              <RefreshCw className={`w-4 h-4 mr-1 sm:mr-2 ${reEvaluating ? 'animate-spin' : ''}`} />
              {reEvaluating ? 'Re-evaluating...' : 'Re-evaluate'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="min-h-[44px] text-xs sm:text-sm">
                  <FileText className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Download </span>PDF
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadPDFReport(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Full Report (with Q&A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadPDFReport(false)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Summary (without Q&A)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-[44px] text-xs sm:text-sm">
                  <Download className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Download </span>Word
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadWordReport(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Full Report (with Q&A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadWordReport(false)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Summary (without Q&A)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid gap-6 overflow-hidden">
          {/* Candidate Info with Session Recordings */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Candidate Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 overflow-hidden">
              {/* Candidate Details Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-semibold break-words">{attempt.candidate_name}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-semibold truncate" title={attempt.candidate_email}>{attempt.candidate_email}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Interview</p>
                  <p className="font-semibold break-words">{interview.title}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold">{new Date(attempt.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Session Recordings - Integrated */}
              {proctoringSession && (proctoringSession.screen_recording_url || proctoringSession.video_recording_url) && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Video className="h-5 w-5 text-muted-foreground" />
                    <h4 className="font-semibold">Session Recordings</h4>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Screen Recording */}
                    {proctoringSession.screen_recording_url && (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          Screen
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={openRecordingDialog} variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          <Button 
                            onClick={() => getShareableLink('screen')} 
                            variant="outline" 
                            size="sm"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Link (7 days)
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Camera Recording */}
                    {proctoringSession.video_recording_url && (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Camera className="h-4 w-4 text-muted-foreground" />
                          Camera
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const { data } = await supabase.storage
                                  .from('proctoring-recordings')
                                  .createSignedUrl(proctoringSession.video_recording_url, 3600);
                                if (data?.signedUrl) {
                                  window.open(data.signedUrl, '_blank');
                                }
                              } catch (err) {
                                toast({ title: "Error", description: "Failed to load video", variant: "destructive" });
                              }
                            }}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          <Button 
                            onClick={() => getShareableLink('video')} 
                            variant="outline" 
                            size="sm"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Link (7 days)
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Specific error messages for missing recordings based on session state */}
          {interview.proctoring_enabled && proctoringSession && !proctoringSession.screen_recording_url && !proctoringSession.video_recording_url && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Recordings Not Available</strong>
                <div className="mt-2 space-y-1 text-sm">
                  {/* Priority 1: Use dedicated upload_error if available */}
                  {proctoringSession.upload_error ? (
                    <>
                      <p><strong>Cause:</strong> Upload failed</p>
                      <p><strong>Error:</strong> {proctoringSession.upload_error}</p>
                      {proctoringSession.upload_started_at && (
                        <p><strong>Upload started:</strong> {new Date(proctoringSession.upload_started_at).toLocaleString()}</p>
                      )}
                    </>
                  ) : proctoringSession.upload_status === 'failed' ? (
                    <>
                      <p><strong>Cause:</strong> Upload failed (unknown error)</p>
                      <p><strong>Detail:</strong> The recording upload process failed but no specific error was captured.</p>
                    </>
                  ) : attempt.status === 'terminated' ? (
                    <>
                      <p><strong>Cause:</strong> Session terminated by candidate</p>
                      <p><strong>Detail:</strong> The interview was auto-submitted when the candidate closed the browser tab or navigated away. Video recordings in browser memory were lost before upload could start.</p>
                      <p><strong>Status:</strong> {proctoringSession.upload_status || 'Upload never initiated'}</p>
                    </>
                  ) : attempt.status === 'pending_upload' ? (
                    <>
                      <p><strong>Cause:</strong> Upload interrupted</p>
                      <p><strong>Detail:</strong> The candidate submitted the interview but closed the browser before video files finished uploading.</p>
                      {proctoringSession.upload_started_at ? (
                        <p><strong>Upload started:</strong> {new Date(proctoringSession.upload_started_at).toLocaleString()} (never completed)</p>
                      ) : (
                        <p><strong>Status:</strong> Upload was never initiated</p>
                      )}
                    </>
                  ) : proctoringSession.upload_status === 'uploading' ? (
                    <>
                      <p><strong>Cause:</strong> Upload in progress but never completed</p>
                      <p><strong>Detail:</strong> Upload started at {proctoringSession.upload_started_at ? new Date(proctoringSession.upload_started_at).toLocaleString() : 'unknown time'} but was interrupted (possible network failure or browser closure).</p>
                    </>
                  ) : proctoringSession.ended_at ? (
                    <>
                      <p><strong>Cause:</strong> Session ended without recording upload</p>
                      <p><strong>Detail:</strong> Proctoring session ended at {new Date(proctoringSession.ended_at).toLocaleString()} but no upload was attempted. This may indicate a recording initialization failure.</p>
                    </>
                  ) : (
                    <>
                      <p><strong>Cause:</strong> Session ended abnormally</p>
                      <p><strong>Detail:</strong> The proctoring session did not end properly. The candidate may have experienced a browser crash, network disconnection, or closed the browser unexpectedly.</p>
                      <p><strong>Upload Status:</strong> {proctoringSession.upload_status || 'pending (never started)'}</p>
                    </>
                  )}
                  <p className="text-muted-foreground mt-2">Integrity violations detected during the live session (if any) are still available below.</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Warning for terminated attempts without missing recordings (edge case) */}
          {attempt.status === 'terminated' && (!interview.proctoring_enabled || (proctoringSession?.screen_recording_url || proctoringSession?.video_recording_url)) && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Interview Terminated:</strong> This interview was auto-submitted because the candidate closed or navigated away from the interview page. 
                Answers captured up to that point are included.
              </AlertDescription>
            </Alert>
          )}

          {/* Overall Score & Decision */}
          <Card className={`border-2 overflow-hidden ${decisionInfo.color}`}>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0">
                <div className="shrink-0">{decisionInfo.icon}</div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg sm:text-2xl break-words">{decisionInfo.label}</CardTitle>
                  <p className="mt-1 font-medium text-xs sm:text-sm opacity-90 break-words">
                    {decisionInfo.description}
                  </p>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-current/20 shrink-0">
                  <div className="text-3xl sm:text-4xl font-bold">{assessment.overall_score}%</div>
                  <p className="text-xs sm:text-sm opacity-80">Overall Score</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Topic Scores */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Topic-wise Performance</CardTitle>
              <CardDescription>Breakdown of scores by skill area</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 overflow-hidden">
              {Object.entries(assessment.topic_scores).map(([topic, score]: [string, any]) => (
                <div key={topic} className="space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="font-medium text-sm sm:text-base truncate min-w-0">{topic}</span>
                    <span className="text-lg sm:text-2xl font-bold text-primary shrink-0">{score}%</span>
                  </div>
                  <Progress value={score} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Strengths */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  <CardTitle>Key Strengths</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openFeedbackEdit('strengths')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit with AI
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <ul className="space-y-3">
                {assessment.strengths.map((strength: string, index: number) => (
                  <li key={index} className="flex items-start gap-3 min-w-0">
                    <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span className="break-words min-w-0">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Weaknesses */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-warning" />
                  <CardTitle>Areas for Improvement</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openFeedbackEdit('weaknesses')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit with AI
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <ul className="space-y-3">
                {assessment.weaknesses.map((weakness: string, index: number) => (
                  <li key={index} className="flex items-start gap-3 min-w-0">
                    <XCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                    <span className="break-words min-w-0">{weakness}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Detailed Analysis */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detailed Analysis</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openFeedbackEdit('detailed_analysis')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit with AI
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed break-words">
                {assessment.detailed_analysis}
              </p>
            </CardContent>
          </Card>

          {/* Feedback Edit Dialog */}
          <FeedbackEditDialog
            open={feedbackEditOpen}
            onOpenChange={setFeedbackEditOpen}
            section={editingSection}
            assessmentId={assessment.id}
            currentContent={
              editingSection === 'strengths' ? assessment.strengths :
              editingSection === 'weaknesses' ? assessment.weaknesses :
              assessment.detailed_analysis
            }
            context={{
              candidateName: attempt.candidate_name,
              interviewTitle: interview.title,
              overallScore: assessment.overall_score,
              topicScores: assessment.topic_scores,
            }}
            onUpdate={handleFeedbackUpdate}
          />

          {/* Questions and Answers */}
          {questions.length > 0 && (
            <QuestionResponseSection 
              questions={questions} 
              answers={attempt.answers || {}}
              questionScores={assessment?.question_scores as Record<string, { score: number; maxScore: number; reasoning: string; isCorrect: boolean }> | undefined}
            />
          )}

          {/* Proctoring Report - Integrated Section */}
          {proctoringSession && (
            <>
              {/* Overall Integrity Score */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 h-5" />
                        Proctoring & Integrity Report
                      </CardTitle>
                      <CardDescription>
                        Session monitoring and violation tracking
                      </CardDescription>
                    </div>
                    {(() => {
                      // Use displayIntegrityScore (which updates when ignoring violations)
                      const score = displayIntegrityScore ?? calculateIntegrityFromViolations(
                        Array.isArray(proctoringSession.detailed_violations) ? proctoringSession.detailed_violations : [], 
                        proctoringSession.integrity_score,
                        ignoredViolations
                      );
                      if (score >= 90) return <Badge className="bg-success/20 text-success border-success">Excellent</Badge>;
                      if (score >= 70) return <Badge className="bg-warning/20 text-warning border-warning">Good</Badge>;
                      return <Badge variant="destructive">Flagged</Badge>;
                    })()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      {(() => {
                        const score = displayIntegrityScore ?? calculateIntegrityFromViolations(
                          Array.isArray(proctoringSession.detailed_violations) ? proctoringSession.detailed_violations : [], 
                          proctoringSession.integrity_score,
                          ignoredViolations
                        );
                        return (
                          <>
                            <div className={`text-6xl font-bold ${score >= 90 ? 'text-success' : score >= 70 ? 'text-warning' : 'text-destructive'}`}>
                              {score.toFixed(0)}
                            </div>
                            <p className="text-muted-foreground mt-2">Integrity Score</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-4"
                              onClick={() => setProctoringReportOpen(true)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Full Proctoring Report
                            </Button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {proctoringSession.flagged_for_review && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        This session has been flagged for manual review due to multiple violations.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Complete Integrity Checks Summary */}
              <IntegrityChecksSummary 
                detailedViolations={proctoringSession.detailed_violations || []} 
                showAllChecks={true}
              />

              {/* Grouped Violations by Type */}
              {proctoringSession.detailed_violations && proctoringSession.detailed_violations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Violations by Type</CardTitle>
                    <CardDescription>Grouped violations with all occurrence timestamps</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 overflow-hidden">
                      {groupViolationsByType(proctoringSession.detailed_violations).map((grouped, index) => {
                        const isIgnored = ignoredViolations.includes(grouped.type);
                        const isToggling = togglingViolation === grouped.type;
                        
                        return (
                          <div key={index} className={`p-4 rounded-lg border overflow-hidden ${
                            isIgnored ? 'bg-muted/50 border-muted opacity-60' :
                            grouped.severity === 'high' ? 'bg-destructive/5 border-destructive/20' :
                            grouped.severity === 'medium' ? 'bg-warning/5 border-warning/20' :
                            'bg-card'
                          }`}>
                            {isIgnored && (
                              <div className="flex justify-end mb-2">
                                <Badge variant="outline" className="text-muted-foreground">
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  Ignored
                                </Badge>
                              </div>
                            )}
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-2 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                                <AlertTriangle className={`h-5 w-5 shrink-0 ${
                                  isIgnored ? 'text-muted-foreground' :
                                  grouped.severity === 'high' ? 'text-destructive' :
                                  grouped.severity === 'medium' ? 'text-warning' :
                                  'text-muted-foreground'
                                }`} />
                                <span className={`font-medium break-words ${isIgnored ? 'line-through' : ''}`}>{grouped.displayName}</span>
                                <Badge variant="outline" className={
                                  grouped.source === 'ai' 
                                    ? 'text-purple-600 border-purple-300 bg-purple-50 text-xs' 
                                    : 'text-blue-600 border-blue-300 bg-blue-50 text-xs'
                                }>
                                  {grouped.source === 'ai' ? '🤖 AI' : '📡 Live'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className={
                                  isIgnored ? 'text-muted-foreground' :
                                  grouped.severity === 'high' ? 'text-destructive border-destructive/30' :
                                  grouped.severity === 'medium' ? 'text-warning border-warning/30' :
                                  'text-muted-foreground'
                                }>
                                  {grouped.count}x
                                </Badge>
                                <Badge variant="outline" className={
                                  isIgnored ? 'text-muted-foreground' :
                                  grouped.severity === 'high' ? 'text-destructive border-destructive/30' :
                                  grouped.severity === 'medium' ? 'text-warning border-warning/30' :
                                  'text-primary border-primary/30'
                                }>
                                  {grouped.severity}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3 break-words overflow-hidden">{grouped.details}</p>
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {grouped.timestamps.map((ts, i) => (
                                <span key={i} className="text-xs px-2 py-1 bg-muted rounded-full">
                                  {Math.floor(ts.videoTimestamp / 60)}:{String(Math.round(ts.videoTimestamp % 60)).padStart(2, '0')}
                                  {ts.confidence && <span className="ml-1 text-muted-foreground">({Math.round(ts.confidence * 100)}%)</span>}
                                </span>
                              ))}
                            </div>
                            {/* Ignore/Restore Button */}
                            <div className="flex justify-end pt-3 border-t mt-3">
                              <Button
                                variant={isIgnored ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleViolationIgnored(grouped.type)}
                                disabled={isToggling}
                                className="shrink-0"
                              >
                                {isToggling ? (
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : isIgnored ? (
                                  <Eye className="w-4 h-4 mr-2" />
                                ) : (
                                  <EyeOff className="w-4 h-4 mr-2" />
                                )}
                                {isToggling ? "Updating..." : isIgnored ? "Restore Violation" : "Ignore Violation"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Session Recordings now merged into Candidate Information card at top */}
            </>
          )}
        </div>

        {/* Recording Dialog */}
        <Dialog open={recordingDialogOpen} onOpenChange={setRecordingDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Session Recording
              </DialogTitle>
              <DialogDescription>
                Screen recording with candidate video for {attempt?.candidate_name}
              </DialogDescription>
            </DialogHeader>
            
            {loadingRecording ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : screenRecordingUrl ? (
              <div className="space-y-4">
                <VideoPlayerWithControls
                  src={screenRecordingMemoryUrl || screenRecordingUrl}
                  posterSrc={screenRecordingPosterUrl || undefined}
                  errorHelpText="If playback fails or the screen stays black, click “Load into Memory”."
                  errorActions={
                    <Button
                      onClick={loadRecordingIntoMemory}
                      variant="secondary"
                      size="sm"
                      disabled={loadingRecordingIntoMemory}
                    >
                      {loadingRecordingIntoMemory ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Loading…
                        </>
                      ) : (
                        <>
                          <Monitor className="w-4 h-4 mr-2" />
                          Load into Memory
                        </>
                      )}
                    </Button>
                  }
                />

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                    <Button onClick={loadRecordingIntoMemory} variant="outline" size="sm" disabled={loadingRecordingIntoMemory}>
                      {loadingRecordingIntoMemory ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Loading…
                        </>
                      ) : (
                        <>
                          <Monitor className="w-4 h-4 mr-2" />
                          Load into Memory
                        </>
                      )}
                    </Button>
                  </div>

                  {loadingRecordingIntoMemory && (
                    <Progress value={recordingLoadProgress} />
                  )}

                  <p className="text-xs text-muted-foreground text-right">
                    This does not download a file; it temporarily streams the recording into browser memory.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recording available
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Full Proctoring Report Dialog */}
        <Dialog open={proctoringReportOpen} onOpenChange={setProctoringReportOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Full Proctoring Report
              </DialogTitle>
              <DialogDescription>
                Detailed violation timeline with screenshot evidence and video playback
              </DialogDescription>
            </DialogHeader>
            
            {proctoringSession && (
              <EnhancedProctoringReport session={proctoringSession} />
            )}
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default AssessmentReport;