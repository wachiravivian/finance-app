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

    // ✅ Delete from Auth
    const { error } = await supa.auth.admin.deleteUser(user_id);
    if (error) throw error;

    // ✅ Clean up from profiles table
    await supa.from("profiles").delete().eq("id", user_id);

    return ok({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("admin-delete-user error:", error);
    return err(error.message || "Failed to delete user", 500);
  }
});
