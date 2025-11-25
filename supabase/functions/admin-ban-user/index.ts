// supabase/functions/admin-ban-user/index.ts
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

    console.log(`Banning user: ${user_id}`);

    // Get user first to check current status
    const { data: user, error: getUserError } = await supa.auth.admin.getUserById(user_id);
    if (getUserError) {
      console.error("Error getting user:", getUserError);
      return err("User not found", 404);
    }

    console.log("Current user status before ban:", {
      ban_duration: user.user?.ban_duration,
      banned_until: user.user?.banned_until
    });

    // ✅ Ban user by setting ban duration
    const { data: updateData, error: updateError } = await supa.auth.admin.updateUserById(user_id, {
      ban_duration: "8760h", // 1 year
    });
    
    if (updateError) {
      console.error("Auth update error:", updateError);
      throw updateError;
    }

    console.log("Auth ban successful:", updateData);

    // ✅ Update local table
    const { error: profileError } = await supa
      .from("profiles")
      .update({ 
        disabled: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", user_id);

    if (profileError) {
      console.error("Profile update error:", profileError);
      // Don't throw here, as auth update was successful
    }

    // Verify the ban worked
    const { data: verifiedUser } = await supa.auth.admin.getUserById(user_id);
    console.log("Verified user status after ban:", {
      ban_duration: verifiedUser.user?.ban_duration,
      banned_until: verifiedUser.user?.banned_until
    });

    return ok({ 
      success: true, 
      message: "User banned successfully",
      user_status: {
        ban_duration: verifiedUser.user?.ban_duration,
        banned_until: verifiedUser.user?.banned_until
      }
    });
  } catch (error) {
    console.error("admin-ban-user error:", error);
    return err(error.message || "Failed to ban user", 500);
  }
});