// supabase/functions/admin-create-user/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, assertAdmin, corsHeaders } from "../_shared_admin.ts";

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req.headers.get("Origin") ?? "*") });
  }

  const headers = corsHeaders(req.headers.get("Origin") ?? "*");

  // Admin auth
  const auth = await assertAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, password, display_name = null, phone = null, role = "user" } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password are required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabase = adminClient();

    // Create auth user
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name, phone },
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "createUser failed" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Ensure profile row exists
    const newUserId = created.user.id;
    const { error: upsertErr } = await supabase
      .from("profiles")
      .upsert(
        { id: newUserId, role, display_name, phone, created_at: new Date().toISOString() },
        { onConflict: "id" },
      );

    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user: created.user }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
