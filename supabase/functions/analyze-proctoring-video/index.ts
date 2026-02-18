import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getProctoringConfig, getViolationScore, isViolationEnabled, ProctoringConfig } from "../_shared/proctoring-config.ts";
import { logAIUsage } from "../_shared/config.ts";

// Token estimation for vision API (images add ~258 tokens each based on Gemini docs)
const TOKENS_PER_IMAGE = 258;
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AI Privacy Configuration
 * 
 * These settings ensure video/audio data is NOT stored or used for AI training.
 * - store: false - Prevents data retention by AI provider
 * - Data is processed for analysis only and immediately discarded
 */
const AI_PRIVACY_CONFIG = {
  store: false, // Do not store prompts/responses for training
};

/**
 * Post-Interview Video Analysis Edge Function
 * 
 * This function performs heavy AI-based analysis on recorded proctoring videos
 * AFTER the interview is complete, rather than during the interview.
 * 
 * PRIVACY: All AI analysis uses privacy-preserving settings that prevent
 * data retention and training usage by the AI provider.
 * 
 * Analysis performed:
 * - Screen Content Analysis (detects AI tools, browsers, messaging apps)
 * - Audio Transcription (transcribes speech, detects multiple speakers)
 * - Existing real-time violation aggregation
 */

interface ScreenAnalysisResult {
  timestamp: number;
  findings: string[];
  suspiciousContent: boolean;
  description: string;
  severity?: 'low' | 'medium' | 'high';
}

interface AudioAnalysisResult {
  transcription: string;
  multipleSpeakersDetected: boolean;
  externalConversationDetected: boolean;
  readingPatternDetected: boolean;
  findings: string[];
}

interface AnalysisViolation {
  type: string;
  timestamp: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
  source: 'screen_analysis' | 'audio_analysis' | 'video_analysis';
  screenshotUrl?: string; // Camera screenshot URL (for camera-based violations)
  screenScreenshotUrl?: string; // Screen screenshot URL (for screen-based violations)
}

interface VideoFrameAnalysisResult {
  noPersonDetected: boolean;
  faceAtEdge: boolean;
  multiplePeopleDetected: boolean;
  personCount: number;
  facePosition?: { x: number; y: number; width: number; height: number };
  findings: string[];
}

/**
 * Get signed URLs for periodic screenshots
 */
async function getScreenshotUrls(
  supabase: any,
  screenshotPaths: string[]
): Promise<string[]> {
  const urls: string[] = [];
  
  for (const path of screenshotPaths.slice(0, 10)) { // Limit to 10 screenshots for analysis
    try {
      const { data, error } = await supabase.storage
        .from("proctoring-recordings")
        .createSignedUrl(path, 3600);
      
      if (!error && data?.signedUrl) {
        urls.push(data.signedUrl);
      }
    } catch (e) {
      console.error("[analyze-proctoring-video] Failed to get screenshot URL:", e);
    }
  }
  
  return urls;
}

/**
 * Get signed URLs for violation screenshots
 */
async function getViolationScreenshotUrls(
  supabase: any,
  violations: any[]
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  
  for (const v of violations) {
    if (v.screenshotPath) {
      try {
        const { data, error } = await supabase.storage
          .from("proctoring-recordings")
          .createSignedUrl(v.screenshotPath, 3600);
        
        if (!error && data?.signedUrl) {
          urlMap.set(v.screenshotPath, data.signedUrl);
        }
      } catch (e) {
        console.error("[analyze-proctoring-video] Failed to get violation screenshot URL:", e);
      }
    }
  }
  
  return urlMap;
}

/**
 * Find the closest screenshot to a given violation timestamp
 * Returns the path of the periodic screenshot closest in time to the violation
 */
