// supabase/functions/user-import-mpesa-rows/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared_cors.ts";
import { adminClient } from "../_shared_admin.ts";

// Expected payload: { rows: Array<{ title: string; category: string; amount: number; created_at?: string; direction?: "in" | "out"; mpesa_receipt?: string | null; }> }

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      });
    }

    const supa = adminClient();

    // Verify caller
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const { data: { user }, error: userErr } = await supa.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json().catch(() => null) as {
      rows?: Array<{
        title: string;
        category: string;
        amount: number;
        created_at?: string;
        direction?: "in" | "out";
        mpesa_receipt?: string | null;
      }>;
    };

    const rows = Array.isArray(body?.rows) ? body!.rows : [];
    if (!rows.length) {
      return new Response(JSON.stringify({ inserted: 0, skipped: 0, error: "No rows" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Basic validation & normalization
    const nowIso = new Date().toISOString();
    const clean = rows
      .map((r) => ({
        user_id: user.id,
        title: String(r.title || "M-PESA"),
        category: String(r.category || "Other"),
        amount: Number(r.amount || 0),
        created_at: r.created_at ? new Date(r.created_at).toISOString() : nowIso,
        // If you later add these columns, you can store them too:
        // direction: r.direction ?? null,
        // mpesa_receipt: r.mpesa_receipt ?? null,
      }))
      .filter((r) => !Number.isNaN(r.amount) && r.amount !== 0);

    if (!clean.length) {
      return new Response(JSON.stringify({ inserted: 0, skipped: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { error: insErr } = await supa.from("transactions").insert(clean);
    if (insErr) {
      return new Response(JSON.stringify({ inserted: 0, skipped: rows.length, error: insErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(
      JSON.stringify({ inserted: clean.length, skipped: rows.length - clean.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("user-import-mpesa-rows error:", e);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
