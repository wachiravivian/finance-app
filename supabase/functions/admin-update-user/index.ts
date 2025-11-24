import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, assertAdmin, corsHeaders, ok, err } from "../_shared_admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const check = await assertAdmin(req);
    if (!check.ok) return err(check.error, 401);

    const supa = adminClient();
    const { user_id, updates } = await req.json();

    if (!user_id || !updates) return err("Missing user_id or updates", 400);

    const { display_name, phone, role } = updates;

    // ✅ 1. Update Supabase Auth metadata (for UI consistency)
    const { error: authError } = await supa.auth.admin.updateUserById(user_id, {
      user_metadata: { display_name, phone },
    });
    if (authError) console.warn("Auth metadata update failed:", authError);

    // ✅ 2. Update profiles table
    const { error: dbError } = await supa
      .from("profiles")
      .update({ display_name, phone, role })
      .eq("id", user_id);
    if (dbError) throw dbError;

    return ok({ success: true, message: "User updated successfully" });
  } catch (error) {
    console.error("admin-update-user error:", error);
    return err(error.message || "Failed to update user", 500);
  }
});