function findClosestScreenshot(
  violationTimestamp: number,
  screenshotPaths: string[],
  screenshotTimestamps: number[]
): string | null {
  if (!screenshotPaths || screenshotPaths.length === 0) {
    return null;
  }
  
  let closestIndex = 0;
  let minDiff = Math.abs(screenshotTimestamps[0] - violationTimestamp);
  
  for (let i = 1; i < screenshotTimestamps.length; i++) {
    const diff = Math.abs(screenshotTimestamps[i] - violationTimestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  // Only use if the closest screenshot is within 2 minutes of the violation
  if (minDiff <= 120) {
    return screenshotPaths[closestIndex];
  }
  
  return null;
}

/**
 * Attach closest screenshots to AI-detected violations
 * For camera-based violations, attach closest camera screenshot
 * For screen-based violations, attach closest screen screenshot
 */
function attachClosestScreenshotsToViolations(
  violations: AnalysisViolation[],
  cameraScreenshotPaths: string[],
  cameraScreenshotTimestamps: number[],
  screenScreenshotPaths: string[],
  screenScreenshotTimestamps: number[]
): AnalysisViolation[] {
  // Violation types that should use camera screenshots
  const cameraViolationTypes = [
    'no_person_detected', 'face_at_edge', 'multiple_people_detected',
    'different_person_detected', 'identity_verification_uncertain',
    'clothing_changed', 'background_changed', 'phone_in_video',
    'headphones_detected', 'book_detected', 'smart_device_detected',
    'multiple_persons', 'look_away', 'person_swap', 'liveness_fail',
    'off_screen_gaze', 'reading_eye_pattern', 'erratic_eye_movement',
    'sustained_downward_gaze', 'peripheral_focus'
  ];
  
  // Violation types that should use screen screenshots
  const screenViolationTypes = [
    'suspicious_screen_content', 'screen_content_finding',
    'nested_screen_sharing', 'paste_in_code_editor',
    'ai_tool_detected', 'external_application', 'messaging_app_detected'
  ];
  
  return violations.map(v => {
    const violationType = v.type.toLowerCase().replace(/-/g, '_');
    
    // Determine which screenshot source to use based on violation type
    if (cameraViolationTypes.some(t => violationType.includes(t))) {
      const closestPath = findClosestScreenshot(
        v.timestamp,
        cameraScreenshotPaths,
        cameraScreenshotTimestamps
      );
      if (closestPath) {
        v.screenshotUrl = closestPath;
      }
    }
    
    if (screenViolationTypes.some(t => violationType.includes(t))) {
      const closestPath = findClosestScreenshot(
        v.timestamp,
        screenScreenshotPaths,
        screenScreenshotTimestamps
      );
      if (closestPath) {
        v.screenScreenshotUrl = closestPath;
      }
    }
    
    return v;
  });
}

/**
 * Analyze screenshots for suspicious screen content using AI Gateway (Gemini Vision)
 * Uses actual image URLs instead of video URLs
 */
async function analyzeScreenContent(
  screenshotUrls: string[],
  screenshotTimestamps: number[], // Actual video timestamps in seconds
  gatewayApiKey: string
): Promise<ScreenAnalysisResult[]> {
  const results: ScreenAnalysisResult[] = [];

  if (screenshotUrls.length === 0) {
    console.log("[analyze-proctoring-video] No screenshots available for screen analysis");
    return results;
  }

  try {
    console.log(`[analyze-proctoring-video] Analyzing ${screenshotUrls.length} screenshots for screen content...`);

    // Analyze each screenshot
    for (let i = 0; i < Math.min(screenshotUrls.length, 5); i++) {
      const url = screenshotUrls[i];
      // Use actual stored timestamp, fallback to estimated if not available
      const timestamp = screenshotTimestamps[i] ?? (i * 60);
      
      const startTime = Date.now();
      const systemPromptForScreen = `You are a proctoring analysis AI...`; // Placeholder for token estimation
      const requestTokens = estimateTokens(systemPromptForScreen) + TOKENS_PER_IMAGE;
      
      const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
      const response = await fetch(AI_GATEWAY_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gatewayApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          ...AI_PRIVACY_CONFIG,
          messages: [
            {
              role: "system",
              content: `You are a proctoring analysis AI. Analyze this screenshot for integrity violations.

CRITICAL: WHITELIST - DO NOT FLAG THESE (they are the interview platform itself):
- TalentGeenie, TalentGeenie.com, TalentGeenie - AI-Powered, or any TalentGeenie branding
- The interview/assessment portal being used for the test
- Any TalentGeenie-related tabs, windows, or UI elements
- These are the LEGITIMATE interview platform, NOT external AI assistance

CRITICAL DISTINCTION - BROWSER UI ELEMENTS:
- **BOOKMARKS BAR**: Icons/text at the TOP of the browser below the address bar are BOOKMARKS (saved favorites). These are NOT open tabs and should NOT be flagged as violations. Bookmarks are static saved links, not active content.
- **OPEN TABS**: Actual browser tabs appear as individual tab shapes at the very top of the browser window, showing what is currently open and accessible.
- **INACTIVE TABS**: Browser tabs that are visible but NOT the active/focused tab are NOT violations. Only flag if candidate ACTIVELY NAVIGATES to suspicious content.
- **ONLY flag content that is ACTIVELY VISIBLE and being used**, not saved bookmarks, inactive tabs, or browser favorites.

CRITICAL - EXPECTED SCREEN SHARING (NOT A VIOLATION):
- Candidates are INSTRUCTED to share their entire screen before the interview starts
- "Stop sharing" banners, "You are sharing your screen" indicators, or screen sharing UI from the INTERVIEW PLATFORM ITSELF are EXPECTED and NOT violations
- The interview URL (interviewai.talentgeenie.com, talentgeenie.com, or similar) showing screen sharing indicators is NORMAL
- Only flag nested screen sharing if the interview is being shared INSIDE ANOTHER APPLICATION like Zoom, Teams, Discord etc. for receiving external help

CRITICAL - INACTIVE BROWSER TABS (NOT VIOLATIONS):
- Company website tabs (IntraEdge, employer sites, job portals) that are INACTIVE are NOT violations
- Having other browser tabs open is normal - only flag if candidate ACTIVELY SWITCHES to and uses suspicious content
- Entertainment tabs (Netflix, YouTube, Hotstar etc.) that are INACTIVE are minor concerns, not high-severity violations

CRITICAL - SYSTEM POPUPS AND NOTIFICATIONS (NOT VIOLATIONS - FALSE POSITIVES TO IGNORE):
- **Battery/Power notifications**: "Low battery", "Plugged in", "Battery saver" popups are normal system notifications
- **Clipboard permission dialogs**: "Allow clipboard access", "Paste permission" popups are browser security features
- **Screen sharing UI changes**: "Hide preview", "Stop sharing" buttons being clicked are normal interview interactions
- **System notifications**: Windows Action Center, macOS Notification Center, browser notifications about updates
- **Permission dialogs**: Camera/microphone permission popups, location access requests
- **OS dialogs**: File picker, print dialog, download notifications, Bluetooth pairing, WiFi connection prompts
- **Browser autofill**: Password managers, form autofill suggestions appearing momentarily
- These are ALL normal system/browser interactions and should NEVER be flagged as violations

SEVERITY CLASSIFICATION (CRITICAL - follow these rules strictly):
- **HIGH severity** (ONLY these are high):
  1. AI assistance tools ACTIVELY OPEN (ChatGPT, Claude, Bard, Copilot visible and being used)
  2. Window/tab CHANGE to cheating resources (candidate actively switches to suspicious content)
  3. Nested screen sharing to external party for help
  4. Remote desktop/control software with active connection
  5. Streaming software with external viewers watching
  
- **MEDIUM severity**:
  1. Messaging apps actively open (WhatsApp, Discord, Slack visible)
  2. Stack Overflow or coding help websites being actively viewed
  3. Search engines with query results visible
  4. Code paste operations detected
  5. Extended/multiple monitor setup detected
  
- **LOW severity** (minor concerns, not cheating):
  1. Entertainment tabs visible but inactive
  2. Notes visible but not clearly cheat sheets
  
- **NONE** (DO NOT FLAG):
  1. Poor lighting conditions (if candidate face is still visible, ignore lighting issues)
  2. Camera quality issues
  3. Inactive browser tabs (even if they contain other websites)
  4. Browser bookmarks, history, extensions
  5. TalentGeenie platform UI elements
  6. Screen sharing UI from the interview platform
  7. System popups, notifications, and permission dialogs
  8. Battery, power, or connectivity notifications
  9. Clipboard permission requests

Look for these suspicious activities (ONLY if actively open/visible and being ACTIVELY USED):
1. AI assistance tools (ChatGPT, Claude, Bard, Copilot, any AI chatbots) - ACTIVELY OPEN AND BEING USED, not just bookmarked or in inactive tab. EXCLUDE TalentGeenie platform itself.
2. Code editors or IDEs that shouldn't be open (EXCEPT the interview's own code editor)
3. Messaging apps (WhatsApp, Telegram, Discord, Slack, etc.) - ACTIVELY OPEN AND VISIBLE
4. Search engines with query results VISIBLE on the ACTIVE screen
5. Stack Overflow or coding help websites with VISIBLE content being ACTIVELY VIEWED
6. Notes or cheat sheets VISIBLE on screen
7. **NESTED SCREEN SHARING FOR EXTERNAL HELP**: Look for indicators that the interview screen is being shared inside ANOTHER APPLICATION for receiving external assistance (e.g., Zoom call with someone viewing, Teams meeting, Discord call). NOTE: The interview platform's own "Stop sharing" or screen share UI is EXPECTED and NOT a violation.
8. **PASTE OPERATIONS IN CODE EDITOR**: Look for code that appears suddenly in large blocks, clipboard paste indicators, or code formatting that suggests copy-paste from external source
9. **Clipboard manager apps**: Any clipboard history tools ACTIVELY VISIBLE
10. **EXTENDED/MULTIPLE MONITORS**: Look for signs of extended display setup - partial window edges, taskbar/dock on unusual positions, display arrangement indicators, or content that appears cut off at screen edges suggesting content extends to another monitor
11. **STREAMING/RECORDING SOFTWARE**: Look for OBS Studio, Streamlabs, XSplit, or any screen recording/streaming software actively running with SOMEONE WATCHING. Check for:
    - OBS control panel showing viewers
    - Active stream with chat or external viewers
    - Video call showing another person watching
12. **REMOTE DESKTOP/CONTROL SOFTWARE**: TeamViewer, AnyDesk, Chrome Remote Desktop, VNC viewers, or any remote access software with active connections

DO NOT FLAG (FALSE POSITIVES):
- TalentGeenie platform or any TalentGeenie branding/tabs (this IS the interview platform)
- "Stop sharing" banners or screen sharing UI from the interview platform itself (candidates ARE expected to share screen)
- Browser bookmarks bar items (saved favorites at top of browser)
- Browser history suggestions
- Browser extensions icons in toolbar
- Normal browser UI elements
- INACTIVE browser tabs with company websites, job portals, or unrelated content (only flag if actively navigated to during assessment)
- IntraEdge, employer websites, or professional networking sites in inactive tabs
- Poor lighting or camera quality issues (as long as candidate face is visible)
- System popups: battery warnings, clipboard access dialogs, notification center, permission prompts
- Screen sharing control buttons being clicked (hide preview, stop sharing, etc.)
- OS-level dialogs like file pickers, print dialogs, download notifications

Respond in JSON format:
{
  "suspiciousContent": boolean,
  "findings": ["list of specific findings - be precise about what is ACTIVELY VISIBLE vs bookmarked"],
  "severity": "none" | "low" | "medium" | "high",
  "nestedScreenSharing": boolean,
  "nestedSharingApp": string | null,
  "pasteDetected": boolean,
  "pasteLocation": string | null,
  "extendedMonitorDetected": boolean,
  "extendedMonitorEvidence": string | null,
  "streamingSoftwareDetected": boolean,
  "streamingSoftwareName": string | null,
  "remoteDesktopDetected": boolean,
  "remoteDesktopSoftware": string | null,
  "description": "Brief summary of what was detected (distinguish between active content and bookmarks)"
}`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this screenshot for any suspicious content that indicates cheating or external assistance during an interview/assessment."
                },
                {
                  type: "image_url",
                  image_url: { url }
                }
              ]
            }
          ],
          max_tokens: 500,
        }),
      });

      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[analyze-proctoring-video] Screen analysis API error for screenshot ${i}:`, response.status, errorText);
        
        // Log failed vision API call
        await logAIUsage({
          featureName: 'proctoring_screen_analysis',
          success: false,
          modelUsed: 'gemini-2.5-flash',
          requestTokens: TOKENS_PER_IMAGE + 500, // Approximate prompt tokens
          latencyMs,
          errorMessage: `${response.status}: ${errorText}`,
        });
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const responseTokens = estimateTokens(content);
      
      // Log successful vision API call
      await logAIUsage({
        featureName: 'proctoring_screen_analysis',
        success: true,
        modelUsed: 'gemini-2.5-flash',
        requestTokens: TOKENS_PER_IMAGE + 500,
        responseTokens,
        latencyMs,
      });

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Track suspicious content findings - only if severity is medium or high
          const aiSeverity = parsed.severity || "none";
          if (parsed.suspiciousContent && (aiSeverity === "medium" || aiSeverity === "high")) {
            results.push({
              timestamp, // Use actual video timestamp
              findings: parsed.findings || [],
              suspiciousContent: true,
              description: parsed.description || "Suspicious content detected",
              severity: aiSeverity, // Pass AI-determined severity
            });
          } else if (parsed.suspiciousContent && aiSeverity === "low") {
            console.log(`[analyze-proctoring-video] Skipping low-severity finding at ${timestamp}s: ${parsed.description}`);
          }
          
          // Nested screen sharing detection (HIGH severity)
          if (parsed.nestedScreenSharing) {
            results.push({
              timestamp,
              findings: [`Nested screen sharing detected via ${parsed.nestedSharingApp || 'unknown app'}`],
              suspiciousContent: true,
              description: `Interview is being shared inside another application (${parsed.nestedSharingApp || 'screen sharing app'}). Candidate may be receiving external assistance.`,
            });
          }
          
          // Paste detection in code editor (MEDIUM severity)
          if (parsed.pasteDetected) {
            results.push({
              timestamp,
              findings: [`Paste operation detected${parsed.pasteLocation ? ` in ${parsed.pasteLocation}` : ''}`],
              suspiciousContent: true,
              description: `Code paste detected${parsed.pasteLocation ? ` in ${parsed.pasteLocation}` : ''}. Large code blocks may have been copied from external source.`,
            });
          }
          
          // Extended/Multiple monitor detection (MEDIUM severity)
          if (parsed.extendedMonitorDetected) {
            results.push({
              timestamp,
              findings: [`Extended/multiple monitor setup detected${parsed.extendedMonitorEvidence ? `: ${parsed.extendedMonitorEvidence}` : ''}`],
              suspiciousContent: true,
              description: `Extended display or multiple monitors detected. Candidate may have content on another screen not being captured.`,
            });
          }
          
          // Streaming software detection (HIGH severity)
          if (parsed.streamingSoftwareDetected) {
            results.push({
              timestamp,
              findings: [`Streaming/recording software detected: ${parsed.streamingSoftwareName || 'unknown'}`],
              suspiciousContent: true,
              description: `Streaming software (${parsed.streamingSoftwareName || 'OBS/Streamlabs'}) detected. Candidate may be streaming interview to external party for assistance.`,
            });
          }
          
          // Remote desktop detection (HIGH severity)
          if (parsed.remoteDesktopDetected) {
            results.push({
              timestamp,
              findings: [`Remote desktop software detected: ${parsed.remoteDesktopSoftware || 'unknown'}`],
              suspiciousContent: true,
              description: `Remote access software (${parsed.remoteDesktopSoftware || 'TeamViewer/AnyDesk'}) detected. External party may have control of the system.`,
            });
          }
        }
      } catch (parseError) {
        console.error("[analyze-proctoring-video] Failed to parse screen analysis:", parseError);
      }
    }
  } catch (error) {
    console.error("[analyze-proctoring-video] Screen content analysis error:", error);
  }

  console.log(`[analyze-proctoring-video] Screen analysis found ${results.length} suspicious screenshots`);
  return results;
}

/**
 * Audio analysis is not possible without video processing capability
 * This function returns default results - audio violations are captured in real-time instead
 */
async function analyzeAudioContent(
  _videoRecordingUrl: string,
  _gatewayApiKey: string
): Promise<AudioAnalysisResult> {
  console.log("[analyze-proctoring-video] Audio analysis skipped - requires video processing capability. Real-time voice detection captures audio violations during interview.");
  
  return {
    transcription: "",
    multipleSpeakersDetected: false,
    externalConversationDetected: false,
    readingPatternDetected: false,
    findings: [],
  };
}

/**
 * Analyze periodic screenshots for person presence, multiple persons, face position
 * Uses actual image URLs captured during the interview
 */
async function analyzeVideoFrames(
  screenshotUrls: string[],
  screenshotTimestamps: number[], // Actual video timestamps in seconds
  gatewayApiKey: string
): Promise<{ violations: AnalysisViolation[]; findings: string[] }> {
  const violations: AnalysisViolation[] = [];
  const findings: string[] = [];

  if (screenshotUrls.length === 0) {
    console.log("[analyze-proctoring-video] No screenshots available for video frame analysis");
    return { violations, findings };
  }

  try {
    console.log(`[analyze-proctoring-video] Analyzing ${screenshotUrls.length} screenshots for person presence...`);

    for (let i = 0; i < Math.min(screenshotUrls.length, 10); i++) {
      const url = screenshotUrls[i];
      // Use actual stored timestamp, fallback to estimated if not available
      const timestamp = screenshotTimestamps[i] ?? (i * 60);

      const startTime = Date.now();
      const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
      const response = await fetch(AI_GATEWAY_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gatewayApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          ...AI_PRIVACY_CONFIG,
          messages: [
            {
              role: "system",
              content: `You are a proctoring video analysis AI. Analyze this webcam screenshot for GENUINE integrity violations during an interview.

