// src/utils/budgets.ts
import { supabase } from "../supabaseClient";
import { getMonthKey } from "./date";

export async function saveBudget(userId: string, category: string, amountMonthly: number) {
  const budget_month = getMonthKey(); // "YYYY-MM"
  const { error } = await supabase.from("budgets").upsert(
    {
      user_id: userId,
      category,
      amount_monthly: Number(amountMonthly),
      budget_month,
    },
    { onConflict: "user_id,category,budget_month" }
  );
  if (error) throw error;
}
