import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, assertAdmin, corsHeaders, ok, err } from "../_shared_admin.ts";

serve(async (req) => {
  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  const check = await assertAdmin(req);
  if (!check.ok) return err(check.error, 401);

  const supa = adminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  try {
    const [{ count: users }, { count: tx }, { count: budgets }, { count: activeToday }, { count: weeklyActive }] =
      await Promise.all([
        supa.from("profiles").select("id", { count: "exact", head: true }),
        supa.from("transactions").select("id", { count: "exact", head: true }),
        supa.from("budgets").select("id", { count: "exact", head: true }),
        supa.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", today.toISOString()),
        supa.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", weekAgo.toISOString()),
      ]);

    return ok({
      users: users ?? 0,
      transactions: tx ?? 0,
      budgets: budgets ?? 0,
      activeToday: activeToday ?? 0,
      weeklyActive: weeklyActive ?? 0,
    });
  } catch (e) {
    return err("Failed to compute totals: " + e.message, 500);
  }
});
