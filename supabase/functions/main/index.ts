import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Main / Fallback handler for the Edge Runtime.
 * This is invoked for any request that doesn't match a known function name.
 */
serve(async (req: Request) => {
  const url = new URL(req.url);

  // Health check
  if (url.pathname === "/" || url.pathname === "/health") {
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "talentgeenie-functions",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 404 for unknown functions
  return new Response(
    JSON.stringify({
      error: "Function not found",
      path: url.pathname,
      hint: "Available functions are auto-discovered from the functions directory.",
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }
  );
});
