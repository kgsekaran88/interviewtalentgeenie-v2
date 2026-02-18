/**
 * Real-time Gaze Detection using MediaPipe Face Mesh
 * 
 * This module provides accurate iris/pupil tracking for detecting
 * when candidates are looking at other screens/monitors during proctoring.
 * 
 * Uses MediaPipe Face Mesh which tracks 468 facial landmarks including:
 * - Iris center positions (landmarks 468-477)
 * - Eye corner positions
 * - Head pose estimation
 * 
 * Model size: ~2MB (much smaller than DETR's 44MB)
 * Speed: ~5-10ms per frame
 */

import { logger } from '@/lib/logger';

// Lazy loading - don't load until needed
let faceMeshInstance: any = null;
let isInitializing = false;
let initPromise: Promise<any> | null = null;
let initializationFailed = false;

export interface GazeResult {
  isLookingAway: boolean;
  direction: 'center' | 'left' | 'right' | 'up' | 'down';
  confidence: number;
  /** Normalized iris position: -1 (full left) to 1 (full right) */
  horizontalGaze: number;
  /** Normalized iris position: -1 (full up) to 1 (full down) */
  verticalGaze: number;
  /** Head rotation in degrees */
  headPose?: {
    yaw: number;   // Left/right rotation
    pitch: number; // Up/down rotation
    roll: number;  // Tilt
  };
  /** Was this result from fallback heuristic? */
  isFallback: boolean;
}

export interface GazeDetectionCallbacks {
  onGazeChange: (result: GazeResult) => void;
  onLookAwayStart?: () => void;
  onLookAwayEnd?: () => void;
  onError?: (error: Error) => void;
}

// MediaPipe Face Mesh landmark indices
const LEFT_EYE_IRIS_CENTER = 468;
const RIGHT_EYE_IRIS_CENTER = 473;
const LEFT_EYE_INNER_CORNER = 133;
const LEFT_EYE_OUTER_CORNER = 33;
const RIGHT_EYE_INNER_CORNER = 362;
const RIGHT_EYE_OUTER_CORNER = 263;
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;

/**
 * Initialize MediaPipe Face Mesh - LAZY LOADED
 * Returns null if initialization fails (allows fallback to heuristic)
 */
export async function initializeGazeDetection(): Promise<boolean> {
  if (faceMeshInstance) return true;
  if (initializationFailed) return false;
  if (isInitializing && initPromise) {
    try {
      await initPromise;
      return !!faceMeshInstance;
    } catch {
      return false;
    }
  }

  isInitializing = true;

  initPromise = (async () => {
    try {
      logger.proctoring('[GazeDetection] Lazy loading MediaPipe Face Mesh...');

      // Dynamic import of MediaPipe
      const vision = await import('@mediapipe/tasks-vision');
      const { FaceLandmarker, FilesetResolver } = vision;

      // Load the vision WASM files
      const wasmFileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Create the face landmarker with iris tracking enabled
      faceMeshInstance = await FaceLandmarker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU', // Use GPU for better performance
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true, // For head pose
      });

      logger.proctoring('[GazeDetection] MediaPipe Face Mesh initialized successfully');
      return true;
    } catch (error) {
      logger.error('[GazeDetection] Failed to initialize MediaPipe:', error);
      initializationFailed = true;
      faceMeshInstance = null;
      return false;
    } finally {
      isInitializing = false;
    }
  })();

  try {
    return await initPromise;
  } catch {
    return false;
  }
}

/**
 * Check if gaze detection is available (MediaPipe loaded successfully)
 */
export function isGazeDetectionAvailable(): boolean {
  return !!faceMeshInstance && !initializationFailed;
}

/**
 * Calculate gaze direction from iris position within eye
 */
