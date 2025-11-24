// supabase/functions/admin-list-users/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, assertAdmin, corsHeaders, ok, err } from "../_shared_admin.ts";

serve(async (req) => {
  // ✅ Handle preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const check = await assertAdmin(req);
    if (!check.ok) return err(check.error, 401);

    const supa = adminClient();
    let body = {};
    try {
      if (req.method === "POST") body = await req.json();
    } catch (_) {}

    const limit = Math.min(Math.max(Number((body as any)?.limit) || 100, 1), 500);
    const page = Math.max(Number((body as any)?.page) || 1, 1);

    console.log(`[Admin] Listing users (page=${page}, limit=${limit})`);

    const { data: authUsers, error: auErr } = await supa.auth.admin.listUsers({ page, perPage: limit });
    if (auErr) return err(auErr.message || "Failed to list users", 500);

    const ids = (authUsers?.users ?? []).map((u) => u.id);
    if (ids.length === 0) return ok({ rows: [], count: 0, status: "ok" });

    const { data: profiles, error: pErr } = await supa
      .from("profiles")
      .select("id, display_name, phone, role, created_at, last_seen_at")
      .in("id", ids);

    if (pErr) console.warn("Profiles fetch error:", pErr);

    const profById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const rows = (authUsers?.users ?? []).map((u: any) => {
      const profile = profById.get(u.id);
      const displayName =
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        u.user_metadata?.display_name ||
        profile?.display_name ||
        u.email?.split("@")[0] ||
        "Unnamed User";

      return {
        id: u.id,
        email: u.email ?? null,
        display_name: displayName,
        phone: profile?.phone ?? u.phone ?? null,
        role: profile?.role ?? "user",
        created_at: profile?.created_at ?? u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until: u.banned_until ?? null,
      };
    });

    console.log(`[Admin] Returned ${rows.length} users successfully`);
    return ok({ rows, count: rows.length, status: "ok" });
  } catch (error) {
    console.error("Unexpected error in admin-list-users:", error);
    return err("Internal server error", 500);
  }
});
