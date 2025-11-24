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

    // ✅ Disable user by banning for long duration
    const { error } = await supa.auth.admin.updateUserById(user_id, {
      ban_duration: "8760h", // 1 year
    });
    if (error) throw error;

    // ✅ Update local table if needed
    await supa.from("profiles").update({ disabled: true }).eq("id", user_id);

    return ok({ success: true, message: "User banned (disabled)" });
  } catch (error) {
    console.error("admin-ban-user error:", error);
    return err(error.message || "Failed to disable user", 500);
  }
});
