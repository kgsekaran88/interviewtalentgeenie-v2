/**
 * Enhanced Voice Analysis Library
 * Provides audio level detection, background noise analysis, and improved multiple voice detection
 */
import { logger } from '@/lib/logger';

export interface VoiceAnalysisResult {
  audioLevel: number; // 0-1
  backgroundNoiseLevel: number; // 0-1
  multipleVoicesDetected: boolean;
  confidence: number;
  frequency: number;
  voiceCount: number; // Estimated number of distinct voices
  spectralComplexity: number; // 0-1, higher = more complex audio (multiple sources)
}

export class VoiceAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private isRunning = false;
  private onAnalysis: ((result: VoiceAnalysisResult) => void) | null = null;
  private animationFrameId: number | null = null;
  
  // Calibration values
  private baselineNoise = 0;
  private calibrationSamples: number[] = [];
  private isCalibrated = false;
  
  // History for temporal analysis (detecting multiple speakers over time)
  private frequencyHistory: number[] = [];
  private energyHistory: number[] = [];
  private readonly HISTORY_SIZE = 30; // ~1 second of history at 30fps

  async initialize(stream: MediaStream): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create analyser with higher resolution
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096; // INCREASED from 2048 for better frequency resolution
      this.analyser.smoothingTimeConstant = 0.6; // REDUCED from 0.8 for faster response
      
      // Connect microphone
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      
      // Create data array
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      logger.proctoring('Voice analyzer initialized with enhanced detection');
      
      // Auto-calibrate for 2 seconds
      await this.calibrate();
    } catch (error) {
      logger.error('Error initializing voice analyzer:', error);
      throw error;
    }
  }

  /**
   * Calibrate baseline noise level
   */
  private async calibrate(): Promise<void> {
    return new Promise((resolve) => {
      logger.proctoring('Calibrating voice analyzer...');
      this.calibrationSamples = [];
      
      const calibrationInterval = setInterval(() => {
        if (!this.analyser || !this.dataArray) return;
        
        this.analyser.getByteTimeDomainData(this.dataArray);
        const level = this.calculateAudioLevel(this.dataArray);
        this.calibrationSamples.push(level);
        
        if (this.calibrationSamples.length >= 20) { // 2 seconds at ~10 samples/sec
          clearInterval(calibrationInterval);
          
          // Calculate baseline as average of calibration samples
          this.baselineNoise = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
          this.isCalibrated = true;
          
          logger.proctoring('Voice analyzer calibrated. Baseline noise:', this.baselineNoise.toFixed(3));
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Start continuous voice analysis
   */
  startAnalysis(onAnalysis: (result: VoiceAnalysisResult) => void): void {
    if (!this.audioContext || !this.analyser || !this.dataArray) {
      throw new Error('Voice analyzer not initialized');
    }
    
    this.isRunning = true;
    this.onAnalysis = onAnalysis;
    this.frequencyHistory = [];
    this.energyHistory = [];
    this.analyze();
  }

  /**
   * Stop voice analysis
   */
  stopAnalysis(): void {
    this.isRunning = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main analysis loop
   */
  private analyze = (): void => {
    if (!this.isRunning || !this.analyser || !this.dataArray || !this.onAnalysis) {
      return;
    }

    // Get time domain data
    this.analyser.getByteTimeDomainData(this.dataArray);
    
    // Get frequency data
    const freqData = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    this.analyser.getByteFrequencyData(freqData);

    // Calculate audio level
    const audioLevel = this.calculateAudioLevel(this.dataArray);
    
    // Calculate background noise
    const backgroundNoiseLevel = this.isCalibrated 
      ? Math.min(audioLevel / Math.max(this.baselineNoise * 2, 0.1), 1)
      : audioLevel;
    
    // Enhanced multiple voices detection
    const { detected: multipleVoicesDetected, voiceCount, spectralComplexity } = 
      this.detectMultipleVoicesEnhanced(freqData, audioLevel);
    
    // Calculate dominant frequency
    const frequency = this.calculateDominantFrequency(freqData);
    
    // Update history for temporal analysis
    this.updateHistory(frequency, audioLevel);
    
    // Calculate confidence based on signal strength and history consistency
    const confidence = this.calculateConfidence(audioLevel, spectralComplexity);

    const result: VoiceAnalysisResult = {
      audioLevel,
      backgroundNoiseLevel,
      multipleVoicesDetected,
      confidence,
      frequency,
      voiceCount,
      spectralComplexity,
    };

    this.onAnalysis(result);

    // Continue analysis
    this.animationFrameId = requestAnimationFrame(this.analyze);
  };

  /**
   * Update frequency and energy history for temporal analysis
   */
  private updateHistory(frequency: number, energy: number): void {
    this.frequencyHistory.push(frequency);
    this.energyHistory.push(energy);
    
    if (this.frequencyHistory.length > this.HISTORY_SIZE) {
      this.frequencyHistory.shift();
      this.energyHistory.shift();
    }
  }

  /**
   * Calculate audio level from time domain data
   */
  private calculateAudioLevel(dataArray: Uint8Array<ArrayBuffer>): number {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    return Math.min(rms, 1);
  }

  /**
   * Enhanced multiple voices detection using spectral analysis
   * Uses multiple techniques for better accuracy
   */
  private detectMultipleVoicesEnhanced(
    freqData: Uint8Array<ArrayBuffer>, 
    audioLevel: number
  ): { detected: boolean; voiceCount: number; spectralComplexity: number } {
    // Need minimum audio level to analyze
    if (audioLevel < 0.05) { // LOWERED threshold from 0.1
      return { detected: false, voiceCount: 0, spectralComplexity: 0 };
    }
    
    const sampleRate = this.audioContext?.sampleRate || 48000;
    const binWidth = sampleRate / (this.analyser?.fftSize || 4096);
    
    // Human voice fundamental frequency ranges:
    // Male: 85-180 Hz, Female: 165-255 Hz, Children: 250-400 Hz
    // With harmonics extending to 4-5 kHz
    
    // Analyze multiple frequency bands for voice content
    const voiceBands = [
      { start: 80, end: 180, name: 'male_fundamental' },
      { start: 165, end: 255, name: 'female_fundamental' },
      { start: 250, end: 400, name: 'child_fundamental' },
      { start: 400, end: 1000, name: 'first_harmonic' },
      { start: 1000, end: 2000, name: 'second_harmonic' },
      { start: 2000, end: 4000, name: 'high_harmonics' },
    ];
    
    const bandEnergies: { [key: string]: number } = {};
    let totalVoiceEnergy = 0;
    
    for (const band of voiceBands) {
      const energy = this.getFrequencyBandEnergy(freqData, band.start, band.end, binWidth);
      bandEnergies[band.name] = energy;
      totalVoiceEnergy += energy;
    }
    
    // Calculate spectral complexity (entropy-like measure)
    const spectralComplexity = this.calculateSpectralComplexity(freqData);
    
    // Count distinct frequency peaks in voice range
    const peaks = this.findSpectralPeaks(freqData, 80, 4000, binWidth);
    
    // Analyze temporal variation in dominant frequency (voice switching)
    const frequencyVariation = this.calculateFrequencyVariation();
    
    // Multiple voice indicators:
    // 1. Multiple strong peaks in fundamental frequency range
    // 2. High spectral complexity
    // 3. Rapid frequency changes (speakers alternating)
    // 4. Energy in multiple distinct fundamental ranges simultaneously
    
    const fundamentalPeaks = peaks.filter(p => p.frequency >= 80 && p.frequency <= 400);
    const distinctFundamentals = this.countDistinctPeaks(fundamentalPeaks);
    
    // Check for simultaneous energy in different fundamental ranges
    const maleFundamentalActive = bandEnergies['male_fundamental'] > 0.15;
    const femaleFundamentalActive = bandEnergies['female_fundamental'] > 0.15;
    const childFundamentalActive = bandEnergies['child_fundamental'] > 0.15;
    const activeFundamentals = [maleFundamentalActive, femaleFundamentalActive, childFundamentalActive]
      .filter(Boolean).length;
    
    // Determine if multiple voices detected
    let voiceCount = 1;
    let detected = false;
    
    // Detection criteria (MORE SENSITIVE):
    // - 2+ distinct fundamental peaks OR
    // - High spectral complexity (> 0.5) with audio activity OR
    // - Energy in 2+ different fundamental ranges OR
    // - High frequency variation over time
    if (distinctFundamentals >= 2) {
      voiceCount = distinctFundamentals;
      detected = true;
      logger.proctoring(`🔊 Multiple voices detected: ${distinctFundamentals} distinct fundamentals`);
    } else if (spectralComplexity > 0.5 && audioLevel > 0.1) {
      voiceCount = Math.max(2, Math.round(spectralComplexity * 3));
      detected = true;
      logger.proctoring(`🔊 Multiple voices detected: high spectral complexity (${spectralComplexity.toFixed(2)})`);
    } else if (activeFundamentals >= 2) {
      voiceCount = activeFundamentals;
      detected = true;
      logger.proctoring(`🔊 Multiple voices detected: ${activeFundamentals} active fundamental ranges`);
    } else if (frequencyVariation > 100 && audioLevel > 0.1) {
      // Rapid frequency switching suggests multiple speakers
      voiceCount = 2;
      detected = true;
      logger.proctoring(`🔊 Multiple voices detected: high frequency variation (${frequencyVariation.toFixed(0)} Hz`);
    }
    
    return { detected, voiceCount, spectralComplexity };
  }

  /**
   * Get energy in a specific frequency band
   */
  private getFrequencyBandEnergy(
    freqData: Uint8Array<ArrayBuffer>, 
    startHz: number, 
    endHz: number,
    binWidth: number
  ): number {
    const startBin = Math.floor(startHz / binWidth);
    const endBin = Math.min(Math.ceil(endHz / binWidth), freqData.length);
    
    if (startBin >= endBin) return 0;
    
    let sum = 0;
    let maxVal = 0;
    for (let i = startBin; i < endBin; i++) {
      sum += freqData[i];
      maxVal = Math.max(maxVal, freqData[i]);
    }
    
    // Return normalized average with peak boost
    const avg = sum / ((endBin - startBin) * 255);
    const peak = maxVal / 255;
    return (avg + peak) / 2;
  }

  /**
   * Calculate spectral complexity using spectral flatness
   */
  private calculateSpectralComplexity(freqData: Uint8Array<ArrayBuffer>): number {
    // Focus on voice frequency range (80-4000 Hz)
    const sampleRate = this.audioContext?.sampleRate || 48000;
    const binWidth = sampleRate / (this.analyser?.fftSize || 4096);
    
    const startBin = Math.floor(80 / binWidth);
    const endBin = Math.min(Math.ceil(4000 / binWidth), freqData.length);
    
    const values: number[] = [];
    for (let i = startBin; i < endBin; i++) {
      if (freqData[i] > 0) {
        values.push(freqData[i] / 255);
      }
    }
    
    if (values.length < 10) return 0;
    
    // Calculate geometric mean / arithmetic mean (spectral flatness)
    const logSum = values.reduce((acc, v) => acc + Math.log(v + 0.001), 0);
    const geometricMean = Math.exp(logSum / values.length);
    const arithmeticMean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Invert: lower flatness = more tonal content = higher complexity for voices
    const flatness = geometricMean / (arithmeticMean + 0.001);
    
    // Also count number of significant peaks
    const threshold = arithmeticMean * 1.5;
    const significantPeaks = values.filter(v => v > threshold).length;
    const peakDensity = significantPeaks / values.length;
    
    // Combine metrics: multiple peaks + moderate flatness = multiple voices
    const complexity = (peakDensity * 2 + (1 - flatness)) / 3;
    
    return Math.min(complexity, 1);
  }

  /**
   * Find peaks in the frequency spectrum
   */
  private findSpectralPeaks(
    freqData: Uint8Array<ArrayBuffer>,
    minHz: number,
    maxHz: number,
    binWidth: number
  ): Array<{ frequency: number; magnitude: number }> {
    const startBin = Math.floor(minHz / binWidth);
    const endBin = Math.min(Math.ceil(maxHz / binWidth), freqData.length);
    
    const peaks: Array<{ frequency: number; magnitude: number }> = [];
    const threshold = 40; // Minimum magnitude for a peak (LOWERED for sensitivity)
    
    for (let i = startBin + 1; i < endBin - 1; i++) {
      const current = freqData[i];
      const prev = freqData[i - 1];
      const next = freqData[i + 1];
      
      // Is this a local maximum above threshold?
      if (current > threshold && current > prev && current > next) {
        peaks.push({
          frequency: i * binWidth,
          magnitude: current / 255,
        });
      }
    }
    
    // Sort by magnitude and return top peaks
    return peaks.sort((a, b) => b.magnitude - a.magnitude).slice(0, 10);
  }

  /**
   * Count distinct peaks (separated by at least 50 Hz)
   */
  private countDistinctPeaks(peaks: Array<{ frequency: number; magnitude: number }>): number {
    if (peaks.length <= 1) return peaks.length;
    
    const sorted = [...peaks].sort((a, b) => a.frequency - b.frequency);
    let distinctCount = 1;
    let lastFreq = sorted[0].frequency;
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].frequency - lastFreq >= 50) { // At least 50 Hz apart
        distinctCount++;
        lastFreq = sorted[i].frequency;
      }
    }
    
    return distinctCount;
  }

  /**
   * Calculate frequency variation over recent history
   */
  private calculateFrequencyVariation(): number {
    if (this.frequencyHistory.length < 5) return 0;
    
    let totalVariation = 0;
    for (let i = 1; i < this.frequencyHistory.length; i++) {
      totalVariation += Math.abs(this.frequencyHistory[i] - this.frequencyHistory[i - 1]);
    }
    
    return totalVariation / this.frequencyHistory.length;
  }

  /**
   * Calculate confidence based on signal quality
   */
  private calculateConfidence(audioLevel: number, spectralComplexity: number): number {
    // Higher audio level = more confident
    // Moderate complexity = more confident (too low = noise, too high = unclear)
    const levelConfidence = Math.min(audioLevel * 3, 1);
    const complexityConfidence = spectralComplexity > 0.2 && spectralComplexity < 0.8 ? 1 : 0.5;
    
    return (levelConfidence + complexityConfidence) / 2;
  }

  /**
   * Calculate dominant frequency
   */
  private calculateDominantFrequency(freqData: Uint8Array<ArrayBuffer>): number {
    let maxValue = 0;
    let maxIndex = 0;
    
    for (let i = 0; i < freqData.length; i++) {
      if (freqData[i] > maxValue) {
        maxValue = freqData[i];
        maxIndex = i;
      }
    }
    
    // Convert bin index to frequency
    const nyquist = (this.audioContext?.sampleRate || 48000) / 2;
    return (maxIndex / freqData.length) * nyquist;
  }

  /**
   * Cleanup resources
   */
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
    this.dataArray = null;
    this.onAnalysis = null;
    this.frequencyHistory = [];
    this.energyHistory = [];
  }
}

/**
 * Helper function to start voice analysis
 */
export async function startVoiceAnalysis(
  stream: MediaStream,
  onAnalysis: (result: VoiceAnalysisResult) => void
): Promise<VoiceAnalyzer> {
  const analyzer = new VoiceAnalyzer();
  await analyzer.initialize(stream);
  analyzer.startAnalysis(onAnalysis);
  return analyzer;
}