function calculateGazeFromIris(
  irisCenter: { x: number; y: number },
  innerCorner: { x: number; y: number },
  outerCorner: { x: number; y: number }
): { horizontal: number; vertical: number } {
  // Calculate eye width
  const eyeWidth = Math.abs(outerCorner.x - innerCorner.x);
  const eyeCenter = (innerCorner.x + outerCorner.x) / 2;
  
  // Normalize iris position within eye (-1 to 1)
  // Negative = looking left, Positive = looking right
  const horizontal = eyeWidth > 0 ? ((irisCenter.x - eyeCenter) / (eyeWidth / 2)) : 0;
  
  // For vertical, use y position relative to eye corners midpoint
  const eyeMidY = (innerCorner.y + outerCorner.y) / 2;
  const vertical = (irisCenter.y - eyeMidY) * 5; // Scale up for sensitivity
  
  return {
    horizontal: Math.max(-1, Math.min(1, horizontal)),
    vertical: Math.max(-1, Math.min(1, vertical)),
  };
}

/**
 * Extract head pose from facial transformation matrix
 */
function extractHeadPose(matrix: number[]): { yaw: number; pitch: number; roll: number } | undefined {
  if (!matrix || matrix.length < 16) return undefined;
  
  try {
    // Extract rotation angles from 4x4 transformation matrix
    // Matrix is column-major: [m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33]
    const m00 = matrix[0], m01 = matrix[1], m02 = matrix[2];
    const m10 = matrix[4], m11 = matrix[5], m12 = matrix[6];
    const m20 = matrix[8], m21 = matrix[9], m22 = matrix[10];
    
    // Calculate Euler angles (in radians, then convert to degrees)
    const pitch = Math.asin(-m12) * (180 / Math.PI);
    const yaw = Math.atan2(m02, m22) * (180 / Math.PI);
    const roll = Math.atan2(m10, m11) * (180 / Math.PI);
    
    return { yaw, pitch, roll };
  } catch {
    return undefined;
  }
}

/**
 * Detect gaze direction from a video frame
 * Returns GazeResult with detailed eye tracking information
 */
export async function detectGaze(
  video: HTMLVideoElement,
  timestamp: number = performance.now()
): Promise<GazeResult> {
  // Default result (fallback)
  const fallbackResult: GazeResult = {
    isLookingAway: false,
    direction: 'center',
    confidence: 0,
    horizontalGaze: 0,
    verticalGaze: 0,
    isFallback: true,
  };

  if (!video || video.readyState < 2) {
    return fallbackResult;
  }

  // If MediaPipe not available, return fallback
  if (!faceMeshInstance) {
    // Try to initialize
    const initialized = await initializeGazeDetection();
    if (!initialized) {
      return fallbackResult;
    }
  }

  try {
    // Run face mesh detection
    const results = faceMeshInstance.detectForVideo(video, timestamp);
    
    if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
      return { ...fallbackResult, confidence: 0.5 }; // No face detected
    }

    const landmarks = results.faceLandmarks[0];
    
    // Get iris and eye corner positions
    const leftIris = landmarks[LEFT_EYE_IRIS_CENTER];
    const rightIris = landmarks[RIGHT_EYE_IRIS_CENTER];
    const leftInner = landmarks[LEFT_EYE_INNER_CORNER];
    const leftOuter = landmarks[LEFT_EYE_OUTER_CORNER];
    const rightInner = landmarks[RIGHT_EYE_INNER_CORNER];
    const rightOuter = landmarks[RIGHT_EYE_OUTER_CORNER];

    if (!leftIris || !rightIris) {
      return fallbackResult;
    }

    // Calculate gaze for both eyes
    const leftGaze = calculateGazeFromIris(leftIris, leftInner, leftOuter);
    const rightGaze = calculateGazeFromIris(rightIris, rightInner, rightOuter);

    // Average both eyes for final gaze
    const horizontalGaze = (leftGaze.horizontal + rightGaze.horizontal) / 2;
    const verticalGaze = (leftGaze.vertical + rightGaze.vertical) / 2;

    // Get head pose from transformation matrix
    let headPose: { yaw: number; pitch: number; roll: number } | undefined;
    if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
      headPose = extractHeadPose(results.facialTransformationMatrixes[0].data);
    }

    // Determine if looking away
    // Thresholds tuned for detecting side monitor usage
    const HORIZONTAL_THRESHOLD = 0.25; // 25% off-center triggers
    const VERTICAL_THRESHOLD = 0.3;
    const HEAD_YAW_THRESHOLD = 15; // 15 degrees head turn

    const isHorizontallyOff = Math.abs(horizontalGaze) > HORIZONTAL_THRESHOLD;
    const isVerticallyOff = Math.abs(verticalGaze) > VERTICAL_THRESHOLD;
    const isHeadTurned = headPose && Math.abs(headPose.yaw) > HEAD_YAW_THRESHOLD;

    const isLookingAway = isHorizontallyOff || isVerticallyOff || isHeadTurned;

    // Determine direction
    let direction: 'center' | 'left' | 'right' | 'up' | 'down' = 'center';
    if (isLookingAway) {
      if (Math.abs(horizontalGaze) > Math.abs(verticalGaze)) {
        direction = horizontalGaze < 0 ? 'left' : 'right';
      } else {
        direction = verticalGaze < 0 ? 'up' : 'down';
      }
    }

    // Calculate confidence based on how clearly we detected the gaze
    const gazeStrength = Math.max(Math.abs(horizontalGaze), Math.abs(verticalGaze));
    const confidence = Math.min(0.5 + gazeStrength, 1);

    return {
      isLookingAway,
      direction,
      confidence,
      horizontalGaze,
      verticalGaze,
      headPose,
      isFallback: false,
    };
  } catch (error) {
    logger.error('[GazeDetection] Detection error:', error);
    return fallbackResult;
  }
}

