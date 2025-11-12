// supabase/functions/_shared_cors.ts
export const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  // include x-client-info (supabase-js), apikey, and authorization
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  // optional if you want to expose any custom headers back:
  "Access-Control-Expose-Headers": "content-type",
  "Vary": "Origin",
};
