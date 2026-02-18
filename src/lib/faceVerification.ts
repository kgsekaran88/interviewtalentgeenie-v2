/**
 * Face Verification Library
 * Captures reference face and continuously compares during session
 */

import { logger } from '@/lib/logger';

export interface FaceVerificationResult {
  isMatch: boolean;
  similarity: number; // 0-1
  confidence: number;
  referenceSet: boolean;
  mismatchCount: number;
  lastMatchTime: number;
}

interface FaceFeatures {
  histogram: number[];
  aspectRatio: number;
  brightness: number;
  colorProfile: number[];
  timestamp: number;
}

export class FaceVerifier {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private referenceFeatures: FaceFeatures | null = null;
  private featureHistory: FaceFeatures[] = [];
  private mismatchCount = 0;
  private lastMatchTime = Date.now();
  private consecutiveMismatches = 0;
  
  // Thresholds
  private readonly SIMILARITY_THRESHOLD = 0.7;
  private readonly HISTOGRAM_BINS = 32;
  private readonly FEATURE_HISTORY_SIZE = 10;
  private readonly MISMATCH_ALERT_THRESHOLD = 3;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Capture reference face from video
   */
  async captureReference(video: HTMLVideoElement, faceBox?: { xmin: number; ymin: number; xmax: number; ymax: number }): Promise<boolean> {
    if (!video || video.readyState < 2) {
      logger.error('Video not ready for reference capture');
      return false;
    }

    try {
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
      this.ctx.drawImage(video, 0, 0);

      const features = this.extractFeatures(faceBox);
      if (features) {
        this.referenceFeatures = features;
        logger.proctoring('Reference face captured successfully');
        return true;
      }
    } catch (error) {
      logger.error('Error capturing reference face:', error);
    }
    return false;
  }

  /**
   * Verify current face against reference
   */
  async verify(video: HTMLVideoElement, faceBox?: { xmin: number; ymin: number; xmax: number; ymax: number }): Promise<FaceVerificationResult> {
    const defaultResult: FaceVerificationResult = {
      isMatch: false,
      similarity: 0,
      confidence: 0,
      referenceSet: !!this.referenceFeatures,
      mismatchCount: this.mismatchCount,
      lastMatchTime: this.lastMatchTime,
    };

    if (!this.referenceFeatures) {
      return defaultResult;
    }

    if (!video || video.readyState < 2) {
      return defaultResult;
    }

    try {
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
      this.ctx.drawImage(video, 0, 0);

      const currentFeatures = this.extractFeatures(faceBox);
      if (!currentFeatures) {
        return defaultResult;
      }

      // Add to feature history
      this.featureHistory.push(currentFeatures);
      if (this.featureHistory.length > this.FEATURE_HISTORY_SIZE) {
        this.featureHistory.shift();
      }

      // Calculate similarity
      const similarity = this.calculateSimilarity(this.referenceFeatures, currentFeatures);
      const isMatch = similarity >= this.SIMILARITY_THRESHOLD;

      // Update tracking
      if (isMatch) {
        this.lastMatchTime = Date.now();
        this.consecutiveMismatches = 0;
      } else {
        this.consecutiveMismatches++;
        if (this.consecutiveMismatches >= this.MISMATCH_ALERT_THRESHOLD) {
          this.mismatchCount++;
        }
      }

      // Calculate confidence based on consistency
      const confidence = this.calculateConfidence(similarity);

      return {
        isMatch,
        similarity,
        confidence,
        referenceSet: true,
        mismatchCount: this.mismatchCount,
        lastMatchTime: this.lastMatchTime,
      };
    } catch (error) {
      logger.error('Error verifying face:', error);
      return defaultResult;
    }
  }

  /**
   * Extract face features for comparison
   */
  private extractFeatures(faceBox?: { xmin: number; ymin: number; xmax: number; ymax: number }): FaceFeatures | null {
    try {
      let x: number, y: number, width: number, height: number;

      if (faceBox) {
        x = (faceBox.xmin / 100) * this.canvas.width;
        y = (faceBox.ymin / 100) * this.canvas.height;
        width = ((faceBox.xmax - faceBox.xmin) / 100) * this.canvas.width;
        height = ((faceBox.ymax - faceBox.ymin) / 100) * this.canvas.height;
      } else {
        // Assume centered face
        width = this.canvas.width * 0.4;
        height = this.canvas.height * 0.5;
        x = (this.canvas.width - width) / 2;
        y = (this.canvas.height - height) / 2;
      }

      // Ensure bounds are valid
      x = Math.max(0, Math.min(x, this.canvas.width - 1));
      y = Math.max(0, Math.min(y, this.canvas.height - 1));
      width = Math.min(width, this.canvas.width - x);
      height = Math.min(height, this.canvas.height - y);

      if (width < 10 || height < 10) {
        return null;
      }

      const imageData = this.ctx.getImageData(x, y, width, height);
      
      // Calculate grayscale histogram
      const histogram = this.calculateHistogram(imageData);
      
      // Calculate aspect ratio
      const aspectRatio = width / height;
      
      // Calculate average brightness
      const brightness = this.calculateBrightness(imageData);
      
      // Calculate color profile
      const colorProfile = this.calculateColorProfile(imageData);

      return {
        histogram,
        aspectRatio,
        brightness,
        colorProfile,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Error extracting features:', error);
      return null;
    }
  }

  /**
   * Calculate grayscale histogram
   */
  private calculateHistogram(imageData: ImageData): number[] {
    const histogram = new Array(this.HISTOGRAM_BINS).fill(0);
    const data = imageData.data;
    const binSize = 256 / this.HISTOGRAM_BINS;

    for (let i = 0; i < data.length; i += 4) {
      const grayscale = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      const bin = Math.min(Math.floor(grayscale / binSize), this.HISTOGRAM_BINS - 1);
      histogram[bin]++;
    }

    // Normalize
    const total = data.length / 4;
    return histogram.map(count => count / total);
  }

  /**
   * Calculate average brightness
   */
  private calculateBrightness(imageData: ImageData): number {
    const data = imageData.data;
    let sum = 0;

    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }

    return sum / (data.length / 4) / 255;
  }

