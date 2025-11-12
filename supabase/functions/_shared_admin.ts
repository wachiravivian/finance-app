// supabase/functions/_shared_admin.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Environment variables (set in Supabase Function secrets):
 * PROJECT_URL=https://<your-project-ref>.supabase.co
 * SERVICE_ROLE_KEY=<your-service-role-key>
 */
export function adminClient() {
  const url = Deno.env.get("PROJECT_URL");
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing PROJECT_URL or SERVICE_ROLE_KEY env vars");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** ✅ Global CORS headers used by all functions */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** ✅ Helper for success responses */
export function ok(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/** ✅ Helper for error responses */
export function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/** ✅ Validate admin authorization */
export async function assertAdmin(req: Request) {
  const supabase = adminClient();
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "").trim();

  if (!jwt) return { ok: false, error: "Missing Bearer token" };

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) return { ok: false, error: "Invalid token" };

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profErr) return { ok: false, error: profErr.message };
  if (!prof || prof.role !== "admin") return { ok: false, error: "Forbidden: not admin" };

  return { ok: true, user: userData.user };
}
