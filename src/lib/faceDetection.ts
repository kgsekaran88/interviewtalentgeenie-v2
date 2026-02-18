import { logger } from '@/lib/logger';

// LAZY LOADING: Do NOT import @huggingface/transformers at module level
// This prevents the ~44MB+ model from being downloaded on page load
// The import happens dynamically only when face detection is actually needed

let detectionPipeline: any = null;
let isInitializing = false;
let initPromise: Promise<any> | null = null;

/**
 * Initialize the face detection pipeline - LAZY LOADED
 * Uses dynamic import to prevent blocking page load
 * Uses DETR ResNet-50 for object detection
 */
export async function initializeFaceDetection() {
  // Return existing pipeline if already initialized
  if (detectionPipeline) {
    return detectionPipeline;
  }

  // Return existing promise if initialization is in progress
  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  
  initPromise = (async () => {
    try {
      logger.proctoring('Lazy loading face detection module...');
      
      // CRITICAL: Dynamic import - only loads the library when actually called
      const { pipeline, env } = await import('@huggingface/transformers');
      
      // Configure after dynamic import
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      logger.proctoring('Initializing face detection pipeline...');
      
      // Use object detection model optimized for faces
      try {
        detectionPipeline = await pipeline(
          'object-detection',
          'Xenova/detr-resnet-50',
          { 
            device: 'webgpu',
            revision: 'main'
          }
        );
        logger.proctoring('Face detection pipeline initialized successfully with WebGPU');
      } catch (webgpuError) {
        logger.warn('WebGPU not available, falling back to CPU:', webgpuError);
        // Fallback to CPU if WebGPU fails
        detectionPipeline = await pipeline(
          'object-detection',
          'Xenova/detr-resnet-50'
        );
        logger.proctoring('Face detection initialized on CPU');
      }
      
      return detectionPipeline;
    } catch (error) {
      logger.error('Failed to initialize face detection:', error);
      isInitializing = false;
      initPromise = null;
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

export interface EyeGazeResult {
  isLookingAway: boolean;
  confidence: number;
  direction: 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown';
}

export interface ProhibitedObjectDetection {
  label: string;
  score: number;
  box: any;
}

export interface FaceDetectionResult {
  personCount: number;
  detections: Array<{ label: string; score: number; box: any }>;
  timestamp: number;
  eyeGaze?: EyeGazeResult;
  prohibitedObjects?: ProhibitedObjectDetection[]; // Phones, books, etc.
}

// Prohibited objects that shouldn't be in frame during proctoring
// NOTE: Detection requires ACTIVE USE context - background objects should be filtered
export const PROHIBITED_OBJECTS = [
  'cell phone', 'mobile phone', 'phone', 
  'book', 'laptop', 'tablet', 
  'remote', 'tv', 'monitor',
  'paper', 'notebook'
];

// Zone-based detection: Only flag objects in the "active zone" (center of frame)
// Objects in periphery (background, shelves, walls) are likely not being actively used
const ACTIVE_ZONE_MARGIN = 0.15; // 15% margin from edges = center 70% is "active zone"

// LOWERED thresholds for better detection of multiple people
const MIN_BBOX_AREA = 0.5; // Lowered from 2.0 - detect smaller/distant faces
const MIN_BBOX_DIMENSION = 4; // Lowered from 8 - more sensitive to partial faces

/**
 * Calculate Intersection over Union (IoU) for two bounding boxes
 */
function calculateIoU(box1: any, box2: any): number {
  const x1 = Math.max(box1.xmin, box2.xmin);
  const y1 = Math.max(box1.ymin, box2.ymin);
  const x2 = Math.min(box1.xmax, box2.xmax);
  const y2 = Math.min(box1.ymax, box2.ymax);
  
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
  const area2 = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);
  const union = area1 + area2 - intersection;
  
  return union > 0 ? intersection / union : 0;
}

/**
 * Apply Non-Maximum Suppression to merge overlapping detections
 * Using higher IoU threshold to allow closer detections
 */
function applyNMS(detections: any[], iouThreshold: number = 0.6): any[] {
  if (detections.length <= 1) return detections;
  
  // Sort by confidence score (descending)
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const selected: any[] = [];
  const suppressed = new Set<number>();
  
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    
    selected.push(sorted[i]);
    
    // Suppress overlapping detections with lower scores
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;
      
      const iou = calculateIoU(sorted[i].box, sorted[j].box);
      if (iou > iouThreshold) {
        suppressed.add(j);
      }
    }
  }
  
  return selected;
}

/**
 * Filter detections by minimum bounding box size
 */
function filterBySize(detections: any[]): any[] {
  return detections.filter((detection: any) => {
    const width = detection.box.xmax - detection.box.xmin;
    const height = detection.box.ymax - detection.box.ymin;
    const area = width * height / 100; // Convert to percentage of frame
    
    // Must have minimum area AND minimum dimension
    return area >= MIN_BBOX_AREA && width >= MIN_BBOX_DIMENSION && height >= MIN_BBOX_DIMENSION;
  });
}

/**
 * Detect faces in a video element
 * @param video - HTMLVideoElement to analyze
 * @param confidenceThreshold - Minimum confidence score (0-1) - LOWERED for better sensitivity
 * @returns Detection result with person count and confidence scores
 */
export async function detectFaces(
  video: HTMLVideoElement,
  confidenceThreshold: number = 0.5 // LOWERED from 0.8 for better multiple person detection
): Promise<FaceDetectionResult> {
  if (!detectionPipeline) {
    await initializeFaceDetection();
  }

  if (!video || video.readyState < 2) {
    return { personCount: 0, detections: [], timestamp: Date.now() };
  }

  try {
    // Create canvas and capture frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob for processing
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9); // Higher quality for better detection
    });

    const blobUrl = URL.createObjectURL(blob);
    
    // Run detection with even lower initial threshold
    const results = await detectionPipeline(blobUrl, {
      threshold: 0.3, // LOWERED from 0.5 - catch more potential detections
      percentage: true,
    });
    
    // Clean up blob URL
    URL.revokeObjectURL(blobUrl);

    // Filter for person detections - use provided confidence threshold
    let personDetections = results.filter(
      (detection: any) => detection.label === 'person' && detection.score >= confidenceThreshold
    );
    
    // Apply size filtering to remove small/false detections
    personDetections = filterBySize(personDetections);
    
    // Apply Non-Maximum Suppression with higher threshold to keep distinct people
    personDetections = applyNMS(personDetections, 0.6);
    
    // Detect prohibited objects (phones, books, etc.) - VERY HIGH confidence required to avoid false positives
    // IMPORTANT: DETR model often misclassifies objects as phones, so require 95%+ confidence for phones
    // 
    // FALSE POSITIVE REDUCTION:
    // 1. Zone-based filtering: Objects in the periphery (background, shelves) are likely not being actively used
    // 2. High confidence thresholds: 95% for phones, 85% for other objects
    // 3. Size-based filtering: Very small objects are likely background decorations
    const prohibitedObjects: ProhibitedObjectDetection[] = results
      .filter((detection: any) => {
        const label = detection.label.toLowerCase();
        const isProhibited = PROHIBITED_OBJECTS.some(obj => label.includes(obj));
        
        if (!isProhibited) return false;
        
        // Require 95% confidence for phones, 85% for other objects to reduce false positives
        const requiredConfidence = label.includes('phone') ? 0.95 : 0.85;
        if (detection.score < requiredConfidence) {
          return false;
        }
        
        // Zone-based filtering: Check if object is in the "active zone" (center of frame)
        // Objects on the edges (shelves, walls, background) are likely not being actively used
        const box = detection.box;
        const centerX = (box.xmin + box.xmax) / 2;
        const centerY = (box.ymin + box.ymax) / 2;
        
        // Check if object center is in the active zone (center 70% of frame)
        const inActiveZoneX = centerX > (ACTIVE_ZONE_MARGIN * 100) && centerX < (100 - ACTIVE_ZONE_MARGIN * 100);
        const inActiveZoneY = centerY > (ACTIVE_ZONE_MARGIN * 100) && centerY < (100 - ACTIVE_ZONE_MARGIN * 100);
        const inActiveZone = inActiveZoneX && inActiveZoneY;
        
        // Size-based filtering: Very small objects are likely background decorations or images
        const width = box.xmax - box.xmin;
        const height = box.ymax - box.ymin;
        const area = width * height / 100; // Convert to percentage of frame
        const minAreaForViolation = 2.0; // Must occupy at least 2% of frame to be considered active
        
        if (!inActiveZone) {
          logger.proctoring(`[ProhibitedObject] FILTERED (periphery): ${label} at center (${centerX.toFixed(0)}%, ${centerY.toFixed(0)}%) - likely background`);
          return false;
        }
        
        if (area < minAreaForViolation) {
          logger.proctoring(`[ProhibitedObject] FILTERED (too small): ${label} area ${area.toFixed(1)}% < ${minAreaForViolation}% - likely image/decoration`);
          return false;
        }
        
        return true;
      })
      .map((d: any) => ({
        label: d.label,
        score: d.score,
        box: d.box,
      }));
    
    // Log detailed detection info for debugging
    if (personDetections.length > 1) {
      logger.proctoring(`⚠️ MULTIPLE PEOPLE DETECTED: ${personDetections.length} persons`, 
        personDetections.map((d: any) => ({ score: d.score.toFixed(2), box: d.box })));
    } else {
      logger.proctoring(`Face detection: ${results.length} raw -> ${personDetections.length} filtered (threshold: ${confidenceThreshold})`);
    }
    
    // Log prohibited objects (only those that passed filtering)
    if (prohibitedObjects.length > 0) {
      logger.proctoring(`⚠️ PROHIBITED OBJECTS DETECTED (in active zone):`, prohibitedObjects.map(o => `${o.label} (${(o.score * 100).toFixed(0)}%)`));
    }

    // Analyze eye gaze for the primary detection
    let eyeGaze: EyeGazeResult | undefined;
    if (personDetections.length > 0) {
      eyeGaze = analyzeEyeGaze(personDetections[0], video);
    }

    return {
      personCount: personDetections.length,
      detections: personDetections.map((d: any) => ({
        label: d.label,
        score: d.score,
        box: d.box,
      })),
      timestamp: Date.now(),
      eyeGaze,
      prohibitedObjects,
    };
  } catch (error) {
    logger.error('Error during face detection:', error);
    return { personCount: 0, detections: [], timestamp: Date.now() };
  }
}