  /**
   * Calculate color profile (RGB averages)
   */
  private calculateColorProfile(imageData: ImageData): number[] {
    const data = imageData.data;
    let r = 0, g = 0, b = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    return [r / pixelCount / 255, g / pixelCount / 255, b / pixelCount / 255];
  }

  /**
   * Calculate similarity between reference and current features
   */
  private calculateSimilarity(reference: FaceFeatures, current: FaceFeatures): number {
    // Histogram similarity (correlation coefficient)
    const histogramSim = this.correlationCoefficient(reference.histogram, current.histogram);
    
    // Aspect ratio similarity
    const aspectSim = 1 - Math.abs(reference.aspectRatio - current.aspectRatio) / Math.max(reference.aspectRatio, current.aspectRatio);
    
    // Brightness similarity (with tolerance for lighting changes)
    const brightnessDiff = Math.abs(reference.brightness - current.brightness);
    const brightnessSim = 1 - Math.min(brightnessDiff / 0.3, 1); // 30% tolerance
    
    // Color profile similarity
    const colorSim = this.colorSimilarity(reference.colorProfile, current.colorProfile);

    // Weighted combination
    const weights = { histogram: 0.5, aspect: 0.15, brightness: 0.15, color: 0.2 };
    const similarity = 
      weights.histogram * histogramSim +
      weights.aspect * aspectSim +
      weights.brightness * brightnessSim +
      weights.color * colorSim;

    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private correlationCoefficient(a: number[], b: number[]): number {
    const n = a.length;
    const sumA = a.reduce((s, v) => s + v, 0);
    const sumB = b.reduce((s, v) => s + v, 0);
    const sumAB = a.reduce((s, v, i) => s + v * b[i], 0);
    const sumA2 = a.reduce((s, v) => s + v * v, 0);
    const sumB2 = b.reduce((s, v) => s + v * v, 0);

    const numerator = n * sumAB - sumA * sumB;
    const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));

    if (denominator === 0) return 0;
    return (numerator / denominator + 1) / 2; // Normalize to 0-1
  }

  /**
   * Calculate color profile similarity
   */
  private colorSimilarity(a: number[], b: number[]): number {
    const diff = Math.sqrt(
      Math.pow(a[0] - b[0], 2) +
      Math.pow(a[1] - b[1], 2) +
      Math.pow(a[2] - b[2], 2)
    );
    return 1 - Math.min(diff / 0.5, 1); // Max diff of 0.5 = no similarity
  }

  /**
   * Calculate confidence based on historical consistency
   */
  private calculateConfidence(currentSimilarity: number): number {
    if (this.featureHistory.length < 3) {
      return currentSimilarity;
    }

    // Check consistency of recent comparisons
    const recentSimilarities = this.featureHistory.slice(-5).map(f => 
      this.referenceFeatures ? this.calculateSimilarity(this.referenceFeatures, f) : 0
    );
    
    const avgSimilarity = recentSimilarities.reduce((a, b) => a + b, 0) / recentSimilarities.length;
    const variance = recentSimilarities.reduce((sum, s) => sum + Math.pow(s - avgSimilarity, 2), 0) / recentSimilarities.length;
    
    // Higher confidence with lower variance (consistent results)
    const consistencyBonus = Math.max(0, 0.1 - variance) * 2;
    
    return Math.min(1, currentSimilarity + consistencyBonus);
  }

  /**
   * Check if there's been a recent person swap (different person)
   */
  hasPersonSwapped(): boolean {
    return this.consecutiveMismatches >= this.MISMATCH_ALERT_THRESHOLD;
  }

  /**
   * Get time since last verified match
   */
  getTimeSinceLastMatch(): number {
    return Date.now() - this.lastMatchTime;
  }

  /**
   * Reset verification state
   */
  reset(): void {
    this.referenceFeatures = null;
    this.featureHistory = [];
    this.mismatchCount = 0;
    this.lastMatchTime = Date.now();
    this.consecutiveMismatches = 0;
  }

  /**
   * Check if reference is set
   */
  hasReference(): boolean {
    return this.referenceFeatures !== null;
  }

  /**
   * Get statistics
   */
  getStats(): { mismatchCount: number; lastMatchTime: number; consecutiveMismatches: number } {
    return {
      mismatchCount: this.mismatchCount,
      lastMatchTime: this.lastMatchTime,
      consecutiveMismatches: this.consecutiveMismatches,
    };
  }
}

/**
 * Create face verifier instance
 */
export function createFaceVerifier(): FaceVerifier {
  return new FaceVerifier();
}
