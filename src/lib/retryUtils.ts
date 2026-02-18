/**
 * Retry utilities for network operations with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: any) => void;
}

const defaultOptions: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 1.5,
};

/**
 * Execute an async function with retry logic
 * Uses fast retries (2-3 attempts over ~5-8 seconds)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === opts.maxAttempts) {
        break;
      }
      
      opts.onRetry?.(attempt, error);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay for next attempt (capped at max)
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }
  
  throw lastError;
}

/**
 * Check if an error is retryable (network errors, timeouts, etc.)
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.message?.includes('fetch') || 
      error?.message?.includes('network') ||
      error?.message?.includes('timeout') ||
      error?.message?.includes('Failed to fetch')) {
    return true;
  }
  
  // HTTP 5xx errors (server errors)
  const status = error?.status || error?.context?.status;
  if (typeof status === 'number' && status >= 500 && status < 600) {
    return true;
  }
  
  // Rate limiting
  if (status === 429) {
    return true;
  }
  
  return false;
}

/**
 * User-friendly error messages for invitation resolution failures
 */
export function getInvitationErrorMessage(error: any): string {
  const status = error?.status || error?.context?.status;
  const message = error?.message?.toLowerCase() || '';
  
  // Specific backend error responses
  if (message.includes('expired')) {
    return 'This invitation has expired. Please contact the recruiter for a new invitation.';
  }
  
  if (message.includes('completed') || message.includes('already been taken')) {
    return 'This interview has already been taken. Each candidate can only attempt once.';
  }
  
  if (message.includes('not_found') || message.includes('invalid')) {
    return 'This interview link is invalid. Please check the link from your invitation email.';
  }
  
  // Network/connectivity issues
  if (message.includes('fetch') || 
      message.includes('network') || 
      message.includes('timeout') ||
      message.includes('failed to fetch')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }
  
  // Server errors
  if (typeof status === 'number') {
    if (status >= 500) {
      return 'The server is temporarily unavailable. Please try again in a few moments.';
    }
    if (status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
  }
  
  // Generic fallback
  return 'Unable to load the interview. Please refresh the page or try again later.';
}
