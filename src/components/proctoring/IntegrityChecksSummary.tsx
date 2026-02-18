import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Shield, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Monitor, Eye, Copy, Camera, AlertTriangle, Headphones,
  Keyboard, Laptop, Phone, Users, Volume2, Scan, Brain
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// All integrity check types with metadata
export const INTEGRITY_CHECKS = [
  // Live checks
  { id: 'tab_switch', name: 'Tab Switch Detection', category: 'live', icon: Monitor, severity: 'medium', description: 'Detects when candidate switches browser tabs' },
  { id: 'copy_attempt', name: 'Copy/Paste Blocking', category: 'live', icon: Copy, severity: 'medium', description: 'Blocks and logs clipboard usage' },
  { id: 'print_screen', name: 'Screenshot Blocking', category: 'live', icon: Camera, severity: 'high', description: 'Prevents PrintScreen and screenshot shortcuts' },
  { id: 'multiple_monitors', name: 'Multiple Monitor Detection', category: 'live', icon: Monitor, severity: 'medium', description: 'Detects secondary displays' },
  { id: 'virtual_machine', name: 'Virtual Machine Detection', category: 'live', icon: Laptop, severity: 'high', description: 'Detects VM environments' },
  { id: 'suspicious_typing', name: 'Typing Pattern Analysis', category: 'live', icon: Keyboard, severity: 'medium', description: 'Detects superhuman typing speed or robotic patterns' },
  { id: 'multiple_voices', name: 'Multiple Voice Detection', category: 'live', icon: Users, severity: 'high', description: 'Detects additional speakers via audio analysis' },
  { id: 'look_away', name: 'Look Away Detection', category: 'live', icon: Eye, severity: 'low', description: 'Face position tracking (>5 sec triggers violation)' },
  { id: 'phone_detected', name: 'Phone Detection', category: 'live', icon: Phone, severity: 'high', description: 'Detects mobile phones in frame (95%+ confidence)' },
  { id: 'prohibited_object', name: 'Prohibited Object Detection', category: 'live', icon: AlertTriangle, severity: 'high', description: 'Detects books, laptops, tablets' },
  { id: 'multiple_persons', name: 'Multiple Person Detection', category: 'live', icon: Users, severity: 'high', description: 'Detects additional people in frame' },
  { id: 'audio_playback', name: 'Audio Playback Detection', category: 'live', icon: Volume2, severity: 'medium', description: 'Detects audio playing during interview' },
  { id: 'headphone_usage', name: 'Headphone Usage Detection', category: 'live', icon: Headphones, severity: 'low', description: 'Detects headphone/earphone usage' },
  // AI Post-interview checks
  { id: 'suspicious_screen', name: 'Screen Content Analysis', category: 'ai', icon: Scan, severity: 'high', description: 'AI analyzes screenshots for ChatGPT, messaging apps, dev tools' },
  { id: 'audio_transcription', name: 'Audio Transcription Analysis', category: 'ai', icon: Brain, severity: 'high', description: 'AI identifies multiple speakers, external conversations' },
  { id: 'eye_gaze_analysis', name: 'Eye Gaze Tracking', category: 'ai', icon: Eye, severity: 'medium', description: 'AI analyzes pupil movement for off-screen gaze' },
] as const;

export type IntegrityCheckId = typeof INTEGRITY_CHECKS[number]['id'];

export interface ViolationDetail {
  type: string;
  timestamp: string;
  videoTimestamp?: number;
  details?: string;
  description?: string; // AI analysis uses 'description' instead of 'details'
  severity?: string;
  confidence?: number;
  screenshotUrl?: string;
  screenScreenshotUrl?: string;
}

export interface IntegrityCheckResult {
  checkId: IntegrityCheckId;
  status: 'pass' | 'fail';
  count: number;
  timestamps: { time: string; videoTime?: number; details?: string }[];
}