/**
 * Start continuous gaze detection with callbacks
 * Runs at higher frequency than face detection for accurate tracking
 */
export function startContinuousGazeDetection(
  video: HTMLVideoElement,
  callbacks: GazeDetectionCallbacks,
  intervalMs: number = 200 // Check every 200ms (5 times per second)
): () => void {
  let isRunning = true;
  let wasLookingAway = false;
  let lookAwayStartTime: number | null = null;
  let detectionTimeout: ReturnType<typeof setTimeout>;
  let lastTimestamp = performance.now();

  const runDetection = async () => {
    if (!isRunning) return;

    try {
      const now = performance.now();
      // Ensure timestamps are monotonically increasing
      const timestamp = Math.max(now, lastTimestamp + 1);
      lastTimestamp = timestamp;

      const result = await detectGaze(video, timestamp);
      callbacks.onGazeChange(result);

      // Track look-away state changes
      if (result.isLookingAway && !wasLookingAway) {
        wasLookingAway = true;
        lookAwayStartTime = Date.now();
        callbacks.onLookAwayStart?.();
      } else if (!result.isLookingAway && wasLookingAway) {
        wasLookingAway = false;
        lookAwayStartTime = null;
        callbacks.onLookAwayEnd?.();
      }
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }

    if (isRunning) {
      detectionTimeout = setTimeout(runDetection, intervalMs);
    }
  };

  // Initialize and start
  initializeGazeDetection().then((initialized) => {
    if (initialized && isRunning) {
      logger.proctoring('[GazeDetection] Starting continuous detection at', intervalMs, 'ms intervals');
      runDetection();
    } else if (!initialized) {
      logger.warn('[GazeDetection] MediaPipe not available, gaze detection disabled');
      callbacks.onError?.(new Error('MediaPipe Face Mesh not available'));
    }
  });

  // Return cleanup function
  return () => {
    isRunning = false;
    if (detectionTimeout) {
      clearTimeout(detectionTimeout);
    }
    logger.proctoring('[GazeDetection] Stopped continuous detection');
  };
}

/**
 * Clean up resources
 */
export function cleanupGazeDetection(): void {
  if (faceMeshInstance) {
    try {
      faceMeshInstance.close();
    } catch (e) {
      logger.error('[GazeDetection] Error closing face mesh:', e);
    }
    faceMeshInstance = null;
  }
  isInitializing = false;
  initPromise = null;
  initializationFailed = false;
}
