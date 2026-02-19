// Restrict CORS to the configured frontend origin in production.
// Falls back to '*' only when FRONTEND_URL is not set (local dev).
const allowedOrigin = Deno.env.get('FRONTEND_URL') || '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