// Derive check results from detailed violations
// Optionally filter out violations that occurred after the recording ended (interviewDurationSeconds + 30s buffer)
export const deriveIntegrityCheckResults = (
  detailedViolations: ViolationDetail[],
  ignoredViolations: string[] = [],
  interviewDurationSeconds?: number | null
): IntegrityCheckResult[] => {
  const results: Record<string, IntegrityCheckResult> = {};
  
  // Add a buffer to the interview duration to account for timing differences
  const violationCutoffSeconds = interviewDurationSeconds ? interviewDurationSeconds + 30 : null;
  
  // Initialize all checks as passing
  for (const check of INTEGRITY_CHECKS) {
    results[check.id] = {
      checkId: check.id,
      status: 'pass',
      count: 0,
      timestamps: [],
    };
  }
  
  // Process each violation (skip ignored ones and post-recording violations)
  for (const v of detailedViolations || []) {
    // Skip violations that are in the ignored list
    if (ignoredViolations.includes(v.type)) continue;
    
    // Skip violations that occurred after the recording ended
    if (violationCutoffSeconds !== null && v.videoTimestamp !== undefined && v.videoTimestamp > violationCutoffSeconds) {
      continue;
    }
    
    const type = (v.type || '').toLowerCase();
    let matchedId: IntegrityCheckId | null = null;
    
    // Map violation type to check ID
    // IMPORTANT: Order matters! Check more specific types BEFORE generic ones
    // e.g., 'headphone' must be checked before 'phone' (headphone contains 'phone')
    // e.g., 'eye_gaze' must be checked before general 'gaze'
    if (type.includes('tab_switch')) matchedId = 'tab_switch';
    else if (type.includes('copy') || type.includes('paste')) matchedId = 'copy_attempt';
    else if (type.includes('print_screen') || type.includes('screenshot')) matchedId = 'print_screen';
    else if (type.includes('multiple_monitor')) matchedId = 'multiple_monitors';
    else if (type.includes('virtual_machine') || type.includes('vm_')) matchedId = 'virtual_machine';
    else if (type.includes('suspicious_typing')) matchedId = 'suspicious_typing';
    else if (type.includes('multiple_voice') || type.includes('multiple_speaker')) matchedId = 'multiple_voices';
    // Check headphone/earphone BEFORE phone (since 'headphone' contains 'phone')
    else if (type.includes('headphone') || type.includes('earphone') || type.includes('earbud') || type.includes('airpod')) matchedId = 'headphone_usage';
    // Check eye_gaze/off_screen_gaze BEFORE generic look_away/gaze
    else if (type.includes('eye_gaze') || type.includes('off_screen_gaze') || type.includes('erratic_eye')) matchedId = 'eye_gaze_analysis';
    else if (type.includes('look_away') || type.includes('look_away_video')) matchedId = 'look_away';
    // Now check for phone (after headphone is excluded)
    else if (type.includes('phone_detected') || type === 'phone') matchedId = 'phone_detected';
    else if (type.includes('prohibited_object')) matchedId = 'prohibited_object';
    else if (type.includes('multiple_person')) matchedId = 'multiple_persons';
    else if (type.includes('audio_playback')) matchedId = 'audio_playback';
    else if (type.includes('suspicious_screen') || type.includes('screen_content')) matchedId = 'suspicious_screen';
    else if (type.includes('audio_transcription') || type.includes('external_conversation') || type.includes('reading_pattern')) matchedId = 'audio_transcription';
    
    if (matchedId && results[matchedId]) {
      results[matchedId].status = 'fail';
      results[matchedId].count++;
      // Use 'details' if available, fall back to 'description' (AI analysis uses description)
      const violationDetails = v.details || v.description || null;
      results[matchedId].timestamps.push({
        time: v.timestamp || new Date().toISOString(),
        videoTime: v.videoTimestamp,
        details: violationDetails,
      });
    }
  }
  
  return Object.values(results);
};

// Format video timestamp as MM:SS
const formatVideoTime = (seconds?: number): string => {
  if (seconds === undefined || seconds === null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format ISO timestamp to readable time
const formatTimestamp = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleTimeString();
  } catch {
    return '--:--';
  }
};

interface IntegrityChecksSummaryProps {
  detailedViolations: ViolationDetail[];
  showAllChecks?: boolean;
  /** Interview duration in seconds - violations after this time + 30s buffer will be filtered out */
  interviewDurationSeconds?: number | null;
}

