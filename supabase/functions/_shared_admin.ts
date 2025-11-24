// supabase/functions/_shared_admin.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function ok(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

export async function assertAdmin(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return { ok: false, error: "No authorization header" };
    }

    const token = authHeader.replace("Bearer ", "");
    const supa = adminClient();
    
    const { data: { user }, error } = await supa.auth.getUser(token);
    if (error || !user) {
      return { ok: false, error: "Invalid token" };
    }

    // Check if user is admin
    const { data: profile } = await supa
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { ok: false, error: "Admin access required" };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: "Authorization check failed" };
  }
}