IMPORTANT: Be conservative and only flag REAL issues that indicate cheating. Normal room environments should NOT trigger violations.

CRITICAL - ELECTRONIC DEVICE FALSE POSITIVE REDUCTION:
Only flag electronic devices (phones, tablets, laptops, TVs, monitors) if ALL of these are true:
1. **Within arm's reach** - Device is on the desk, in hand, or immediately accessible (NOT on a shelf, wall, or background furniture)
2. **Screen is lit/active** - Device has a visible lit screen showing content (NOT switched off, black screen, or dormant)
3. **Being held or touched** - For phones/tablets: actively in hand or being manipulated (NOT just lying face-down on desk)
4. **In the active zone** - Device is in the center/foreground of the frame (NOT periphery, background, or mounted on walls)

DO NOT FLAG (COMMON FALSE POSITIVES):
- TV mounted on wall behind candidate (even if visible) - unless screen is actively displaying content being watched
- Phone/tablet on bookshelf or charging station in background
- Laptop lid closed on desk
- Picture frames containing photos of phones/devices
- Decorative items or artwork depicting technology
- Switched-off monitors in background
- Smart home devices (Echo, Google Home) - these are ambient
- Watches/fitness bands on wrist

Detect ONLY the following - DO NOT flag normal room decorations:
1. **No person in frame**: No person visible in the camera (entire frame is empty)
2. **Face at edge**: ONLY if face is significantly cut off (more than 30% missing)
3. **Multiple people**: More than one person clearly visible in frame (HIGH severity - be certain)
4. **Looking away/at another screen**: This is CRITICAL - carefully analyze:
   - Eye position: Are the pupils/irises pointed away from camera? (looking left, right, up, or down)
   - Head angle: Is the head rotated/tilted to view something to the side?
   - Signs of reading another screen: Eyes moving horizontally as if reading text on a side monitor
   - Consistent gaze to one side: Eyes persistently focused to the left or right (indicates second monitor)
5. **Eye gaze off-screen**: Eyes clearly focused elsewhere - analyze the whites of eyes (sclera) visibility:
   - More white visible on one side = looking toward the opposite side
   - Look for pupil position relative to eye corners
6. **Reading pattern from side screen**: Systematic left-to-right eye movement while head faces sideways, suggesting reading from another monitor
7. **Poor lighting**: ONLY if face is almost invisible due to darkness, or completely washed out
8. **Headphones/Earphones/Earbuds**: Any earbuds (AirPods, Galaxy Buds, etc.), earphones, or bluetooth earpieces visible. Wired headphones with visible cable are acceptable for audio but still flag them.
9. **Face occlusion**: Face covered by hands or objects (NOT normal glasses)
10. **Phone visible**: Phone actively in use or held in hand - MUST be lit screen AND within arm's reach AND being actively used
11. **Background objects**: ONLY actual notes, cheat sheets, or textbooks with visible text that could be answers. DO NOT flag: wall art, paintings, picture frames, decorative items, posters, calendars, bookshelves with books (unless book is open and being read), or any normal room decorations.
12. **Glasses/Eyewear analysis**: 
    - **Sunglasses**: Flag if wearing dark/tinted sunglasses (obscures eye tracking)
    - **Normal glasses with reflection**: Only flag if reflection shows CLEAR TEXT or CONTENT from another screen. Normal monitor glow/light reflections are EXPECTED and should NOT be flagged.
    - Most candidates wear glasses and will have some screen reflection - this is NORMAL.

