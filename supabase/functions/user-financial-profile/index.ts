// Deno edge function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    // Create a supabase client that forwards the caller’s auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!; // or SERVICE_ROLE if you need RLS bypass
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // Pull user’s transactions (adjust filters as needed)
    const { data: tx, error } = await supabase
      .from("transactions")
      .select("direction, amount")
      .eq("user_id", user_id)
      .limit(10000);

    if (error) throw error;

    const income = (tx ?? [])
      .filter((t: any) => t.direction === "in")
      .reduce((a: number, b: any) => a + Number(b.amount || 0), 0);

    const expenses = (tx ?? [])
      .filter((t: any) => t.direction === "out")
      .reduce((a: number, b: any) => a + Number(b.amount || 0), 0);

    const result = {
      income,
      expenses,
      balance: income - expenses,
      // add more aggregates/insights here…
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
