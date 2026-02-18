/**
 * Upload Progress Store
 * 
 * A thread-safe reactive store to track upload progress across components.
 * Uses a pub/sub pattern for real-time updates with proper locking.
 * Persists to localStorage to survive page refreshes.
 * 
 * RACE CONDITION FIXES:
 * - Batched updates to prevent rapid-fire state changes
 * - Version tracking to detect stale updates
 * - Atomic read-modify-write operations
 */

import { logger } from '@/lib/logger';

const STORAGE_KEY = 'proctoring-upload-progress';
const UPDATE_DEBOUNCE_MS = 50; // Batch updates within 50ms

export interface UploadProgress {
  videoProgress: number; // 0-100
  screenProgress: number; // 0-100
  videoStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  screenStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  overallProgress: number; // 0-100
  isComplete: boolean;
  hasVideo: boolean;
  hasScreen: boolean;
  lastUpdated?: number; // Timestamp for staleness check
  version?: number; // Version for optimistic locking
}

type Listener = (progress: UploadProgress) => void;

const listeners: Set<Listener> = new Set();
let updateDebounceTimer: NodeJS.Timeout | null = null;
let pendingUpdates: Partial<UploadProgress> = {};

const defaultProgress: UploadProgress = {
  videoProgress: 0,
  screenProgress: 0,
  videoStatus: 'pending',
  screenStatus: 'pending',
  overallProgress: 0,
  isComplete: false,
  hasVideo: false,
  hasScreen: false,
  version: 0,
};

// Load from localStorage on init
function loadProgress(): UploadProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UploadProgress;
      
      // Check if progress is stale (older than 30 minutes) - clear it
      if (parsed.lastUpdated && Date.now() - parsed.lastUpdated > 30 * 60 * 1000) {
        logger.proctoring('[UploadProgressStore] Clearing stale progress (>30 min old)');
        localStorage.removeItem(STORAGE_KEY);
        return { ...defaultProgress };
      }
      
      // If already complete, clear after 5 seconds of page load
      if (parsed.isComplete) {
        setTimeout(() => {
          localStorage.removeItem(STORAGE_KEY);
          currentProgress = { ...defaultProgress };
          notifyListeners();
        }, 5000);
      }
      
      return { ...parsed, version: (parsed.version || 0) + 1 };
    }
  } catch (e) {
    logger.error('[UploadProgressStore] Error loading from localStorage:', e);
  }
  return { ...defaultProgress };
}

// Save to localStorage (debounced to prevent rapid writes)
let saveDebounceTimer: NodeJS.Timeout | null = null;
function saveProgress(progress: UploadProgress): void {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }
  
  saveDebounceTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      logger.error('[UploadProgressStore] Error saving to localStorage:', e);
    }
    saveDebounceTimer = null;
  }, 100);
}

let currentProgress: UploadProgress = loadProgress();

// Notify all listeners with current state
function notifyListeners(): void {
  const snapshot = { ...currentProgress };
  listeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch (e) {
      logger.error('[UploadProgressStore] Listener error:', e);
    }
  });
}

// Apply pending updates atomically
function applyPendingUpdates(): void {
  if (Object.keys(pendingUpdates).length === 0) return;
  
  // Atomic read-modify-write
  const updates = { ...pendingUpdates };
  pendingUpdates = {};
  
  currentProgress = { 
    ...currentProgress, 
    ...updates, 
    lastUpdated: Date.now(),
    version: (currentProgress.version || 0) + 1,
  };
  
  // Recalculate derived fields
  let total = 0;
  let count = 0;
  
  if (currentProgress.hasVideo) {
    total += currentProgress.videoProgress;
    count++;
  }
  if (currentProgress.hasScreen) {
    total += currentProgress.screenProgress;
    count++;
  }
  
  currentProgress.overallProgress = count > 0 ? Math.round(total / count) : 0;
  
  // Check if complete (completed or failed - both mean we're done processing)
  const videoComplete = !currentProgress.hasVideo || 
    currentProgress.videoStatus === 'completed' || 
    currentProgress.videoStatus === 'failed';
  const screenComplete = !currentProgress.hasScreen || 
    currentProgress.screenStatus === 'completed' || 
    currentProgress.screenStatus === 'failed';
  currentProgress.isComplete = videoComplete && screenComplete;
  
  // Persist and notify
  saveProgress(currentProgress);
  notifyListeners();
}

export function getUploadProgress(): UploadProgress {
  return { ...currentProgress };
}

/**
 * Update upload progress with batching to prevent race conditions
 * Updates within UPDATE_DEBOUNCE_MS are batched together
 */
export function updateUploadProgress(updates: Partial<UploadProgress>): void {
  // Merge into pending updates
  pendingUpdates = { ...pendingUpdates, ...updates };
  
  // Debounce the actual update
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer);
  }
  
  updateDebounceTimer = setTimeout(() => {
    updateDebounceTimer = null;
    applyPendingUpdates();
  }, UPDATE_DEBOUNCE_MS);
}

/**
 * Force immediate update (bypasses debouncing)
 * Use sparingly - only for critical state changes
 */
export function forceUpdateUploadProgress(updates: Partial<UploadProgress>): void {
  // Clear any pending debounced updates
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer);
    updateDebounceTimer = null;
  }
  
  // Merge and apply immediately
  pendingUpdates = { ...pendingUpdates, ...updates };
  applyPendingUpdates();
}

export function resetUploadProgress(): void {
  // Clear pending updates
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer);
    updateDebounceTimer = null;
  }
  pendingUpdates = {};
  
  currentProgress = { ...defaultProgress, version: (currentProgress.version || 0) + 1 };
  localStorage.removeItem(STORAGE_KEY);
  notifyListeners();
}

export function subscribeToUploadProgress(listener: Listener): () => void {
  listeners.add(listener);
  
  // Immediately call with current state (snapshot to prevent mutation)
  try {
    listener({ ...currentProgress });
  } catch (e) {
    logger.error('[UploadProgressStore] Initial listener call error:', e);
  }
  
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get current version for optimistic locking
 */
export function getProgressVersion(): number {
  return currentProgress.version || 0;
}

/**
 * Conditionally update only if version matches (optimistic locking)
 * Returns true if update was applied, false if version mismatch
 */
export function updateIfVersion(expectedVersion: number, updates: Partial<UploadProgress>): boolean {
  if ((currentProgress.version || 0) !== expectedVersion) {
    logger.proctoring('[UploadProgressStore] Version mismatch, update rejected');
    return false;
  }
  
  forceUpdateUploadProgress(updates);
  return true;
}