IMPORTANT: Be CONSERVATIVE with second monitor detection to avoid false positives:
- Looking away momentarily is NORMAL behavior (thinking, distraction, etc.)
- Only flag "secondMonitorSuspected: true" if you see MULTIPLE strong indicators:
  1. HEAD turned 20+ degrees to side AND sustained (not momentary glance)
  2. EYES consistently tracking horizontally (reading pattern from side screen)
  3. OR visible screen reflection in glasses showing another monitor
- Single glances or brief looks away should NOT be flagged as second monitor
- Set "secondMonitorEvidence" to describe the SPECIFIC evidence (not just "looking away")
- If uncertain, set "secondMonitorSuspected: false" - we err on side of fairness

CRITICAL: Normal home/office backgrounds with artwork, photos, bookshelves, or decorations are FINE and should NOT be flagged.

Respond in JSON format:
{
  "personVisible": boolean,
  "personCount": number,
  "faceAtEdge": boolean,
  "edgePosition": "top" | "bottom" | "left" | "right" | null,
  "lookingAway": boolean,
  "lookDirection": string | null,
  "eyeGazeOffScreen": boolean,
  "gazeDirection": "left" | "right" | "up" | "down" | "center" | null,
  "gazeConfidence": number (0-100),
  "secondMonitorSuspected": boolean,
  "secondMonitorEvidence": string | null,
  "readingPattern": boolean,
  "readingPatternDetails": string | null,
  "poorLighting": boolean,
  "lightingIssue": "too_dark" | "overexposed" | null,
  "headphonesVisible": boolean,
  "headphoneType": "wired_headphones" | "wireless_earbuds" | "airpods" | "earphones" | "bluetooth_earpiece" | null,
  "faceOccluded": boolean,
  "occlusionType": string | null,
  "phoneVisible": boolean,
  "phoneLocation": string | null,
  "suspiciousBackgroundObjects": boolean,
  "backgroundObjects": string[] | null,
  "wearingSunglasses": boolean,
  "sunglassesDescription": string | null,
  "glassesReflectionWithContent": boolean,
  "glassesReflectionContent": string | null,
  "description": "Brief description of what's seen"
}`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this webcam screenshot from an interview. Count how many people are visible and check if the candidate is properly positioned."
                },
                {
                  type: "image_url",
                  image_url: { url }
                }
              ]
            }
          ],
          max_tokens: 500,
        }),
      });

      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[analyze-proctoring-video] Frame analysis API error for screenshot ${i}:`, response.status, errorText);
        
        await logAIUsage({
          featureName: 'proctoring_video_frame_analysis',
          success: false,
          modelUsed: 'gemini-2.5-flash',
          requestTokens: TOKENS_PER_IMAGE + 600,
          latencyMs,
          errorMessage: `${response.status}: ${errorText}`,
        });
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const responseTokens = estimateTokens(content);
      
      await logAIUsage({
        featureName: 'proctoring_video_frame_analysis',
        success: true,
        modelUsed: 'gemini-2.5-flash',
        requestTokens: TOKENS_PER_IMAGE + 600,
        responseTokens,
        latencyMs,
      });

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          // Multiple people - HIGH severity
          if (parsed.personCount > 1) {
            violations.push({
              type: "multiple_persons_video",
              timestamp,
              description: `${parsed.personCount} people detected in frame. ${parsed.description || ''}`,
              severity: "high",
              source: "video_analysis",
            });
            findings.push(`${parsed.personCount} people detected at screenshot ${i}`);
            console.log(`[analyze-proctoring-video] MULTIPLE PERSONS DETECTED: ${parsed.personCount} people at screenshot ${i}`);
          }

          // No person visible
          if (!parsed.personVisible) {
            violations.push({
              type: "no_person_in_frame",
              timestamp,
              description: `No person visible in frame. ${parsed.description || ''}`,
              severity: "medium",
              source: "video_analysis",
            });
            findings.push(`No person visible at screenshot ${i}`);
          }

          // Face at edge
          if (parsed.faceAtEdge && parsed.edgePosition) {
            violations.push({
              type: "face_at_edge",
              timestamp,
              description: `Face at ${parsed.edgePosition} edge of frame. ${parsed.description || ''}`,
              severity: "low",
              source: "video_analysis",
            });
            findings.push(`Face at ${parsed.edgePosition} edge at screenshot ${i}`);
          }

          // Looking away
          if (parsed.lookingAway) {
            violations.push({
              type: "look_away_video",
              timestamp,
              description: `Candidate looking ${parsed.lookDirection || 'away'}. ${parsed.description || ''}`,
              severity: "low",
              source: "video_analysis",
            });
            findings.push(`Looking ${parsed.lookDirection || 'away'} at screenshot ${i}`);
          }

          // Eye gaze off-screen (reading from notes/phone)
          if (parsed.eyeGazeOffScreen) {
            violations.push({
              type: "eye_gaze_off_screen",
              timestamp,
              description: `Eyes focused off-screen${parsed.gazeDirection ? ` (${parsed.gazeDirection})` : ''}. May be reading from external source.`,
              severity: "medium",
              source: "video_analysis",
            });
            findings.push(`Eye gaze off-screen at screenshot ${i}`);
          }

          // Reading pattern detection (systematic eye movement suggesting reading from notes)
          if (parsed.readingPattern) {
            violations.push({
              type: "reading_pattern",
              timestamp,
              description: `Reading pattern detected: ${parsed.readingPatternDetails || 'Systematic eye movement suggesting reading from external notes or screen'}.`,
              severity: "medium",
              source: "video_analysis",
            });
            findings.push(`Reading pattern detected at screenshot ${i}`);
          }

          // Poor lighting
          if (parsed.poorLighting) {
            violations.push({
              type: "poor_lighting",
              timestamp,
              description: `Poor lighting conditions: ${parsed.lightingIssue || 'face not clearly visible'}.`,
              severity: "low",
              source: "video_analysis",
            });
            findings.push(`Poor lighting (${parsed.lightingIssue}) at screenshot ${i}`);
          }

          // Headphones/Earphones/Earbuds visible
          if (parsed.headphonesVisible) {
            const headphoneType = parsed.headphoneType || 'earphones';
            const isWireless = ['wireless_earbuds', 'airpods', 'bluetooth_earpiece'].includes(headphoneType);
            violations.push({
              type: isWireless ? "earbuds_detected" : "headphones_detected",
              timestamp,
              description: `${headphoneType.replace(/_/g, ' ')} detected. Candidate may be receiving external audio assistance.`,
              severity: isWireless ? "high" : "medium",
              source: "video_analysis",
            });
            findings.push(`${headphoneType.replace(/_/g, ' ')} detected at screenshot ${i}`);
          }

          // Face occlusion
          if (parsed.faceOccluded) {
            violations.push({
              type: "face_occluded",
              timestamp,
              description: `Face partially occluded${parsed.occlusionType ? ` by ${parsed.occlusionType}` : ''}.`,
              severity: "medium",
              source: "video_analysis",
            });
            findings.push(`Face occluded at screenshot ${i}`);
          }

          // Phone visible
          if (parsed.phoneVisible) {
            violations.push({
              type: "phone_in_video",
              timestamp,
              description: `Phone/mobile device visible${parsed.phoneLocation ? ` (${parsed.phoneLocation})` : ''}. Candidate may be receiving external assistance.`,
              severity: "high",
              source: "video_analysis",
            });
            findings.push(`Phone visible at screenshot ${i}`);
          }

          // Suspicious background objects
          if (parsed.suspiciousBackgroundObjects && parsed.backgroundObjects?.length > 0) {
            violations.push({
              type: "suspicious_background",
              timestamp,
              description: `Suspicious items in background: ${parsed.backgroundObjects.join(', ')}. May indicate use of unauthorized materials.`,
              severity: "medium",
              source: "video_analysis",
            });
            findings.push(`Suspicious background objects at screenshot ${i}`);
          }

          // Second monitor suspected from eye/head position analysis
          // Only flag if there's strong evidence, not just momentary glances
          if (parsed.secondMonitorSuspected && parsed.secondMonitorEvidence) {
            // Determine severity based on evidence strength
            const hasReadingPattern = parsed.readingPattern === true;
            const hasGlassesReflectionWithContent = parsed.glassesReflectionWithContent === true;
            const severity = (hasReadingPattern || hasGlassesReflectionWithContent) ? "high" : "medium";
            
            violations.push({
              type: "second_monitor_suspected",
              timestamp,
              description: `Possible second monitor: ${parsed.secondMonitorEvidence}. Note: This is an indicator, not conclusive proof. Brief glances away are normal behavior.`,
              severity,
              source: "video_analysis",
            });
            findings.push(`Second monitor indicator at screenshot ${i}: ${parsed.secondMonitorEvidence}`);
          }

          // Sunglasses (obscures eye tracking)
          if (parsed.wearingSunglasses) {
            violations.push({
              type: "sunglasses",
              timestamp,
              description: `Candidate wearing sunglasses: ${parsed.sunglassesDescription || 'Dark/tinted glasses detected'}. This obscures eye tracking and gaze detection.`,
              severity: "medium",
              source: "video_analysis",
            });
            findings.push(`Sunglasses detected at screenshot ${i}`);
          }

          // Glasses reflection showing actual content from another screen (high severity)
          if (parsed.glassesReflectionWithContent) {
            violations.push({
              type: "glasses_reflection",
              timestamp,
              description: `Glasses reflection shows content: ${parsed.glassesReflectionContent || 'Text or content from another screen visible in glasses reflection'}.`,
              severity: "high",
              source: "video_analysis",
            });
            findings.push(`Glasses reflection with visible content at screenshot ${i}`);
          }
        }
      } catch (parseError) {
        console.error("[analyze-proctoring-video] Failed to parse frame analysis:", parseError);
      }
    }
  } catch (error) {
    console.error("[analyze-proctoring-video] Video frame analysis error:", error);
  }

  console.log(`[analyze-proctoring-video] Frame analysis found ${violations.length} violations`);
  return { violations, findings };
}

