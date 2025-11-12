// supabase/functions/admin-list-budgets/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, assertAdmin, corsHeaders } from "../_shared_admin.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req.headers.get("Origin") ?? "*") });
  }
  const headers = corsHeaders(req.headers.get("Origin") ?? "*");

  const auth = await assertAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = adminClient();
    // List latest 100 budgets with user email if available
    const { data: rows, error } = await supabase
      .from("budgets")
      .select("id,user_id,category,amount,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ rows: rows ?? [] }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