/**
 * Analyzes eye gaze direction based on face position and size
 * Uses heuristics to estimate if person is looking away from screen
 */
function analyzeEyeGaze(
  detection: { label: string; score: number; box: any },
  video: HTMLVideoElement
): EyeGazeResult {
  const { box } = detection;
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  
  // Calculate face center position relative to frame
  const faceCenterX = (box.xmin + box.xmax) / 2 / 100; // Convert percentage to 0-1
  const faceCenterY = (box.ymin + box.ymax) / 2 / 100;
  
  // Expected center range (person looking at screen should be centered)
  const centerThreshold = 0.15;
  const isCentered = Math.abs(faceCenterX - 0.5) < centerThreshold && 
                     Math.abs(faceCenterY - 0.5) < centerThreshold;
  
  // Determine gaze direction based on face position
  let direction: 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown' = 'center';
  
  if (!isCentered) {
    if (faceCenterX < 0.4) direction = 'right'; // Face on left means looking right
    else if (faceCenterX > 0.6) direction = 'left'; // Face on right means looking left
    else if (faceCenterY < 0.4) direction = 'down'; // Face high means looking down
    else if (faceCenterY > 0.6) direction = 'up'; // Face low means looking up
  }
  
  // Calculate confidence based on face size (smaller face = less confident)
  const faceWidth = box.xmax - box.xmin;
  const faceHeight = box.ymax - box.ymin;
  const faceSize = (faceWidth * faceHeight) / 10000; // Normalize percentage area
  const sizeConfidence = Math.min(faceSize / 15, 1); // Normalize to ~15% as ideal size
  
  const isLookingAway = !isCentered;
  const confidence = detection.score * sizeConfidence;
  
  return {
    isLookingAway,
    confidence,
    direction,
  };
}

