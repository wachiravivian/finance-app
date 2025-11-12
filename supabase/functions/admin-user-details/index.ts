// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, assertAdmin, corsHeaders, ok, err } from "../_shared_admin.ts";

serve(async (req) => {
  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  const check = await assertAdmin(req);
  if (!check.ok) return err(check.error, 401);

  const { user_id } = await req.json().catch(() => ({}));
  if (!user_id) return err("Missing user_id", 400);

  const supabase = adminClient();

  try {
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, display_name, phone, role")
      .eq("id", user_id)
      .single();
    if (pErr) return err(pErr.message, 500);

    const { data: tx, error: tErr } = await supabase
      .from("transactions")
      .select("id, title, category, amount, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(25);
    if (tErr) return err(tErr.message, 500);

    return ok({ profile, transactions: tx || [] });
  } catch (e) {
    return err("Failed to get user details: " + e.message, 500);
  }
});
