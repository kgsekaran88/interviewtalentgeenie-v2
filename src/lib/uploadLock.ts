/**
 * Upload Lock - Prevents race conditions in upload operations
 * 
 * Provides mutex-like locking for:
 * - IndexedDB operations (to prevent concurrent read/write issues)
 * - Upload processing (to prevent multiple parallel upload attempts)
 * - Progress updates (to ensure atomic state changes)
 */

import { logger } from '@/lib/logger';

// Simple mutex implementation for async operations
class AsyncMutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    // Wait for lock to be released
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      // Give lock to next waiter
      const next = this.waitQueue.shift();
      next?.();
    } else {
      this.locked = false;
    }
  }

  isLocked(): boolean {
    return this.locked;
  }
}

// Singleton locks for different operations
const locks = {
  indexedDB: new AsyncMutex(),
  uploadProcessing: new AsyncMutex(),
  progressUpdate: new AsyncMutex(),
};

/**
 * Execute a function with IndexedDB lock
 * Ensures only one IndexedDB operation runs at a time
 */
export async function withIndexedDBLock<T>(fn: () => Promise<T>): Promise<T> {
  await locks.indexedDB.acquire();
  try {
    return await fn();
  } finally {
    locks.indexedDB.release();
  }
}

/**
 * Execute a function with upload processing lock
 * Prevents multiple triggerBackgroundUpload calls from running concurrently
 */
export async function withUploadProcessingLock<T>(fn: () => Promise<T>): Promise<T | null> {
  // If already processing, skip (don't queue)
  if (locks.uploadProcessing.isLocked()) {
    logger.proctoring('[UploadLock] Upload processing already in progress, skipping');
    return null;
  }
  
  await locks.uploadProcessing.acquire();
  try {
    return await fn();
  } finally {
    locks.uploadProcessing.release();
  }
}

/**
 * Check if upload processing is currently locked
 */
export function isUploadProcessingLocked(): boolean {
  return locks.uploadProcessing.isLocked();
}

/**
 * Execute a function with progress update lock
 * Ensures atomic progress updates
 */
export async function withProgressLock<T>(fn: () => T): Promise<T> {
  await locks.progressUpdate.acquire();
  try {
    return fn();
  } finally {
    locks.progressUpdate.release();
  }
}

// Debounce helper for rapid-fire operations
const debounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Debounce a function call by key
 * Returns a promise that resolves when the debounced function finally executes
 */
export function debouncedCall<T>(
  key: string, 
  fn: () => Promise<T>, 
  delayMs: number
): Promise<T | null> {
  return new Promise((resolve) => {
    // Clear existing timer
    const existingTimer = debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      debounceTimers.delete(key);
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        logger.error(`[UploadLock] Debounced call ${key} failed:`, error);
        resolve(null);
      }
    }, delayMs);

    debounceTimers.set(key, timer);
  });
}

// Operation tracking to detect stuck operations
interface OperationTracker {
  startTime: number;
  operationType: string;
  id: string;
}

const activeOperations = new Map<string, OperationTracker>();

/**
 * Track start of an operation
 */
export function trackOperationStart(id: string, operationType: string): void {
  activeOperations.set(id, {
    startTime: Date.now(),
    operationType,
    id,
  });
}

/**
 * Track end of an operation
 */
export function trackOperationEnd(id: string): void {
  activeOperations.delete(id);
}

/**
 * Get stuck operations (running longer than threshold)
 */
export function getStuckOperations(thresholdMs: number = 60000): OperationTracker[] {
  const now = Date.now();
  const stuck: OperationTracker[] = [];
  
  activeOperations.forEach((op) => {
    if (now - op.startTime > thresholdMs) {
      stuck.push(op);
    }
  });
  
  return stuck;
}

/**
 * Clear all operation tracking (for cleanup)
 */
export function clearOperationTracking(): void {
  activeOperations.clear();
}
