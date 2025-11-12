// functions/insights/index.ts
// @ts-nocheck because Deno types are not available in Node/VSCode
import 'react-native-gesture-handler';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type Transaction = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  occurred_at: string;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req: Request) => {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
      });
    }

    // Fetch transactions
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }

    const txs = (transactions as Transaction[]) ?? [];

    const totalSpent = txs
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalIncome = txs
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return new Response(
      JSON.stringify({
        insights: {
          totalSpent,
          totalIncome,
          balance: totalIncome - totalSpent,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
});
