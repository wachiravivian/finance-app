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

  const supabase = adminClient();

  try {
    const { data: budgets, error: bErr } = await supabase
      .from("budgets")
      .select("category, amount");
    if (bErr) return err(bErr.message, 500);

    const budgetsByCategory: Record<string, number> = {};
    for (const row of budgets ?? []) {
      budgetsByCategory[row.category] =
        (budgetsByCategory[row.category] ?? 0) + row.amount;
    }

    const { data: goals, error: gErr } = await supabase
      .from("goals")
      .select("progress");
    if (gErr) return err(gErr.message, 500);

    const goalsProgress = { lt50: 0, btw50_80: 0, gte80: 0, achieved: 0 };
    for (const g of goals ?? []) {
      if (g.progress >= 100) goalsProgress.achieved++;
      else if (g.progress >= 80) goalsProgress.gte80++;
      else if (g.progress >= 50) goalsProgress.btw50_80++;
      else goalsProgress.lt50++;
    }

    return ok({
      budgetsByCategory,
      goalsProgress,
    });
  } catch (e) {
    return err("Failed to generate report: " + e.message, 500);
  }
});