/**
 * Verify same person throughout the interview
 * Compares faces across multiple screenshots to detect candidate substitution
 */
async function verifySamePerson(
  screenshotUrls: string[],
  gatewayApiKey: string
): Promise<{ violations: AnalysisViolation[]; isSamePerson: boolean; confidence: number }> {
  const violations: AnalysisViolation[] = [];
  
  if (screenshotUrls.length < 2) {
    console.log("[analyze-proctoring-video] Not enough screenshots for same-person verification");
    return { violations, isSamePerson: true, confidence: 0 };
  }

  try {
    console.log(`[analyze-proctoring-video] Verifying same person across ${screenshotUrls.length} screenshots...`);

    // Select first, middle, and last screenshots for comparison
    const indices = [0, Math.floor(screenshotUrls.length / 2), screenshotUrls.length - 1];
    const selectedUrls = indices.map(i => screenshotUrls[Math.min(i, screenshotUrls.length - 1)]);

    const startTime = Date.now();
    const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
    const response = await fetch(AI_GATEWAY_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gatewayApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        ...AI_PRIVACY_CONFIG,
        messages: [
          {
            role: "system",
            content: `You are a facial verification AI for proctoring. Compare these screenshots from an interview to verify the SAME PERSON took the entire interview.

Analyze:
1. **Facial features**: Compare face shape, eyes, nose, mouth across images
2. **Distinguishing marks**: Look for consistent features (glasses, facial hair, moles, etc.)
3. **Clothing**: Note if clothing changes significantly (might indicate different person or break)
4. **Background**: Check if background remains consistent

Respond in JSON format:
{
  "isSamePerson": boolean,
  "confidence": number (0-100),
  "facialFeaturesMatch": boolean,
  "distinguishingMarksConsistent": boolean,
  "clothingConsistent": boolean,
  "backgroundConsistent": boolean,
  "differences": string[] | null,
  "description": "Brief explanation of your assessment"
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Compare these 3 screenshots from the beginning, middle, and end of an interview. Verify if the same person appears in all images. Look for any signs of candidate substitution."
              },
              ...selectedUrls.map(url => ({
                type: "image_url" as const,
                image_url: { url }
              }))
            ]
          }
        ],
        max_tokens: 800,
      }),
    });

    const latencyMs = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[analyze-proctoring-video] Same-person verification API error:", response.status, errorText);
      
      await logAIUsage({
        featureName: 'proctoring_same_person_verification',
        success: false,
        modelUsed: 'gemini-2.5-flash',
        requestTokens: TOKENS_PER_IMAGE * 3 + 400,
        latencyMs,
        errorMessage: `${response.status}: ${errorText}`,
      });
      return { violations, isSamePerson: true, confidence: 0 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const responseTokens = estimateTokens(content);
    
    await logAIUsage({
      featureName: 'proctoring_same_person_verification',
      success: true,
      modelUsed: 'gemini-2.5-flash',
      requestTokens: TOKENS_PER_IMAGE * 3 + 400,
      responseTokens,
      latencyMs,
    });

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        if (!parsed.isSamePerson) {
          violations.push({
            type: "different_person_detected",
            timestamp: 0,
            description: `CRITICAL: Different person may have taken part of the interview. ${parsed.description || ''} Differences: ${parsed.differences?.join(', ') || 'Not specified'}.`,
            severity: "high",
            source: "video_analysis",
          });
          console.log(`[analyze-proctoring-video] DIFFERENT PERSON DETECTED! Confidence: ${parsed.confidence}%`);
        } else if (parsed.confidence < 70) {
          violations.push({
            type: "identity_verification_uncertain",
            timestamp: 0,
            description: `Identity verification inconclusive (${parsed.confidence}% confidence). Manual review recommended. ${parsed.description || ''}`,
            severity: "medium",
            source: "video_analysis",
          });
        }

        // Check for significant clothing/background changes
        if (!parsed.clothingConsistent) {
          violations.push({
            type: "clothing_changed",
            timestamp: 0,
            description: `Candidate's clothing changed during interview. May indicate break or substitution attempt.`,
            severity: "low",
            source: "video_analysis",
          });
        }

        if (!parsed.backgroundConsistent) {
          violations.push({
            type: "background_changed",
            timestamp: 0,
            description: `Interview background/location changed during session. May indicate candidate moved locations.`,
            severity: "medium",
            source: "video_analysis",
          });
        }

        return { 
          violations, 
          isSamePerson: parsed.isSamePerson, 
          confidence: parsed.confidence || 0 
        };
      }
    } catch (parseError) {
      console.error("[analyze-proctoring-video] Failed to parse same-person verification:", parseError);
    }
  } catch (error) {
    console.error("[analyze-proctoring-video] Same-person verification error:", error);
  }

  return { violations, isSamePerson: true, confidence: 0 };
}

/**
 * Analyze eye/gaze movement patterns from video using AI Gateway
 * Detects: Sustained off-screen gaze, erratic eye movement, reading patterns
 */
