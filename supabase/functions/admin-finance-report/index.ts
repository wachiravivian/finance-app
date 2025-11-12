// supabase/functions/admin-finance-report/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ Add this to every function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { from, to } = await req.json();

    // --- Budgets by Category ---
    const { data: budgets, error: budgetError } = await supabase
      .from("budgets")
      .select("category, amount")
      .gte("created_at", from)
      .lte("created_at", to);

    if (budgetError) throw budgetError;

    const budgetsByCategory: Record<string, number> = {};
    (budgets ?? []).forEach((b: any) => {
      budgetsByCategory[b.category] = (budgetsByCategory[b.category] || 0) + (b.amount ?? 0);
    });

    // --- Goals Progress ---
    const { data: goals, error: goalError } = await supabase
      .from("goals")
      .select("progress, achieved")
      .gte("created_at", from)
      .lte("created_at", to);

    if (goalError) throw goalError;

    const progress = { lt50: 0, btw50_80: 0, gte80: 0, achieved: 0 };

    (goals ?? []).forEach((g: any) => {
      if (g.achieved) progress.achieved++;
      else if (g.progress < 50) progress.lt50++;
      else if (g.progress < 80) progress.btw50_80++;
      else progress.gte80++;
    });

    const result = {
      budgetsByCategory: budgetsByCategory ?? {},
      goalsProgress: progress ?? { lt50: 0, btw50_80: 0, gte80: 0, achieved: 0 },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("admin-finance-report error:", err);
    return new Response(
      JSON.stringify({
        error: err.message ?? String(err),
        budgetsByCategory: {},
        goalsProgress: { lt50: 0, btw50_80: 0, gte80: 0, achieved: 0 },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
