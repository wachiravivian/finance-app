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
    const { user_id } = await req.json();

    if (!user_id) return err("Missing user_id", 400);

    // ✅ Unban by clearing ban duration
    const { error } = await supa.auth.admin.updateUserById(user_id, {
      ban_duration: null,
    });
    if (error) throw error;

    // ✅ Update local table
    await supa.from("profiles").update({ disabled: false }).eq("id", user_id);

    return ok({ success: true, message: "User unbanned (enabled)" });
  } catch (error) {
    console.error("admin-unban-user error:", error);
    return err(error.message || "Failed to enable user", 500);
  }
});
