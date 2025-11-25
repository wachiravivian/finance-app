// supabase/functions/admin-update-user-auth/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, assertAdmin, corsHeaders, ok, err } from "../_shared_admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const check = await assertAdmin(req);
    if (!check.ok) return err(check.error, 401);

    const supa = adminClient();
    const { user_id, action } = await req.json();

    if (!user_id || !action) return err("Missing user_id or action", 400);

    console.log(`Updating user ${user_id} with action ${action}`);

    if (action === "ban") {
      await supa.auth.admin.updateUserById(user_id, { ban_duration: "8760h" });
      await supa.from("profiles").update({ disabled: true, updated_at: new Date().toISOString() }).eq("id", user_id);
    } else if (action === "unban") {
      await supa.auth.admin.updateUserById(user_id, { ban_duration: "none", banned_until: null });
      await supa.from("profiles").update({ disabled: false, updated_at: new Date().toISOString() }).eq("id", user_id);
    } else if (action === "delete") {
      await supa.auth.admin.deleteUser(user_id);
      await supa.from("profiles").delete().eq("id", user_id);
    } else {
      return err("Unknown action", 400);
    }

    return ok({ success: true, action });

  } catch (error) {
    console.error("admin-update-user-auth error:", error);
    return err(error.message || "Failed to update user", 500);
  }
});