export const IntegrityChecksSummary = ({ 
  detailedViolations, 
  showAllChecks = true,
  interviewDurationSeconds
}: IntegrityChecksSummaryProps) => {
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  
  const results = deriveIntegrityCheckResults(detailedViolations, [], interviewDurationSeconds);
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  
  const toggleExpand = (checkId: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  };
  
  // Group by category
  const liveChecks = results.filter(r => INTEGRITY_CHECKS.find(c => c.id === r.checkId)?.category === 'live');
  const aiChecks = results.filter(r => INTEGRITY_CHECKS.find(c => c.id === r.checkId)?.category === 'ai');

  const renderCheckRow = (result: IntegrityCheckResult, index: number) => {
    const checkDef = INTEGRITY_CHECKS.find(c => c.id === result.checkId);
    if (!checkDef) return null;
    
    const Icon = checkDef.icon;
    const isExpanded = expandedChecks.has(result.checkId);
    const hasFailed = result.status === 'fail';
    
    if (!showAllChecks && !hasFailed) return null;
    
    return (
      <div key={result.checkId}>
        {/* Main row */}
        <div 
          className={cn(
            "grid grid-cols-[minmax(200px,2fr)_80px_80px_60px_minmax(100px,1fr)] gap-3 items-center px-4 py-3 border-b",
            hasFailed && "bg-destructive/5",
            index % 2 === 0 && !hasFailed && "bg-muted/30"
          )}
        >
          {/* Check Name */}
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4 flex-shrink-0", hasFailed ? 'text-destructive' : 'text-muted-foreground')} />
            <span className="font-medium text-sm">{checkDef.name}</span>
          </div>
          
          {/* Category */}
          <div>
            <Badge variant="outline" className="text-xs whitespace-nowrap">
              {checkDef.category === 'live' ? '📡 Live' : '🤖 AI'}
            </Badge>
          </div>
          
          {/* Status */}
          <div>
            {hasFailed ? (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                FAIL
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 border-green-300 gap-1 hover:bg-green-100">
                <CheckCircle className="h-3 w-3" />
                PASS
              </Badge>
            )}
          </div>
          
          {/* Count */}
          <div className="text-center">
            {hasFailed ? (
              <span className="font-bold text-destructive">{result.count}</span>
            ) : (
              <span className="text-muted-foreground">0</span>
            )}
          </div>
          
          {/* Timestamps / Actions */}
          <div>
            {hasFailed && result.timestamps.length > 0 ? (
              <button 
                onClick={() => toggleExpand(result.checkId)}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {result.timestamps.length} occurrence{result.timestamps.length > 1 ? 's' : ''}
              </button>
            ) : (
              <span className="text-muted-foreground text-sm">-</span>
            )}
          </div>
        </div>
        
        {/* Expanded timestamps */}
        {hasFailed && isExpanded && (
          <div className="bg-muted/50 border-b px-6 py-3">
            <p className="text-xs text-muted-foreground mb-3">{checkDef.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {result.timestamps.map((ts, idx) => (
                <div key={idx} className="text-xs p-2 bg-background rounded border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-muted-foreground">#{idx + 1}</span>
                    {ts.videoTime !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        Video: {formatVideoTime(ts.videoTime)}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">{formatTimestamp(ts.time)}</span>
                  </div>
                  {ts.details && (
                    <p className="text-muted-foreground truncate" title={ts.details}>
                      {ts.details.length > 80 ? ts.details.substring(0, 80) + '...' : ts.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const TableHeader = () => (
    <div className="grid grid-cols-[minmax(200px,2fr)_80px_80px_60px_minmax(100px,1fr)] gap-3 items-center px-4 py-2 bg-muted font-medium text-sm text-muted-foreground border-b">
      <div>Check</div>
      <div>Category</div>
      <div>Status</div>
      <div className="text-center">Count</div>
      <div>Occurrences</div>
    </div>
  );
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Integrity Checks Summary
            </CardTitle>
            <CardDescription>
              Complete status of all {INTEGRITY_CHECKS.length} proctoring checks
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-green-100 text-green-700 border-green-300 hover:bg-green-100">
              {passCount} Passed
            </Badge>
            {failCount > 0 && (
              <Badge variant="destructive">
                {failCount} Failed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live Monitoring Checks */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            📡 Live Monitoring Checks
            <Badge variant="outline" className="text-xs font-normal">Real-time during interview</Badge>
          </h4>
          <div className="rounded-lg border overflow-hidden">
            <TableHeader />
            <div>
              {liveChecks.map((result, index) => renderCheckRow(result, index))}
            </div>
          </div>
        </div>
        
        {/* AI Analysis Checks */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            🤖 AI Post-Interview Analysis
            <Badge variant="outline" className="text-xs font-normal">Analyzed from recorded video</Badge>
          </h4>
          <div className="rounded-lg border overflow-hidden">
            <TableHeader />
            <div>
              {aiChecks.map((result, index) => renderCheckRow(result, index))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Export for PDF generation - accepts optional ignoredViolations and interviewDurationSeconds
export const getIntegrityChecksPDFData = (
  detailedViolations: ViolationDetail[],
  ignoredViolations: string[] = [],
  interviewDurationSeconds?: number | null
) => {
  const results = deriveIntegrityCheckResults(detailedViolations, ignoredViolations, interviewDurationSeconds);
  
  return results.map(result => {
    const checkDef = INTEGRITY_CHECKS.find(c => c.id === result.checkId);
    return {
      name: checkDef?.name || result.checkId,
      category: checkDef?.category === 'live' ? 'Live' : 'AI Analysis',
      status: result.status === 'pass' ? 'PASS' : 'FAIL',
      count: result.count,
      timestamps: result.timestamps.map(ts => ({
        videoTime: formatVideoTime(ts.videoTime),
        time: formatTimestamp(ts.time),
      })),
    };
  });
};

export default IntegrityChecksSummary;
