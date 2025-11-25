// supabase/functions/admin-unban-user/index.ts
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

    console.log(`Unbanning user: ${user_id}`);

    // Get user first to check current status
    const { data: user, error: getUserError } = await supa.auth.admin.getUserById(user_id);
    if (getUserError) {
      console.error("Error getting user:", getUserError);
      return err("User not found", 404);
    }

    console.log("Current user ban status:", {
      ban_duration: user.user?.ban_duration,
      banned_until: user.user?.banned_until
    });

    // ✅ CORRECT WAY: Unban by setting ban_duration to "none" and clearing banned_until
    const { data: updateData, error: updateError } = await supa.auth.admin.updateUserById(user_id, {
      ban_duration: "none",
      banned_until: null
    });

    if (updateError) {
      console.error("Auth update error:", updateError);
      
      // If the above fails, try alternative approach
      console.log("Trying alternative unban approach...");
      const { error: altError } = await supa.auth.admin.updateUserById(user_id, {
        ban_duration: null
      });
      
      if (altError) {
        console.error("Alternative approach also failed:", altError);
        throw altError;
      }
    }

    console.log("Auth unban successful:", updateData);

    // ✅ Update local table
    const { error: profileError } = await supa
      .from("profiles")
      .update({ 
        disabled: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", user_id);

    if (profileError) {
      console.error("Profile update error:", profileError);
      // Don't throw here, as auth update was successful
    }

    // Verify the unban worked
    const { data: verifiedUser } = await supa.auth.admin.getUserById(user_id);
    console.log("Verified user status after unban:", {
      ban_duration: verifiedUser.user?.ban_duration,
      banned_until: verifiedUser.user?.banned_until
    });

    return ok({ 
      success: true, 
      message: "User unbanned successfully",
      user_status: {
        ban_duration: verifiedUser.user?.ban_duration,
        banned_until: verifiedUser.user?.banned_until
      }
    });
  } catch (error) {
    console.error("admin-unban-user error:", error);
    return err(error.message || "Failed to unban user", 500);
  }
});