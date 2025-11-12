// supabase/functions/admin-financial-overview/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

serve(async (req) => {
  const url = Deno.env.get("PROJECT_URL")!;
  const service = Deno.env.get("SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, service, { auth: { persistSession: false } });

  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(jwt);
  if (!user) return new Response("Unauthorized", { status: 401 });

  // check admin
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || prof.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { data: byCluster } = await supabase.rpc("count_by_text", { tbl: "financial_profiles", col: "cluster_label" });
  const { data: byHealth } = await supabase.rpc("count_by_text", { tbl: "financial_profiles", col: "fh_label" });

  return new Response(JSON.stringify({ byCluster: byCluster ?? [], byHealth: byHealth ?? [] }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
