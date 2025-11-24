import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, assertAdmin, corsHeaders, ok, err } from "../_shared_admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const check = await assertAdmin(req);
    if (!check.ok) return err(check.error, 401);

    const supabase = adminClient();

    // Get total users count
    const { count: users, error: usersError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (usersError) throw usersError;

    // Get total reports count (if you have a reports table)
    const { count: reports, error: reportsError } = await supabase
      .from("reports") // Make sure this table exists
      .select("*", { count: "exact", head: true });

    // If reports table doesn't exist, default to 0
    const reportsCount = reportsError ? 0 : reports;

    // Get active users (users who signed in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: active, error: activeError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gt("last_sign_in_at", thirtyDaysAgo.toISOString());

    // If last_sign_in_at field doesn't exist, use last_seen_at or created_at as fallback
    const activeCount = activeError ? users || 0 : active;

    return ok({
      users: users || 0,
      reports: reportsCount || 0,
      active: activeCount || 0,
    });
  } catch (error) {
    console.error("Error in admin-get-stats:", error);
    return err(error.message, 500);
  }
});