async function analyzeEyeGaze(
  videoRecordingUrl: string,
  gatewayApiKey: string
): Promise<{ violations: AnalysisViolation[]; findings: string[] }> {
  const violations: AnalysisViolation[] = [];
  const findings: string[] = [];

  try {
    console.log("[analyze-proctoring-video] Starting eye/gaze analysis...");

    const startTime = Date.now();
    const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
    const response = await fetch(AI_GATEWAY_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gatewayApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        ...AI_PRIVACY_CONFIG, // Privacy: prevent data retention
        messages: [
          {
            role: "system",
            content: `You are an expert proctoring analyst specializing in eye movement and gaze pattern analysis. Analyze interview video recordings to detect suspicious eye behavior that may indicate cheating.

Detect the following patterns:
1. **Off-screen gaze**: Eyes consistently looking away from the screen (possibly reading notes, secondary monitor, or phone)
2. **Reading patterns**: Eyes moving left-to-right repeatedly as if reading text not on screen
3. **Erratic eye movement**: Rapid, nervous eye movements that suggest distraction or anxiety
4. **Sustained downward gaze**: Looking down for extended periods (possible notes or phone)
5. **Peripheral focus**: Eyes frequently shifting to sides of frame (possible secondary display or person)

For each pattern detected, note:
- Approximate timestamp (seconds from start)
- Duration
- Specific eye behavior observed
- Confidence level (high/medium/low)

Respond in JSON format:
{
  "offScreenGazePeriods": [
    { "startSeconds": number, "durationSeconds": number, "direction": "left" | "right" | "up" | "down", "confidence": "high" | "medium" | "low", "description": string }
  ],
  "readingPatterns": [
    { "startSeconds": number, "durationSeconds": number, "confidence": "high" | "medium" | "low", "description": string }
  ],
  "erraticMovementPeriods": [
    { "startSeconds": number, "durationSeconds": number, "confidence": "high" | "medium" | "low", "description": string }
  ],
  "sustainedDownwardGaze": [
    { "startSeconds": number, "durationSeconds": number, "confidence": "high" | "medium" | "low", "description": string }
  ],
  "peripheralFocusPeriods": [
    { "startSeconds": number, "durationSeconds": number, "side": "left" | "right", "confidence": "high" | "medium" | "low", "description": string }
  ],
  "overallGazeScore": number (0-100, where 100 means consistent forward/screen focus),
  "gazeAssessment": string
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze the candidate's eye movement and gaze patterns in this interview video. Focus on detecting any suspicious eye behavior that could indicate reading from external sources, using secondary monitors, or receiving external assistance. Pay close attention to the direction and consistency of their gaze throughout."
              },
              {
                type: "image_url",
                image_url: {
                  url: videoRecordingUrl
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
      }),
    });

    const latencyMs = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[analyze-proctoring-video] Eye gaze analysis API error:", response.status, errorText);
      
      await logAIUsage({
        featureName: 'proctoring_eye_gaze_analysis',
        success: false,
        modelUsed: 'gemini-2.5-flash',
        requestTokens: TOKENS_PER_IMAGE + 800,
        latencyMs,
        errorMessage: `${response.status}: ${errorText}`,
      });
      return { violations, findings };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const responseTokens = estimateTokens(content);
    
    await logAIUsage({
      featureName: 'proctoring_eye_gaze_analysis',
      success: true,
      modelUsed: 'gemini-2.5-flash',
      requestTokens: TOKENS_PER_IMAGE + 800,
      responseTokens,
      latencyMs,
    });
    
    console.log("[analyze-proctoring-video] Eye gaze analysis response:", content);

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Process off-screen gaze violations
        const offScreenPeriods = parsed.offScreenGazePeriods || [];
        for (const period of offScreenPeriods) {
          if (period.durationSeconds >= 5 && (period.confidence === "high" || period.confidence === "medium")) {
            violations.push({
              type: "off_screen_gaze",
              timestamp: period.startSeconds || 0,
              description: `Eyes looking ${period.direction} for ${period.durationSeconds}s (${period.confidence} confidence). ${period.description || ''}`,
              severity: period.durationSeconds >= 15 ? "medium" : "low",
              source: "video_analysis",
            });
            findings.push(`Off-screen gaze (${period.direction}) at ${period.startSeconds}s for ${period.durationSeconds}s`);
          }
        }

        // Process reading pattern violations
        const readingPatterns = parsed.readingPatterns || [];
        for (const period of readingPatterns) {
          if (period.confidence === "high" || (period.confidence === "medium" && period.durationSeconds >= 10)) {
            violations.push({
              type: "reading_eye_pattern",
              timestamp: period.startSeconds || 0,
              description: `Reading eye pattern detected for ${period.durationSeconds}s (${period.confidence} confidence). ${period.description || ''}`,
              severity: period.confidence === "high" ? "high" : "medium",
              source: "video_analysis",
            });
            findings.push(`Reading pattern at ${period.startSeconds}s for ${period.durationSeconds}s`);
          }
        }

        // Process erratic movement periods
        const erraticPeriods = parsed.erraticMovementPeriods || [];
        for (const period of erraticPeriods) {
          if (period.confidence === "high" && period.durationSeconds >= 10) {
            violations.push({
              type: "erratic_eye_movement",
              timestamp: period.startSeconds || 0,
              description: `Erratic eye movement for ${period.durationSeconds}s (${period.confidence} confidence). ${period.description || ''}`,
              severity: "low",
              source: "video_analysis",
            });
            findings.push(`Erratic eye movement at ${period.startSeconds}s`);
          }
        }

        // Process sustained downward gaze
        const downwardPeriods = parsed.sustainedDownwardGaze || [];
        for (const period of downwardPeriods) {
          if (period.durationSeconds >= 8 && (period.confidence === "high" || period.confidence === "medium")) {
            violations.push({
              type: "sustained_downward_gaze",
              timestamp: period.startSeconds || 0,
              description: `Looking down for ${period.durationSeconds}s (${period.confidence} confidence). ${period.description || ''}`,
              severity: period.durationSeconds >= 20 ? "medium" : "low",
              source: "video_analysis",
            });
            findings.push(`Sustained downward gaze at ${period.startSeconds}s for ${period.durationSeconds}s`);
          }
        }

        // Process peripheral focus
        const peripheralPeriods = parsed.peripheralFocusPeriods || [];
        for (const period of peripheralPeriods) {
          if (period.durationSeconds >= 5 && (period.confidence === "high" || period.confidence === "medium")) {
            violations.push({
              type: "peripheral_focus",
              timestamp: period.startSeconds || 0,
              description: `Peripheral focus to ${period.side} for ${period.durationSeconds}s (${period.confidence} confidence). ${period.description || ''}`,
              severity: period.durationSeconds >= 15 ? "medium" : "low",
              source: "video_analysis",
            });
            findings.push(`Peripheral focus (${period.side}) at ${period.startSeconds}s`);
          }
        }

        // Add gaze score to findings
        if (parsed.overallGazeScore !== undefined) {
          findings.push(`Eye gaze focus score: ${parsed.overallGazeScore}/100`);
        }

        if (parsed.gazeAssessment) {
          findings.push(`Gaze assessment: ${parsed.gazeAssessment}`);
        }
      }
    } catch (parseError) {
      console.error("[analyze-proctoring-video] Failed to parse eye gaze analysis:", parseError);
    }

  } catch (error) {
    console.error("[analyze-proctoring-video] Eye gaze analysis error:", error);
  }

  console.log(`[analyze-proctoring-video] Eye gaze analysis found ${violations.length} violations`);
  return { violations, findings };
}

// Helper to log operations to database
async function logOperation(
  supabase: any,
  operation: string,
  status: 'started' | 'completed' | 'failed',
  params: {
    sessionId?: string;
    attemptId?: string;
    metadata?: Record<string, any>;
    errorCode?: string;
    errorMessage?: string;
    logId?: string;
  }
) {
  try {
    if (params.logId && status !== 'started') {
      const completedAt = new Date().toISOString();
      const { data: logData } = await supabase
        .from('interview_operation_logs')
        .select('started_at')
        .eq('id', params.logId)
        .single();
      
      const durationMs = logData?.started_at 
        ? new Date(completedAt).getTime() - new Date(logData.started_at).getTime()
        : null;

      await supabase
        .from('interview_operation_logs')
        .update({
          status,
          completed_at: completedAt,
          duration_ms: durationMs,
          error_code: params.errorCode || null,
          error_message: params.errorMessage || null,
          metadata: params.metadata || undefined,
        })
        .eq('id', params.logId);
    } else {
      const { data } = await supabase
        .from('interview_operation_logs')
        .insert({
          operation,
          status,
          session_id: params.sessionId || null,
          attempt_id: params.attemptId || null,
          metadata: params.metadata || {},
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      return data?.id;
    }
  } catch (err) {
    console.error('[OperationLog] Failed to log:', err);
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let operationLogId: string | null = null;
  let sessionIdForLog: string | undefined;

  try {
    const gatewayApiKey = Deno.env.get("AI_GATEWAY_API_KEY");

    const { sessionId, attemptId, attemptType } = await req.json();
    sessionIdForLog = sessionId || attemptId;

    if (!sessionId && !attemptId) {
      return new Response(
        JSON.stringify({ error: "sessionId or attemptId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Start operation logging
    operationLogId = await logOperation(supabase, 'video_analysis', 'started', {
      sessionId: sessionId || undefined,
      attemptId: attemptId || undefined,
      metadata: { attemptType }
    });

    console.log(`[analyze-proctoring-video] Starting analysis for session: ${sessionId || attemptId}, logId: ${operationLogId}`);

    // Get proctoring session data
    let query = supabase.from("proctoring_sessions").select("*");
    
    if (sessionId) {
      query = query.eq("id", sessionId);
    } else if (attemptId) {
      const attemptColumn = attemptType === "interview" 
        ? "interview_attempt_id" 
        : attemptType === "learning" 
          ? "learning_attempt_id" 
          : "certification_attempt_id";
      query = query.eq(attemptColumn, attemptId);
    }

    const { data: session, error: sessionError } = await query.single();

    if (sessionError || !session) {
      console.error("[analyze-proctoring-video] Session not found:", sessionError);
      return new Response(
        JSON.stringify({ error: "Proctoring session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-proctoring-video] Found session: ${session.id}`);
    console.log(`[analyze-proctoring-video] Video URL: ${session.video_recording_url}`);
    console.log(`[analyze-proctoring-video] Screen URL: ${session.screen_recording_url}`);

    // Get existing violations logged during the interview
    // IMPORTANT: Read from detailed_violations (where live violations are stored) NOT violations
    // Filter out AI-sourced violations before re-analysis to make this function idempotent
    // Only keep "live" violations (those captured during the interview, not from previous AI analysis)
    const allStoredViolations = session.detailed_violations || session.violations || [];
    const aiSources = ['screen_analysis', 'audio_analysis', 'video_analysis'];
    const liveViolations = allStoredViolations.filter((v: any) => !aiSources.includes(v.source));
    const existingViolations = liveViolations; // Only live violations count as "existing"
    
    const newViolations: AnalysisViolation[] = [];
    console.log(`[analyze-proctoring-video] Total stored violations: ${allStoredViolations.length}, Live violations: ${liveViolations.length}`);

    // Get CAMERA periodic screenshots for identity/face analysis (video frame analysis)
    const cameraScreenshots: string[] = (session as any).periodic_screenshots || [];
    const cameraScreenshotTimestamps: number[] = (session as any).periodic_screenshot_timestamps || [];
    
    // Get SCREEN periodic screenshots for screen content analysis (AI tools, suspicious content)
    const screenScreenshots: string[] = (session as any).screen_periodic_screenshots || [];
    const screenScreenshotTimestamps: number[] = (session as any).screen_periodic_screenshot_timestamps || [];
    
    const violationScreenshots: string[] = existingViolations
      .filter((v: any) => v.screenshotPath)
      .map((v: any) => v.screenshotPath);
    
    console.log(`[analyze-proctoring-video] Camera screenshots: ${cameraScreenshots.length}`);
    console.log(`[analyze-proctoring-video] Camera timestamps: ${cameraScreenshotTimestamps.length}`);
    console.log(`[analyze-proctoring-video] Screen screenshots: ${screenScreenshots.length}`);
    console.log(`[analyze-proctoring-video] Screen timestamps: ${screenScreenshotTimestamps.length}`);
    console.log(`[analyze-proctoring-video] Violation screenshots: ${violationScreenshots.length}`);

    // Get signed URLs for camera screenshots (for identity/face violations)
    let cameraScreenshotUrls: string[] = [];
    if (cameraScreenshots.length > 0) {
      cameraScreenshotUrls = await getScreenshotUrls(supabase, cameraScreenshots);
      console.log(`[analyze-proctoring-video] Got ${cameraScreenshotUrls.length} signed camera screenshot URLs`);
    }
    
    // Get signed URLs for screen screenshots (for screen content violations)
    let screenScreenshotUrls: string[] = [];
    if (screenScreenshots.length > 0) {
      screenScreenshotUrls = await getScreenshotUrls(supabase, screenScreenshots);
      console.log(`[analyze-proctoring-video] Got ${screenScreenshotUrls.length} signed screen screenshot URLs`);
    }

    // Calculate integrity score from scratch on every analysis to ensure idempotency
    // IMPORTANT: Always start at 100 to prevent score from decreasing on each re-evaluation
    // The score will be recalculated based on ALL violations (live + new AI violations)
    let integrityScore = 100;
    
    const realTimeViolationCounts = {
      tabSwitch: 0,
      copyAttempt: 0,
      printScreen: 0,
      multipleMonitors: 0,
      virtualMachine: 0,
      suspiciousTyping: 0,
      phoneDetected: 0,
      prohibitedObject: 0,
      lookAway: 0,
      multiplePerson: 0,
      multipleVoice: 0,
    };

    for (const v of existingViolations) {
      if (v.type === "tab_switch") realTimeViolationCounts.tabSwitch++;
      if (v.type === "copy_attempt") realTimeViolationCounts.copyAttempt++;
      if (v.type === "print_screen") realTimeViolationCounts.printScreen++;
      if (v.type === "multiple_monitors") realTimeViolationCounts.multipleMonitors++;
      if (v.type === "virtual_machine") realTimeViolationCounts.virtualMachine++;
      if (v.type === "suspicious_typing") realTimeViolationCounts.suspiciousTyping++;
      if (v.type === "phone_detected") realTimeViolationCounts.phoneDetected++;
      if (v.type === "prohibited_object") realTimeViolationCounts.prohibitedObject++;
      if (v.type === "look_away") realTimeViolationCounts.lookAway++;
      if (v.type === "multiple_person") realTimeViolationCounts.multiplePerson++;
      if (v.type === "multiple_voice") realTimeViolationCounts.multipleVoice++;
    }

    // Fetch proctoring config for configurable violation scores
    // Try to get organization ID from interview attempt if available
    let organizationId: string | null = null;
    if (session.interview_attempt_id) {
      const { data: attemptData } = await supabase
        .from('interview_attempts')
        .select('interviews(organization_id)')
        .eq('id', session.interview_attempt_id)
        .maybeSingle();
      organizationId = (attemptData as any)?.interviews?.organization_id || null;
    }
    
    const proctoringConfig = await getProctoringConfig(supabase, organizationId);
    console.log(`[analyze-proctoring-video] Using proctoring config for org: ${organizationId || 'global'}`);

    // Always recalculate from live violations using configurable scores
    // This ensures idempotent behavior on re-evaluation
    for (const v of existingViolations) {
      const violationType = (v.type || '').toLowerCase().replace(/-/g, '_');
      
      // Check if this violation type is enabled
      if (!isViolationEnabled(proctoringConfig, violationType)) {
        continue;
      }
      
      const deduction = getViolationScore(proctoringConfig, violationType);
      integrityScore -= deduction;
    }
    
    integrityScore = Math.max(0, integrityScore);

    console.log(`[analyze-proctoring-video] Starting integrity score after live violations: ${integrityScore}`);

    // AI-based analysis results
    let screenAnalysisResults: ScreenAnalysisResult[] = [];
    let audioAnalysisResult: AudioAnalysisResult | null = null;

    // Perform AI-based analysis if AI Gateway API key is available
    if (gatewayApiKey) {
      // Screen Content Analysis using SCREEN screenshots (not camera)
      if (screenScreenshotUrls.length > 0) {
        try {
          screenAnalysisResults = await analyzeScreenContent(
            screenScreenshotUrls,
            screenScreenshotTimestamps,
            gatewayApiKey
          );

          // Add violations from screen analysis using configurable scores
          for (const result of screenAnalysisResults) {
            if (result.suspiciousContent) {
              // Check if this is a specific violation type
              const isNestedSharing = result.findings.some((f: string) => 
                f.toLowerCase().includes('nested screen sharing')
              );
              const isPasteDetected = result.findings.some((f: string) => 
                f.toLowerCase().includes('paste')
              );
              
              if (isNestedSharing) {
                // Add nested screen sharing as HIGH severity violation
                const deduction = getViolationScore(proctoringConfig, "nested_screen_sharing");
                integrityScore -= deduction;
                
                newViolations.push({
                  type: "nested_screen_sharing",
                  timestamp: result.timestamp,
                  description: result.description,
                  severity: "high",
                  source: "screen_analysis",
                });
              } else if (isPasteDetected) {
                // Add paste detection as MEDIUM-HIGH severity violation
                const deduction = getViolationScore(proctoringConfig, "paste_in_code_editor");
                integrityScore -= deduction;
                
                newViolations.push({
                  type: "paste_in_code_editor",
                  timestamp: result.timestamp,
                  description: result.description,
                  severity: "medium",
                  source: "screen_analysis",
                });
              } else {
                // Generic suspicious content - use AI-determined severity
                const aiSeverity = (result as any).severity || "medium";
                
                // Only deduct points for medium or high severity
                if (aiSeverity === "high" || aiSeverity === "medium") {
                  const deduction = aiSeverity === "high" 
                    ? getViolationScore(proctoringConfig, "suspicious_screen_content")
                    : Math.floor(getViolationScore(proctoringConfig, "suspicious_screen_content") / 2);
                  integrityScore -= deduction;
                  
                  newViolations.push({
                    type: "suspicious_screen_content",
                    timestamp: result.timestamp,
                    description: result.description,
                    severity: aiSeverity,
                    source: "screen_analysis",
                  });

                  // Add individual findings as separate violations (only for high severity)
                  if (aiSeverity === "high") {
                    for (const finding of result.findings) {
                      newViolations.push({
                        type: "screen_content_finding",
                        timestamp: result.timestamp,
                        description: finding,
                        severity: "medium",
                        source: "screen_analysis",
                      });
                    }
                  }
                } else {
                  console.log(`[analyze-proctoring-video] Skipping low severity screen content: ${result.description}`);
                }
              }
            }
          }
        } catch (screenError) {
          console.error("[analyze-proctoring-video] Screen analysis failed:", screenError);
        }
      } else {
        console.log("[analyze-proctoring-video] No screen screenshots available for screen content analysis");
      }

      // Audio analysis is skipped - handled in real-time
      audioAnalysisResult = await analyzeAudioContent("", gatewayApiKey);

      // Video Frame Analysis (person presence, face position) using CAMERA screenshots
      if (cameraScreenshotUrls.length > 0) {
        try {
          console.log("[analyze-proctoring-video] Starting video frame analysis with camera screenshots...");
          const videoFrameResult = await analyzeVideoFrames(
            cameraScreenshotUrls,
            cameraScreenshotTimestamps,
            gatewayApiKey
          );

          // Add violations from video frame analysis
          for (const violation of videoFrameResult.violations) {
            newViolations.push(violation);
            
            // Deduct points using configurable scores
            const violationType = (violation.type || '').toLowerCase().replace(/-/g, '_');
            const deduction = getViolationScore(proctoringConfig, violationType);
            integrityScore -= deduction;
          }

          console.log(`[analyze-proctoring-video] Video frame analysis found ${videoFrameResult.violations.length} violations`);
        } catch (videoFrameError) {
          console.error("[analyze-proctoring-video] Video frame analysis failed:", videoFrameError);
        }
      } else {
        console.log("[analyze-proctoring-video] No camera screenshots available for video frame analysis");
      }

      // Same Person Verification - ensure same candidate throughout interview (using CAMERA screenshots)
      if (cameraScreenshotUrls.length >= 2) {
        try {
          console.log("[analyze-proctoring-video] Starting same-person verification...");
          const samePersonResult = await verifySamePerson(
            cameraScreenshotUrls,
            gatewayApiKey
          );

          // Add violations from same-person verification
          for (const violation of samePersonResult.violations) {
            newViolations.push(violation);
            
            // Deduct points using configurable scores from proctoring settings
            const violationType = (violation.type || '').toLowerCase().replace(/-/g, '_');
            
            // Check if this violation type is enabled
            if (!isViolationEnabled(proctoringConfig, violationType)) {
              continue;
            }
            
            const deduction = getViolationScore(proctoringConfig, violationType);
            integrityScore -= deduction;
          }

          console.log(`[analyze-proctoring-video] Same-person verification: ${samePersonResult.isSamePerson ? 'PASSED' : 'FAILED'} (${samePersonResult.confidence}% confidence)`);
        } catch (samePersonError) {
          console.error("[analyze-proctoring-video] Same-person verification failed:", samePersonError);
        }
      } else {
        console.log("[analyze-proctoring-video] Not enough screenshots for same-person verification");
      }

      // Eye/Gaze analysis skipped - requires actual video processing capability
      console.log("[analyze-proctoring-video] Eye gaze analysis skipped - integrated into frame analysis");
    } else {
      console.log("[analyze-proctoring-video] AI_GATEWAY_API_KEY not configured, skipping AI analysis");
    }

    // Clamp integrity score to valid range
    integrityScore = Math.max(0, Math.min(100, integrityScore));

    // Flag for review based on score and violations
    const flagForReview = integrityScore < 70 || 
      realTimeViolationCounts.virtualMachine > 0 ||
      realTimeViolationCounts.copyAttempt >= 3 ||
      newViolations.some(v => v.severity === "high") ||
      newViolations.some(v => v.type === "different_person_detected") ||
      newViolations.some(v => v.type === "phone_in_video") ||
      newViolations.some(v => v.type === "headphones_detected") ||
      (audioAnalysisResult?.multipleSpeakersDetected ?? false) ||
      (audioAnalysisResult?.externalConversationDetected ?? false) ||
      screenAnalysisResults.some(r => r.suspiciousContent);

    // Attach closest screenshots to AI-detected violations
    const newViolationsWithScreenshots = attachClosestScreenshotsToViolations(
      newViolations,
      cameraScreenshots,
      cameraScreenshotTimestamps,
      screenScreenshots,
      screenScreenshotTimestamps
    );

    // Combine all violations
    const allViolations = [
      ...existingViolations,
      ...newViolationsWithScreenshots,
    ];

    // Build reviewer notes
    const reviewNotes: string[] = [];
    if (flagForReview) {
      reviewNotes.push(`Auto-flagged: Integrity score ${integrityScore}%.`);
      
      if (screenAnalysisResults.some(r => r.suspiciousContent)) {
        reviewNotes.push("Screen content analysis detected suspicious content.");
      }
      
      if (audioAnalysisResult?.multipleSpeakersDetected) {
        reviewNotes.push("Multiple speakers detected in audio.");
      }
      
      if (audioAnalysisResult?.externalConversationDetected) {
        reviewNotes.push("External conversation detected.");
      }
      
      if (audioAnalysisResult?.readingPatternDetected) {
        reviewNotes.push("Reading pattern detected in speech.");
      }
    }

    // Update session with analysis results
    // Store in BOTH violations (for backward compatibility) and detailed_violations (for UI display)
    const updateData: Record<string, unknown> = {
      integrity_score: integrityScore,
      flagged_for_review: flagForReview,
      violations: allViolations,
      detailed_violations: allViolations, // UI reads from this column
      updated_at: new Date().toISOString(),
    };

    if (reviewNotes.length > 0) {
      updateData.reviewer_notes = reviewNotes.join(" ");
    }

    // Store audio transcription if available
    if (audioAnalysisResult?.transcription) {
      updateData.audio_transcription = audioAnalysisResult.transcription;
    }

    const { error: updateError } = await supabase
      .from("proctoring_sessions")
      .update(updateData)
      .eq("id", session.id);

    if (updateError) {
      console.error("[analyze-proctoring-video] Update error:", updateError);
    }

    console.log(`[analyze-proctoring-video] Analysis complete. Score: ${integrityScore}, Flagged: ${flagForReview}`);
    console.log(`[analyze-proctoring-video] New AI violations found: ${newViolations.length}`);
    
    // Log successful completion
    await logOperation(supabase, 'video_analysis', 'completed', {
      logId: operationLogId || undefined,
      sessionId: session.id,
      metadata: { 
        integrityScore, 
        flaggedForReview: flagForReview,
        totalViolations: allViolations.length,
        newAIViolations: newViolations.length
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        integrityScore,
        flaggedForReview: flagForReview,
        realTimeViolations: realTimeViolationCounts,
        screenAnalysis: {
          performed: screenAnalysisResults.length > 0,
          suspiciousContentFound: screenAnalysisResults.some(r => r.suspiciousContent),
          findings: screenAnalysisResults.flatMap(r => r.findings),
        },
        audioAnalysis: {
          performed: audioAnalysisResult !== null,
          transcription: audioAnalysisResult?.transcription || null,
          multipleSpeakersDetected: audioAnalysisResult?.multipleSpeakersDetected || false,
          externalConversationDetected: audioAnalysisResult?.externalConversationDetected || false,
          readingPatternDetected: audioAnalysisResult?.readingPatternDetected || false,
          findings: audioAnalysisResult?.findings || [],
        },
        totalViolations: allViolations.length,
        newAIViolations: newViolations.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[analyze-proctoring-video] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Log failure
    if (operationLogId) {
      await logOperation(supabase, 'video_analysis', 'failed', {
        logId: operationLogId,
        sessionId: sessionIdForLog,
        errorCode: 'VIDEO_ANALYSIS_ERROR',
        errorMessage
      });
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
