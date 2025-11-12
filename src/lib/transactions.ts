// src/lib/transactions.ts
import { supabase } from "../supabaseClient";

export type TxType = "expense" | "income";
export type LinkRef = { kind: "goal" | "budget" | "reminder"; id: string };

export async function addManualTransaction(input: {
  title: string;
  amount: number;           // positive number from UI
  category: string;
  type: TxType;
  date?: string;            // ISO
  link?: LinkRef | null;    // optional link to a goal/budget/reminder
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");

  const created_at = input.date ?? new Date().toISOString();
  // store expenses as negative, incomes as positive
  const signedAmount =
    input.type === "expense" ? -Math.abs(input.amount) : Math.abs(input.amount);

  const { data, error } = await supabase
    .from("transactions")
    .insert([{
      user_id: userId,
      title: input.title.trim() || "Transaction",
      category: input.category.trim() || "Uncategorized",
      amount: signedAmount,
      created_at,
    }])
    .select("*")
    .single();

  if (error) throw error;

  // Optional: If linked to a goal, record a contribution (positive only)
  if (input.link?.kind === "goal") {
    await supabase.from("goal_contributions").insert([{
      goal_id: input.link.id,
      user_id: userId,
      amount: Math.abs(input.amount),
      created_at,
    }]);
  }

  return data;
}

export async function fetchGoals() {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return [];
  const { data } = await supabase
    .from("goals")
    .select("id,title,target_amount,current_amount")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
