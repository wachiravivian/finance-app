import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, assertAdmin, corsHeaders, ok, err } from "../_shared_admin.ts";

serve(async (req) => {
  // ✅ Handle preflight CORS requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  const check = await assertAdmin(req);
  if (!check.ok) return err(check.error, 401);

  const supa = adminClient();
  let limit = 100;
  try {
    const json = await req.json().catch(() => ({}));
    if (Number.isFinite(json?.limit)) limit = Math.min(Math.max(1, json.limit), 500);
  } catch (_) {}

  const { data: authUsers, error: auErr } = await supa.auth.admin.listUsers({ page: 1, perPage: limit });
  if (auErr) return err(auErr.message || "auth list failed", 500);

  const ids = (authUsers?.users ?? []).map((u) => u.id);
  const { data: profiles, error: pErr } = await supa
    .from("profiles")
    .select("id, display_name, phone, role, created_at, last_seen_at")
    .in("id", ids);

  if (pErr) return err(pErr.message, 500);

  const profById = new Map(profiles?.map((p: any) => [p.id, p]) ?? []);
  const rows = (authUsers?.users ?? []).map((u: any) => ({
    id: u.id,
    email: u.email ?? null,
    display_name: profById.get(u.id)?.display_name ?? null,
    phone: profById.get(u.id)?.phone ?? null,
    role: profById.get(u.id)?.role ?? "user",
    created_at: profById.get(u.id)?.created_at ?? u.created_at ?? null,
    last_sign_in_at: u.last_sign_in_at ?? null,
  }));

  return ok({ rows });
});
