import { supabase } from "../supabaseClient";

export type Budget = {
  id: string;
  user_id: string;
  category: string;
  amount_monthly: number;
  budget_month: string;
  created_at?: string;
};

export async function listBudgets() {
  const monthKey = new Date().toISOString().slice(0, 7); // current month
  const { data, error } = await supabase
    .from("budgets")
    .select("id, user_id, category, amount_monthly, budget_month, created_at")
    .eq("budget_month", monthKey)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Budget[];
}

export async function createBudget(input: { category: string; amount_monthly: number }) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error("Not logged in");

  const monthKey = new Date().toISOString().slice(0, 7);

  const { data, error } = await supabase
    .from("budgets")
    .insert([
      {
        user_id: user.id,
        category: input.category,
        amount_monthly: input.amount_monthly,
        budget_month: monthKey,
      },
    ])
    .select("id")
    .single();

  if (error) throw error;
  return data?.id as string;
}

export async function updateBudget(
  id: string,
  patch: { category?: string; amount_monthly?: number }
) {
  const { error } = await supabase.from("budgets").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBudget(id: string) {
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
}
