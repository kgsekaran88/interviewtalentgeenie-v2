/**
 * Browser-side safety net: storage signed URLs from edge functions may
 * contain Docker-internal hosts (kong:8000). Rewrite to VITE_SUPABASE_URL.
 */
export function toBrowserStorageUrl(url: string | null | undefined): string {
  if (!url) return '';

  const publicBase = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
  if (!publicBase) return url;

  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'kong' || parsed.hostname === 'storage') {
      const pub = new URL(publicBase);
      parsed.protocol = pub.protocol;
      parsed.host = pub.host;
      return parsed.toString();
    }
  } catch {
    /* ignore */
  }

  return url
    .replace(/https?:\/\/kong(?::\d+)?/g, publicBase)
    .replace(/https?:\/\/storage(?::\d+)?/g, publicBase);
}

/**
 * Kong key-auth requires apikey even on signed storage upload URLs.
 */
export function storageUploadHeaders(contentType: string): Record<string, string> {
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  return {
    'Content-Type': contentType,
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
}
