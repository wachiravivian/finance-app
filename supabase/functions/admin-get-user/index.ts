// supabase/functions/admin-get-user/index.ts
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

    console.log(`Getting user details for: ${user_id}`);

    // Get auth user data
    const { data: authData, error: authError } = await supa.auth.admin.getUserById(user_id);
    if (authError) {
      console.error("Auth error:", authError);
      return err("Failed to get auth user data", 404);
    }

    // Get profile data
    const { data: profileData, error: profileError } = await supa
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      // Don't return error here, just note that profile is missing
    }

    const userDetails = {
      auth: {
        id: authData.user?.id,
        email: authData.user?.email,
        banned_until: authData.user?.banned_until,
        ban_duration: authData.user?.ban_duration,
        created_at: authData.user?.created_at,
        last_sign_in_at: authData.user?.last_sign_in_at,
        email_confirmed_at: authData.user?.email_confirmed_at,
      },
      profile: profileData || { error: "Profile not found" }
    };

    console.log("User details retrieved successfully");
    return ok(userDetails);

  } catch (error) {
    console.error("admin-get-user error:", error);
    return err(error.message || "Failed to get user details", 500);
  }
});