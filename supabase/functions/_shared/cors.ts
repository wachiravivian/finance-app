// functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // or set to "http://localhost:8081"
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
