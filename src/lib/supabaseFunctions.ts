/**
 * Centralized wrapper for supabase.functions.invoke that automatically
 * includes the Authorization header with the user's access token.
 * 
 * This ensures all edge function calls are properly authenticated.
 */

import { supabase } from '@/integrations/supabase/client';
import type { FunctionInvokeOptions } from '@supabase/functions-js';

export interface InvokeOptions extends Omit<FunctionInvokeOptions, 'headers'> {
  headers?: Record<string, string>;
}

// Define the response type to match what supabase.functions.invoke returns
export interface FunctionResponse<T = unknown> {
  data: T | null;
  // Keep this flexible because Supabase may return enriched error objects
  // (e.g. with context/status/body) depending on failure type.
  error: any | null;
}

/**
 * Invoke a Supabase Edge Function with automatic authentication.
 * 
 * This wrapper:
 * 1. Gets the current session
 * 2. Refreshes the token if it's about to expire (within 60 seconds)
 * 3. Adds the Authorization header with the access token
 * 4. Calls the edge function
 * 
 * @param functionName - The name of the edge function to invoke
 * @param options - Optional invoke options (body, headers, etc.)
 * @returns The response from the edge function
 * 
 * @example
 * const { data, error } = await invokeFunction('generate-job-description', {
 *   body: { jobTitle: 'Software Engineer' }
 * });
 */
// Helpers for safe JWT inspection (base64url decode) and expiration checks
function base64UrlToBase64(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 = base64.padEnd(base64.length + (4 - pad), '=');
  return base64;
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = atob(base64UrlToBase64(parts[1]));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Check if a JWT token is expired (with 60s buffer). If it can't be decoded, assume expired.
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === 'number' ? payload.exp : undefined;
  if (!exp) return true;
  const expMs = exp * 1000;
  return Date.now() > expMs - 60_000;
}

export async function invokeFunction<T = any>(
  functionName: string,
  options?: InvokeOptions
): Promise<FunctionResponse<T>> {
  // Get current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('[invokeFunction] Session error:', sessionError);
    return {
      data: null,
      error: {
        name: 'AuthError',
        message: sessionError.message || 'Failed to get session',
      }
    };
  }

  let accessToken = session?.access_token;
  let didRefresh = false;

  // Check if token exists but is expired - if so, refresh it
  if (accessToken && isTokenExpired(accessToken)) {
    console.log('[invokeFunction] Token expired, refreshing...');
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshData.session?.access_token) {
      accessToken = refreshData.session.access_token;
      didRefresh = true;
      console.log('[invokeFunction] Token refreshed successfully');
    } else {
      console.error('[invokeFunction] Failed to refresh expired token:', refreshError);
    }
  }

  // If no token at all, try a refresh
  if (!accessToken) {
    console.log('[invokeFunction] No access token, attempting refresh...');
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshData.session?.access_token) {
      accessToken = refreshData.session.access_token;
      didRefresh = true;
      console.log('[invokeFunction] Got token from refresh');
    }
  }

  // Build headers with Authorization
  const headers: Record<string, string> = {
    ...options?.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const tokenParts = accessToken ? accessToken.split('.').length : 0;
  console.debug('[invokeFunction] Calling', functionName, { hasAuth: !!accessToken, didRefresh, tokenParts });

  // Invoke the function with merged headers
  let result = await supabase.functions.invoke<T>(functionName, {
    ...options,
    headers,
  });

  // If the call was rejected as unauthorized, try one refresh + retry.
  const firstErr: any = result.error;
  const firstCtx: any = firstErr?.context;
  const firstStatus: number | undefined =
    typeof firstCtx?.status === 'number'
      ? firstCtx.status
      : typeof firstErr?.status === 'number'
        ? firstErr.status
        : undefined;

  if ((firstStatus === 401 || firstStatus === 403) && !didRefresh) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    const refreshedToken = !refreshError ? refreshData.session?.access_token : undefined;

    if (refreshedToken) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${refreshedToken}` };
      result = await supabase.functions.invoke<T>(functionName, {
        ...options,
        headers: retryHeaders,
      });
      didRefresh = true;
    }
  }

  // Enrich error message with response body/status when available
  if (result.error) {
    const err: any = result.error;
    const ctx: any = err?.context;

    const status: number | undefined =
      typeof ctx?.status === 'number'
        ? ctx.status
        : typeof err?.status === 'number'
          ? err.status
          : undefined;

    let body: any = undefined;

    // Supabase functions errors often include a Response object as `context`.
    // Safely extract response body for better debugging.
    try {
      if (ctx && typeof ctx === 'object') {
        if (typeof ctx.clone === 'function' && typeof ctx.text === 'function') {
          const raw = await ctx.clone().text();
          body = raw;
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              // keep as plain text
            }
          }
        } else if (typeof ctx.body === 'string' || (ctx.body && typeof ctx.body === 'object')) {
          body = ctx.body;
        }
      }
    } catch {
      // ignore body parsing errors
    }

    let bodyMessage: string | undefined;
    if (typeof body === 'string') bodyMessage = body;
    else if (body && typeof body === 'object') {
      bodyMessage = body.error || body.message || JSON.stringify(body);
    }

    const statusSuffix = typeof status === 'number' ? ` (HTTP ${status})` : '';

    const tokenPayload = accessToken ? decodeJwtPayload(accessToken) : null;
    const authDebug =
      status === 401 &&
      typeof bodyMessage === 'string' &&
      /invalid\s+jwt/i.test(bodyMessage)
        ? ` [auth-debug: hasToken=${!!accessToken} parts=${accessToken ? accessToken.split('.').length : 0} hasSub=${!!tokenPayload?.sub} role=${tokenPayload?.role ?? 'n/a'} aud=${tokenPayload?.aud ?? 'n/a'} ref=${tokenPayload?.ref ?? 'n/a'} iss=${tokenPayload?.iss ?? 'n/a'} exp=${typeof tokenPayload?.exp === 'number' ? new Date(tokenPayload.exp * 1000).toISOString() : 'n/a'}]`
        : '';

    const enrichedMessage = bodyMessage
      ? `${err.message}${statusSuffix}: ${bodyMessage}${authDebug}`
      : status === 401 || status === 403
        ? `${err.message}${statusSuffix}: Authentication/permissions issue. Please sign in again.`
        : err.message;

    return {
      ...result,
      error: {
        ...err,
        message: enrichedMessage,
        status,
        body,
      },
    };
  }

  return result;
}

/**
 * Type-safe version for functions that require authentication.
 * Throws an error if no session is available.
 */
export async function invokeAuthenticatedFunction<T = any>(
  functionName: string,
  options?: InvokeOptions
): Promise<FunctionResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return {
      data: null,
      error: {
        name: 'AuthError',
        message: 'Authentication required. Please sign in.',
      }
    };
  }

  return invokeFunction<T>(functionName, options);
}