/**
 * Continuous face detection with callback
 * @param video - Video element to monitor
 * @param onDetection - Callback with detection results
 * @param intervalMs - Detection interval in milliseconds - REDUCED for faster detection
 * @returns Cleanup function to stop detection
 */
export function startContinuousDetection(
  video: HTMLVideoElement,
  onDetection: (result: FaceDetectionResult) => void,
  intervalMs: number = 1500 // REDUCED from 3000 - check every 1.5 seconds for faster detection
): () => void {
  let isRunning = true;
  let detectionTimeout: NodeJS.Timeout;

  const runDetection = async () => {
    if (!isRunning) return;

    try {
      const result = await detectFaces(video);
      onDetection(result);
    } catch (error) {
      logger.error('Detection error:', error);
    }

    if (isRunning) {
      detectionTimeout = setTimeout(runDetection, intervalMs);
    }
  };

  // Start detection
  runDetection();

  // Return cleanup function
  return () => {
    isRunning = false;
    if (detectionTimeout) {
      clearTimeout(detectionTimeout);
    }
  };
}

/**
 * Check camera quality and lighting
 */
export async function analyzeCameraQuality(
  video: HTMLVideoElement
): Promise<{
  brightness: number;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  recommendation?: string;
}> {
  if (!video || video.readyState < 2) {
    return { brightness: 0, quality: 'poor', recommendation: 'Video not ready' };
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return { brightness: 0, quality: 'poor', recommendation: 'Canvas not available' };
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Calculate average brightness
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalBrightness += (r + g + b) / 3;
  }
  const brightness = totalBrightness / (data.length / 4) / 255;

  // Determine quality
  let quality: 'poor' | 'fair' | 'good' | 'excellent';
  let recommendation: string | undefined;

  if (brightness < 0.25) {
    quality = 'poor';
    recommendation = 'Lighting is too dark. Please improve lighting conditions.';
  } else if (brightness < 0.4) {
    quality = 'fair';
    recommendation = 'Lighting could be better. Consider adding more light.';
  } else if (brightness < 0.85) {
    quality = 'good';
  } else if (brightness < 0.95) {
    quality = 'excellent';
  } else {
    quality = 'fair';
    recommendation = 'Video appears overexposed. Please reduce lighting or adjust camera.';
  }

  return { brightness, quality, recommendation };
}
