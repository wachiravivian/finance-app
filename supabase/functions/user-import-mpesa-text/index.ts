//user-import-mpesa-text/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseMpesaText } from "../_shared/mpesa-parser.ts";

function corsHeaders(origin: string | null, req?: Request) {
  const reqHdrs = req?.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      reqHdrs ?? "authorization, apikey, content-type",
  };
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders(origin) });

  try {
    const PROJECT_URL = Deno.env.get("PROJECT_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
    const admin = createClient(PROJECT_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token) throw new Error("Missing Bearer token");

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) throw new Error("Invalid token");
    const userId = userData.user.id;

    const body = await req.json();
    const text = body?.text ?? "";
    if (!text) throw new Error("Missing text input");

    const txs = parseMpesaText(text);

    if (!txs.length)
      return new Response(JSON.stringify({ imported: 0, message: "No valid transactions found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });

    const rows = txs.map((t) => ({
      user_id: userId,
      title: t.description.slice(0, 120),
      category: t.category,
      merchant: t.merchant,
      amount: t.type === "expense" ? -Math.abs(t.amount) : Math.abs(t.amount),
      occurred_at: t.occurred_at,
      type: t.type,
      description: t.description,
      created_at: new Date().toISOString(),
    }));

    const { error: insErr } = await admin.from("transactions").insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ imported: rows.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e: any) {
    console.error("Text import error:", e);
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});
