/**
 * AI Retry and Circuit Breaker Utilities
 * 
 * Provides exponential backoff retry logic and circuit breaker pattern
 * for resilient AI API calls.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const delay = Math.min(exponentialDelay + jitter, maxDelayMs);
  return Math.round(delay);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, options: RetryOptions): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // Check for retryable status codes
  if (error.status && options.retryableStatuses.includes(error.status)) {
    return true;
  }
  
  // Check for rate limiting messages
  const errorMessage = error.message?.toLowerCase() || '';
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return true;
  }
  
  return false;
}

/**
 * Create Supabase client for circuit breaker operations
 */
function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

/**
 * Check circuit breaker state
 */
export async function checkCircuitBreaker(serviceName: string): Promise<{
  canAttempt: boolean;
  state: string;
}> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('check_circuit_breaker', {
      p_service_name: serviceName
    });
    
    if (error) {
      console.warn(`Circuit breaker check failed for ${serviceName}:`, error);
      // Fail open - allow attempt if we can't check
      return { canAttempt: true, state: 'unknown' };
    }
    
    const result = data?.[0];
    return {
      canAttempt: result?.can_attempt ?? true,
      state: result?.current_state ?? 'unknown'
    };
  } catch (err) {
    console.warn(`Circuit breaker error for ${serviceName}:`, err);
    return { canAttempt: true, state: 'unknown' };
  }
}

/**
 * Record success to circuit breaker
 */
export async function recordSuccess(serviceName: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.rpc('record_circuit_success', { p_service_name: serviceName });
  } catch (err) {
    console.warn(`Failed to record success for ${serviceName}:`, err);
  }
}

/**
 * Record failure to circuit breaker
 */
export async function recordFailure(serviceName: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.rpc('record_circuit_failure', { p_service_name: serviceName });
  } catch (err) {
    console.warn(`Failed to record failure for ${serviceName}:`, err);
  }
}

/**
 * Execute function with retry and circuit breaker
 */
export async function withRetryAndCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  
  // Check circuit breaker first
  const { canAttempt, state } = await checkCircuitBreaker(serviceName);
  
  if (!canAttempt) {
    throw new Error(`Circuit breaker is open for ${serviceName}. Service temporarily unavailable.`);
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // Success - record it
      await recordSuccess(serviceName);
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      console.warn(`[${serviceName}] Attempt ${attempt + 1}/${opts.maxRetries + 1} failed:`, error.message);
      
      // Check if we should retry
      if (attempt < opts.maxRetries && isRetryableError(error, opts)) {
        const delay = calculateBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);
        console.log(`[${serviceName}] Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        // No more retries - record failure
        await recordFailure(serviceName);
        break;
      }
    }
  }
  
  throw lastError || new Error(`All retries exhausted for ${serviceName}`);
}

/**
 * Wrapper for AI API calls with full resilience
 */
export async function resilientAICall<T>(
  providerType: string,
  apiCall: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const serviceName = `ai_${providerType}`;
  return withRetryAndCircuitBreaker(serviceName, apiCall, options);
}
