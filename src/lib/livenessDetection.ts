import { logger } from '@/lib/logger';

/**
 * Liveness Detection Library
 * Provides blink detection, head movement tracking, and anti-spoofing measures
 */

export interface LivenessResult {
  isLive: boolean;
  blinkDetected: boolean;
  headMovement: 'stable' | 'moving' | 'excessive';
  headPosition: { x: number; y: number };
  spoofingRisk: 'low' | 'medium' | 'high';
  confidence: number;
  checks: {
    blinkCheck: boolean;
    movementCheck: boolean;
    varianceCheck: boolean;
  };
}

interface FacePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  timestamp: number;
}

export class LivenessDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private positionHistory: FacePosition[] = [];
  private brightnessHistory: number[] = [];
  private blinkHistory: { timestamp: number; detected: boolean }[] = [];
  private lastBrightness = 0;
  private blinkCooldown = false;
  private challengeActive = false;
  
  // Thresholds
  private readonly POSITION_HISTORY_SIZE = 30;
  private readonly BRIGHTNESS_HISTORY_SIZE = 20;
  private readonly BLINK_THRESHOLD = 0.15; // Brightness drop threshold for blink
  private readonly MOVEMENT_THRESHOLD = 5; // Pixels
  private readonly EXCESSIVE_MOVEMENT_THRESHOLD = 30;
  private readonly SPOOF_VARIANCE_THRESHOLD = 0.02; // Too consistent = likely photo

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Analyze a video frame for liveness indicators
   */
  async analyze(video: HTMLVideoElement, faceBox?: { xmin: number; ymin: number; xmax: number; ymax: number }): Promise<LivenessResult> {
    if (!video || video.readyState < 2) {
      return this.getDefaultResult();
    }

    // Update canvas size
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
    this.ctx.drawImage(video, 0, 0);

    // Get face region
    const faceRegion = faceBox ? this.extractFaceRegion(faceBox) : this.estimateFaceRegion();
    
    // Analyze eye region for blinks
    const blinkDetected = this.detectBlink(faceRegion);
    
    // Track head movement
    const headMovement = this.analyzeHeadMovement(faceRegion);
    
    // Check for spoofing (photo/video replay)
    const spoofingAnalysis = this.detectSpoofing();
    
    // Calculate overall liveness score
    const checks = {
      blinkCheck: this.hasRecentBlinks(),
      movementCheck: headMovement !== 'stable' || this.hasNaturalMicroMovements(),
      varianceCheck: spoofingAnalysis.varianceOk,
    };
    
    const isLive = Object.values(checks).filter(Boolean).length >= 2;
    const confidence = this.calculateConfidence(checks, spoofingAnalysis);

    return {
      isLive,
      blinkDetected,
      headMovement,
      headPosition: { x: faceRegion.x, y: faceRegion.y },
      spoofingRisk: spoofingAnalysis.risk,
      confidence,
      checks,
    };
  }

  /**
   * Extract face region from detection box
   */
  private extractFaceRegion(box: { xmin: number; ymin: number; xmax: number; ymax: number }): FacePosition {
    const x = (box.xmin + box.xmax) / 2 / 100 * this.canvas.width;
    const y = (box.ymin + box.ymax) / 2 / 100 * this.canvas.height;
    const width = (box.xmax - box.xmin) / 100 * this.canvas.width;
    const height = (box.ymax - box.ymin) / 100 * this.canvas.height;
    
    return { x, y, width, height, timestamp: Date.now() };
  }

  /**
   * Estimate face region when no detection box available
   */
  private estimateFaceRegion(): FacePosition {
    // Assume face is centered
    return {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      width: this.canvas.width * 0.3,
      height: this.canvas.height * 0.4,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect blink by analyzing eye region brightness changes
   */
  private detectBlink(faceRegion: FacePosition): boolean {
    // Extract upper face region (eye area)
    const eyeY = faceRegion.y - faceRegion.height * 0.1;
    const eyeHeight = faceRegion.height * 0.25;
    const eyeX = faceRegion.x - faceRegion.width * 0.3;
    const eyeWidth = faceRegion.width * 0.6;

    // Get eye region brightness
    const imageData = this.ctx.getImageData(
      Math.max(0, eyeX),
      Math.max(0, eyeY),
      Math.min(eyeWidth, this.canvas.width - eyeX),
      Math.min(eyeHeight, this.canvas.height - eyeY)
    );

    let brightness = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      brightness += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
    }
    brightness = brightness / (imageData.data.length / 4) / 255;

    this.brightnessHistory.push(brightness);
    if (this.brightnessHistory.length > this.BRIGHTNESS_HISTORY_SIZE) {
      this.brightnessHistory.shift();
    }

    // Detect sudden brightness drop (blink)
    const brightnessDrop = this.lastBrightness - brightness;
    this.lastBrightness = brightness;

    if (brightnessDrop > this.BLINK_THRESHOLD && !this.blinkCooldown) {
      this.blinkCooldown = true;
      setTimeout(() => { this.blinkCooldown = false; }, 300); // 300ms cooldown
      
      this.blinkHistory.push({ timestamp: Date.now(), detected: true });
      if (this.blinkHistory.length > 20) {
        this.blinkHistory.shift();
      }
      
      logger.proctoring('Blink detected!', { brightnessDrop, brightness });
      return true;
    }

    return false;
  }

  /**
   * Check if there have been recent blinks (indicates live person)
   */
  private hasRecentBlinks(): boolean {
    const recentTime = Date.now() - 30000; // Last 30 seconds
    const recentBlinks = this.blinkHistory.filter(b => b.timestamp > recentTime && b.detected);
    return recentBlinks.length >= 2; // At least 2 blinks in 30 seconds (normal is 15-20 per minute)
  }

  /**
   * Analyze head movement patterns
   */
  private analyzeHeadMovement(faceRegion: FacePosition): 'stable' | 'moving' | 'excessive' {
    this.positionHistory.push(faceRegion);
    if (this.positionHistory.length > this.POSITION_HISTORY_SIZE) {
      this.positionHistory.shift();
    }

    if (this.positionHistory.length < 5) {
      return 'stable';
    }

    // Calculate movement variance
    const recentPositions = this.positionHistory.slice(-10);
    let totalMovement = 0;
    
    for (let i = 1; i < recentPositions.length; i++) {
      const dx = recentPositions[i].x - recentPositions[i - 1].x;
      const dy = recentPositions[i].y - recentPositions[i - 1].y;
      totalMovement += Math.sqrt(dx * dx + dy * dy);
    }

    const avgMovement = totalMovement / (recentPositions.length - 1);

    if (avgMovement > this.EXCESSIVE_MOVEMENT_THRESHOLD) {
      return 'excessive';
    } else if (avgMovement > this.MOVEMENT_THRESHOLD) {
      return 'moving';
    }
    return 'stable';
  }

  /**
   * Check for natural micro-movements (photos don't have these)
   */
  private hasNaturalMicroMovements(): boolean {
    if (this.positionHistory.length < 10) return false;

    const recentPositions = this.positionHistory.slice(-10);
    let microMovements = 0;

    for (let i = 1; i < recentPositions.length; i++) {
      const dx = Math.abs(recentPositions[i].x - recentPositions[i - 1].x);
      const dy = Math.abs(recentPositions[i].y - recentPositions[i - 1].y);
      
      // Count micro-movements (1-3 pixels - natural human tremor)
      if ((dx >= 0.5 && dx <= 3) || (dy >= 0.5 && dy <= 3)) {
        microMovements++;
      }
    }

    return microMovements >= 3; // At least 3 micro-movements
  }

  /**
   * Detect potential spoofing (photo or video replay attack)
   */
  private detectSpoofing(): { risk: 'low' | 'medium' | 'high'; varianceOk: boolean } {
    if (this.brightnessHistory.length < 10) {
      return { risk: 'medium', varianceOk: true };
    }

    // Check brightness variance - photos have very consistent brightness
    const avgBrightness = this.brightnessHistory.reduce((a, b) => a + b, 0) / this.brightnessHistory.length;
    const variance = this.brightnessHistory.reduce((sum, b) => sum + Math.pow(b - avgBrightness, 2), 0) / this.brightnessHistory.length;

    const varianceOk = variance > this.SPOOF_VARIANCE_THRESHOLD;

    // Check position variance - photos don't move naturally
    const positionVariance = this.calculatePositionVariance();
    
    // Combine checks
    let riskScore = 0;
    if (!varianceOk) riskScore += 2;
    if (positionVariance < 2) riskScore += 2;
    if (!this.hasRecentBlinks()) riskScore += 1;

    let risk: 'low' | 'medium' | 'high';
    if (riskScore >= 4) {
      risk = 'high';
    } else if (riskScore >= 2) {
      risk = 'medium';
    } else {
      risk = 'low';
    }

    return { risk, varianceOk };
  }

  /**
   * Calculate position variance
   */
  private calculatePositionVariance(): number {
    if (this.positionHistory.length < 5) return 10; // Assume variance if not enough data

    const xValues = this.positionHistory.map(p => p.x);
    const yValues = this.positionHistory.map(p => p.y);

    const avgX = xValues.reduce((a, b) => a + b, 0) / xValues.length;
    const avgY = yValues.reduce((a, b) => a + b, 0) / yValues.length;

    const varX = xValues.reduce((sum, x) => sum + Math.pow(x - avgX, 2), 0) / xValues.length;
    const varY = yValues.reduce((sum, y) => sum + Math.pow(y - avgY, 2), 0) / yValues.length;

    return Math.sqrt(varX + varY);
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(checks: LivenessResult['checks'], spoofAnalysis: { risk: string; varianceOk: boolean }): number {
    let score = 0.5; // Base score

    if (checks.blinkCheck) score += 0.2;
    if (checks.movementCheck) score += 0.15;
    if (checks.varianceCheck) score += 0.15;

    if (spoofAnalysis.risk === 'high') score -= 0.3;
    else if (spoofAnalysis.risk === 'medium') score -= 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get default result when analysis isn't possible
   */
  private getDefaultResult(): LivenessResult {
    return {
      isLive: false,
      blinkDetected: false,
      headMovement: 'stable',
      headPosition: { x: 0, y: 0 },
      spoofingRisk: 'high',
      confidence: 0,
      checks: {
        blinkCheck: false,
        movementCheck: false,
        varianceCheck: false,
      },
    };
  }

  /**
   * Reset detection state
   */
  reset(): void {
    this.positionHistory = [];
    this.brightnessHistory = [];
    this.blinkHistory = [];
    this.lastBrightness = 0;
  }

  /**
   * Issue a liveness challenge (e.g., "blink now")
   */
  startChallenge(onComplete: (passed: boolean) => void): void {
    this.challengeActive = true;
    const startTime = Date.now();
    const startBlinks = this.blinkHistory.length;

    // Wait for blink within 5 seconds
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newBlinks = this.blinkHistory.length - startBlinks;

      if (newBlinks > 0) {
        clearInterval(checkInterval);
        this.challengeActive = false;
        onComplete(true);
      } else if (elapsed > 5000) {
        clearInterval(checkInterval);
        this.challengeActive = false;
        onComplete(false);
      }
    }, 100);
  }

  /**
   * Get current challenge status
   */
  isChallengeActive(): boolean {
    return this.challengeActive;
  }
}

/**
 * Create and start liveness detection
 */
export function createLivenessDetector(): LivenessDetector {
  return new LivenessDetector();
}
