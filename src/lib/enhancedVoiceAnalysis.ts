import { logger } from "@/lib/logger";

/**
 * Enhanced Voice Analysis Library
 * Improved multiple voice detection, noise categorization, and silence anomaly detection
 */

export interface EnhancedVoiceResult {
  audioLevel: number;
  backgroundNoiseLevel: number;
  multipleVoicesDetected: boolean;
  voiceCount: number; // Estimated number of speakers
  noiseCategory: 'silent' | 'ambient' | 'speech' | 'music' | 'noise';
  silenceAnomaly: boolean; // Unusual silence patterns
  speechActivity: boolean;
  confidence: number;
  frequency: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
}

interface SpeechSegment {
  startTime: number;
  endTime: number;
  avgLevel: number;
}

export class EnhancedVoiceAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private isRunning = false;
  private animationFrameId: number | null = null;
  
  // Calibration
  private baselineNoise = 0;
  private calibrationSamples: number[] = [];
  private isCalibrated = false;
  
  // Speech tracking
  private speechHistory: { timestamp: number; level: number; isSpeech: boolean }[] = [];
  private speechSegments: SpeechSegment[] = [];
  private lastSpeechTime = 0;
  private silenceStartTime = 0;
  
  // Multi-voice detection
  private voicePrints: number[][] = [];
  private dominantFreqHistory: number[] = [];
  
  // Thresholds
  private readonly SPEECH_THRESHOLD = 0.15;
  private readonly SILENCE_ANOMALY_DURATION = 20000; // 20 seconds of silence is anomalous
  private readonly HISTORY_SIZE = 100;
  private readonly VOICE_FREQ_MIN = 85;
  private readonly VOICE_FREQ_MAX = 400;

  async initialize(stream: MediaStream): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096; // Higher resolution for better frequency analysis
      this.analyser.smoothingTimeConstant = 0.8;
      
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      
      this.timeData = new Uint8Array(this.analyser.fftSize);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      
      logger.proctoring('Enhanced voice analyzer initialized');
      await this.calibrate();
    } catch (error) {
      logger.error('Error initializing enhanced voice analyzer:', error);
      throw error;
    }
  }

  private async calibrate(): Promise<void> {
    return new Promise((resolve) => {
      logger.proctoring('Calibrating enhanced voice analyzer...');
      this.calibrationSamples = [];
      
      const interval = setInterval(() => {
        if (!this.analyser || !this.timeData) return;
        
        this.analyser.getByteTimeDomainData(this.timeData);
        const level = this.calculateRMS(this.timeData);
        this.calibrationSamples.push(level);
        
        if (this.calibrationSamples.length >= 30) {
          clearInterval(interval);
          this.baselineNoise = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
          this.isCalibrated = true;
          logger.proctoring('Enhanced voice analyzer calibrated. Baseline:', this.baselineNoise.toFixed(4));
          resolve();
        }
      }, 100);
    });
  }

  startAnalysis(onAnalysis: (result: EnhancedVoiceResult) => void): void {
    if (!this.audioContext || !this.analyser) {
      throw new Error('Enhanced voice analyzer not initialized');
    }
    
    this.isRunning = true;
    
    const analyze = () => {
      if (!this.isRunning || !this.analyser || !this.timeData || !this.freqData) return;
      
      this.analyser.getByteTimeDomainData(this.timeData);
      this.analyser.getByteFrequencyData(this.freqData);
      
      const result = this.performAnalysis();
      onAnalysis(result);
      
      this.animationFrameId = requestAnimationFrame(analyze);
    };
    
    analyze();
  }

  stopAnalysis(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private performAnalysis(): EnhancedVoiceResult {
    const audioLevel = this.calculateRMS(this.timeData!);
    const backgroundNoiseLevel = this.calculateBackgroundNoise(audioLevel);
    const zeroCrossingRate = this.calculateZeroCrossingRate(this.timeData!);
    const spectralCentroid = this.calculateSpectralCentroid(this.freqData!);
    const frequency = this.getDominantFrequency(this.freqData!);
    
    // Speech detection
    const speechActivity = this.detectSpeechActivity(audioLevel, zeroCrossingRate, spectralCentroid);
    
    // Multiple voice detection
    const { multipleVoicesDetected, voiceCount } = this.detectMultipleVoices(audioLevel, spectralCentroid);
    
    // Noise categorization
    const noiseCategory = this.categorizeNoise(audioLevel, zeroCrossingRate, spectralCentroid, speechActivity);
    
    // Silence anomaly detection
    const silenceAnomaly = this.detectSilenceAnomaly(speechActivity, audioLevel);
    
    // Update history
    this.updateHistory(audioLevel, speechActivity);
    
    const confidence = this.calculateConfidence(audioLevel, speechActivity);
    
    return {
      audioLevel,
      backgroundNoiseLevel,
      multipleVoicesDetected,
      voiceCount,
      noiseCategory,
      silenceAnomaly,
      speechActivity,
      confidence,
      frequency,
      spectralCentroid,
      zeroCrossingRate,
    };
  }

  private calculateRMS(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / data.length);
  }

  private calculateBackgroundNoise(audioLevel: number): number {
    if (!this.isCalibrated) return audioLevel;
    return Math.min(audioLevel / Math.max(this.baselineNoise * 2, 0.1), 1);
  }

  private calculateZeroCrossingRate(data: Uint8Array): number {
    let crossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 128 && data[i - 1] < 128) || (data[i] < 128 && data[i - 1] >= 128)) {
        crossings++;
      }
    }
    return crossings / data.length;
  }

  private calculateSpectralCentroid(freqData: Uint8Array): number {
    let weightedSum = 0;
    let sum = 0;
    const nyquist = (this.audioContext?.sampleRate || 48000) / 2;
    
    for (let i = 0; i < freqData.length; i++) {
      const frequency = (i / freqData.length) * nyquist;
      weightedSum += frequency * freqData[i];
      sum += freqData[i];
    }
    
    return sum > 0 ? weightedSum / sum : 0;
  }

  private getDominantFrequency(freqData: Uint8Array): number {
    let maxValue = 0;
    let maxIndex = 0;
    
    // Focus on voice frequency range
    const nyquist = (this.audioContext?.sampleRate || 48000) / 2;
    const minBin = Math.floor((this.VOICE_FREQ_MIN / nyquist) * freqData.length);
    const maxBin = Math.ceil((this.VOICE_FREQ_MAX / nyquist) * freqData.length);
    
    for (let i = minBin; i < Math.min(maxBin, freqData.length); i++) {
      if (freqData[i] > maxValue) {
        maxValue = freqData[i];
        maxIndex = i;
      }
    }
    
    return (maxIndex / freqData.length) * nyquist;
  }

  private detectSpeechActivity(audioLevel: number, zcr: number, centroid: number): boolean {
    // Speech has:
    // - Moderate audio level (above noise floor)
    // - Low to moderate ZCR (voiced sounds)
    // - Centroid in voice range (200-3000 Hz)
    
    const levelOk = audioLevel > this.SPEECH_THRESHOLD;
    const zcrOk = zcr > 0.02 && zcr < 0.3;
    const centroidOk = centroid > 200 && centroid < 3000;
    
    return levelOk && (zcrOk || centroidOk);
  }

  private detectMultipleVoices(audioLevel: number, centroid: number): { multipleVoicesDetected: boolean; voiceCount: number } {
    if (audioLevel < this.SPEECH_THRESHOLD) {
      return { multipleVoicesDetected: false, voiceCount: 0 };
    }
    
    // Track dominant frequency changes
    this.dominantFreqHistory.push(centroid);
    if (this.dominantFreqHistory.length > 30) {
      this.dominantFreqHistory.shift();
    }
    
    if (this.dominantFreqHistory.length < 10) {
      return { multipleVoicesDetected: false, voiceCount: 1 };
    }
    
    // Analyze frequency variation - multiple voices have higher variance and multiple clusters
    const avgFreq = this.dominantFreqHistory.reduce((a, b) => a + b, 0) / this.dominantFreqHistory.length;
    const variance = this.dominantFreqHistory.reduce((sum, f) => sum + Math.pow(f - avgFreq, 2), 0) / this.dominantFreqHistory.length;
    const stdDev = Math.sqrt(variance);
    
    // Find frequency clusters
    const clusters = this.findFrequencyClusters(this.dominantFreqHistory);
    
    // Multiple voices indicated by:
    // - High frequency variance
    // - Multiple distinct frequency clusters
    const highVariance = stdDev > 200;
    const multipleClusters = clusters.length >= 2;
    
    const multipleVoicesDetected = highVariance && multipleClusters;
    const voiceCount = multipleClusters ? clusters.length : (audioLevel > this.SPEECH_THRESHOLD ? 1 : 0);
    
    return { multipleVoicesDetected, voiceCount: Math.min(voiceCount, 3) };
  }

  private findFrequencyClusters(frequencies: number[]): number[][] {
    if (frequencies.length === 0) return [];
    
    const sorted = [...frequencies].sort((a, b) => a - b);
    const clusters: number[][] = [];
    let currentCluster: number[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] < 100) { // Within 100 Hz = same cluster
        currentCluster.push(sorted[i]);
      } else {
        if (currentCluster.length >= 3) { // Minimum cluster size
          clusters.push(currentCluster);
        }
        currentCluster = [sorted[i]];
      }
    }
    
    if (currentCluster.length >= 3) {
      clusters.push(currentCluster);
    }
    
    return clusters;
  }

  private categorizeNoise(audioLevel: number, zcr: number, centroid: number, isSpeech: boolean): EnhancedVoiceResult['noiseCategory'] {
    if (audioLevel < 0.02) {
      return 'silent';
    }
    
    if (isSpeech) {
      return 'speech';
    }
    
    // Music: steady amplitude, centroid in music range
    if (centroid > 1000 && centroid < 8000 && zcr < 0.1) {
      return 'music';
    }
    
    // High ZCR + low centroid = noise (fans, typing, etc.)
    if (zcr > 0.3 || centroid > 8000) {
      return 'noise';
    }
    
    return 'ambient';
  }

  private detectSilenceAnomaly(isSpeech: boolean, audioLevel: number): boolean {
    const now = Date.now();
    
    if (isSpeech || audioLevel > this.SPEECH_THRESHOLD) {
      this.lastSpeechTime = now;
      this.silenceStartTime = 0;
      return false;
    }
    
    // Track silence duration
    if (this.silenceStartTime === 0) {
      this.silenceStartTime = now;
    }
    
    const silenceDuration = now - this.silenceStartTime;
    
    // Anomaly if silence exceeds threshold during what should be an interview
    if (silenceDuration > this.SILENCE_ANOMALY_DURATION && this.speechHistory.some(h => h.isSpeech)) {
      return true;
    }
    
    return false;
  }

  private updateHistory(audioLevel: number, isSpeech: boolean): void {
    const now = Date.now();
    
    this.speechHistory.push({ timestamp: now, level: audioLevel, isSpeech });
    if (this.speechHistory.length > this.HISTORY_SIZE) {
      this.speechHistory.shift();
    }
    
    // Update speech segments
    if (isSpeech) {
      const lastSegment = this.speechSegments[this.speechSegments.length - 1];
      if (lastSegment && now - lastSegment.endTime < 500) {
        // Extend current segment
        lastSegment.endTime = now;
        lastSegment.avgLevel = (lastSegment.avgLevel + audioLevel) / 2;
      } else {
        // Start new segment
        this.speechSegments.push({ startTime: now, endTime: now, avgLevel: audioLevel });
        if (this.speechSegments.length > 20) {
          this.speechSegments.shift();
        }
      }
    }
  }

  private calculateConfidence(audioLevel: number, speechActivity: boolean): number {
    let confidence = 0.5;
    
    if (this.isCalibrated) confidence += 0.2;
    if (audioLevel > this.SPEECH_THRESHOLD) confidence += 0.15;
    if (this.speechHistory.length >= 50) confidence += 0.15;
    
    return Math.min(1, confidence);
  }

  /**
   * Get speech statistics
   */
  getSpeechStats(): { totalSpeechTime: number; averageLevel: number; segmentCount: number } {
    const totalSpeechTime = this.speechSegments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
    const avgLevel = this.speechSegments.length > 0
      ? this.speechSegments.reduce((sum, seg) => sum + seg.avgLevel, 0) / this.speechSegments.length
      : 0;
    
    return {
      totalSpeechTime,
      averageLevel: avgLevel,
      segmentCount: this.speechSegments.length,
    };
  }

  dispose(): void {
    this.stopAnalysis();
    
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.timeData = null;
    this.freqData = null;
  }
}

/**
 * Create enhanced voice analyzer
 */
export function createEnhancedVoiceAnalyzer(): EnhancedVoiceAnalyzer {
  return new EnhancedVoiceAnalyzer();
}
