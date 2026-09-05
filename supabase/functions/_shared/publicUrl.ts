/**
 * Rewrite storage/API URLs from Docker-internal hosts (kong, storage)
 * to the browser-reachable public API base URL.
 */
export function toPublicUrl(url: string | null | undefined): string {
  if (!url) return '';

  const publicBase = (
    Deno.env.get('SUPABASE_PUBLIC_URL') ||
    Deno.env.get('API_EXTERNAL_URL') ||
    ''
  ).replace(/\/$/, '');

  if (!publicBase) return url;

  try {
    const parsed = new URL(url);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    let internalHostname = '';
    try {
      internalHostname = new URL(supabaseUrl).hostname;
    } catch {
      /* ignore */
    }

    const needsRewrite =
      parsed.hostname === 'kong' ||
      parsed.hostname === 'storage' ||
      (internalHostname !== '' && parsed.hostname === internalHostname && publicBase !== supabaseUrl.replace(/\/$/, ''));

    if (needsRewrite) {
      const pub = new URL(publicBase);
      parsed.protocol = pub.protocol;
      parsed.host = pub.host;
      return parsed.toString();
    }
  } catch {
    /* fall through */
  }

  return url
    .replace(/https?:\/\/kong(?::\d+)?/g, publicBase)
    .replace(/https?:\/\/storage(?::\d+)?/g, publicBase);
}
