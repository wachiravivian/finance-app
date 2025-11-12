// supabase/functions/admin-list-goals/index.ts
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
    // Adjust column names to your schema
    const { data: rows, error } = await supabase
      .from("goals")
      .select("id,user_id,title,target_amount,current_amount,deadline,created_at")
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
