export type EdgeFunctionErrorPayload = {
  error?: string;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const compact = (value: unknown, max = 240) => {
  const str = typeof value === 'string' ? value : value ? String(value) : '';
  return str.length > max ? `${str.slice(0, max)}…` : str;
};

const isResponseLike = (value: any): value is Response => {
  return !!(
    value &&
    typeof value === 'object' &&
    typeof value.status === 'number' &&
    typeof value.text === 'function' &&
    value.headers &&
    typeof value.headers.get === 'function'
  );
};

/**
 * Best-effort extraction of a useful error message from supabase.functions.invoke errors.
 * Note: for non-2xx responses, @supabase/functions-js stores the raw Response on `err.context`.
 */
export function getEdgeFunctionErrorMessage(err: any, fallback = 'Request failed'): string {
  const base = err?.message && typeof err.message === 'string' ? err.message : fallback;

  const ctx = err?.context;
  if (isResponseLike(ctx)) {
    return `${base} (HTTP ${ctx.status})`;
  }

  const body = ctx?.body;
  if (!body) return base;

  try {
    const parsed: EdgeFunctionErrorPayload = typeof body === 'string' ? JSON.parse(body) : body;

    const msg = parsed?.error || parsed?.message || base;
    const code = parsed?.code;
    const details = parsed?.details || parsed?.hint;

    const parts = [msg];
    if (code) parts.push(`(${compact(code, 40)})`);
    if (details) parts.push(`— ${compact(details)}`);

    return parts.join(' ');
  } catch {
    return base;
  }
}

/**
 * Async version that can read the Response body when invoke throws FunctionsHttpError/FunctionsRelayError.
 */
export async function getEdgeFunctionErrorMessageAsync(err: any, fallback = 'Request failed'): Promise<string> {
  const base = err?.message && typeof err.message === 'string' ? err.message : fallback;
  const ctx = err?.context;

  if (!isResponseLike(ctx)) {
    return getEdgeFunctionErrorMessage(err, fallback);
  }

  try {
    const res = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
    const statusLabel = `HTTP ${res.status}`;

    const text = await res.text();
    if (!text) return `${base} (${statusLabel})`;

    // Try JSON first
    try {
      const parsed: EdgeFunctionErrorPayload = JSON.parse(text);
      const msg = parsed?.error || parsed?.message || base;
      const code = parsed?.code;
      const details = parsed?.details || parsed?.hint;

      const parts = [msg];
      if (code) parts.push(`(${compact(code, 40)})`);
      if (details) parts.push(`— ${compact(details)}`);
      parts.push(`[${statusLabel}]`);
      return parts.join(' ');
    } catch {
      // Not JSON
      return `${base} (${statusLabel}) — ${compact(text)}`;
    }
  } catch {
    return base;
  }
}

