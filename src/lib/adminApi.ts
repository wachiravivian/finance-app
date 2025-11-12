// src/lib/adminApi.ts
import { supabase } from "../supabaseClient";

// ---------- Helpers ----------
async function getJwt() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Always returns a plain string-to-string object (no undefined values). */
function authHeaders(jwt?: string | null): Record<string, string> {
  const h: Record<string, string> = {};
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  return h;
}

// ---------- Totals (cards on Admin Dashboard) ----------
export async function adminTotals(): Promise<{
  users: number;
  transactions: number;
  budgets: number;
  activeToday: number;
  weeklyActive: number;
}> {
  const jwt = await getJwt();

  const { data, error } = await supabase.functions.invoke("admin-totals", {
    headers: authHeaders(jwt),
    body: {},
  });

  if (error || !data) {
    console.log("adminTotals error:", error);
    return { users: 0, transactions: 0, budgets: 0, activeToday: 0, weeklyActive: 0 };
  }

  return {
    users: data.users ?? 0,
    transactions: data.transactions ?? 0,
    budgets: data.budgets ?? 0,
    activeToday: data.activeToday ?? 0,
    weeklyActive: data.weeklyActive ?? 0,
  };
}

// ---------- Users: list ----------
export async function adminListUsers(limit = 100): Promise<{ rows: any[]; error?: any }> {
  const jwt = await getJwt();
  const { data, error } = await supabase.functions.invoke("admin-list-users", {
    headers: authHeaders(jwt),
    body: { limit },
  });
  if (error) {
    console.log("adminListUsers error:", error);
    return { rows: [], error };
  }
  return { rows: (data as any)?.rows ?? [] };
}

// ---------- Users: details ----------
export async function adminUserDetails(user_id: string): Promise<{
  profile: any | null;
  transactions: any[];
  error?: any;
}> {
  const jwt = await getJwt();
  const { data, error } = await supabase.functions.invoke("admin-user-details", {
    headers: authHeaders(jwt),
    body: { user_id },
  });
  if (error) {
    console.log("adminUserDetails error:", error);
    return { profile: null, transactions: [], error };
  }
  return {
    profile: (data as any)?.profile ?? null,
    transactions: (data as any)?.transactions ?? [],
  };
}

// ---------- Reports: simple signups/day (optional) ----------
export async function adminReports(days = 7): Promise<{ rows: { date: string; new_users: number }[] }> {
  const jwt = await getJwt();
  const { data, error } = await supabase.functions.invoke("admin-reports", {
    headers: authHeaders(jwt),
    body: { days },
  });
  if (error) {
    console.log("adminReports error:", error);
    return { rows: [] };
  }
  return { rows: (data as any)?.rows ?? [] };
}

// ---------- Reports: Active (client-side aggregation example) ----------
export async function adminActiveReport(days = 7): Promise<{ rows: { date: string; active_users: number }[] }> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));

  const { data, error } = await supabase
    .from("profiles")
    .select("last_seen_at")
    .not("last_seen_at", "is", null)
    .gte("last_seen_at", since.toISOString());

  if (error) return { rows: [] };

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
  }

  (data ?? []).forEach((r: any) => {
    const key = new Date(r.last_seen_at).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  const rows = Array.from(buckets.entries()).map(([date, active_users]) => ({ date, active_users }));
  return { rows };
}

// ---------- User actions ----------
export async function adminUpdateUserRole(user_id: string, newRole: "user" | "admin" | "disabled") {
  const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", user_id);
  return { error };
}

export async function adminDisableUser(user_id: string) {
  const { error } = await supabase.from("profiles").update({ role: "disabled" }).eq("id", user_id);
  return { error };
}

// Delete via service role (Edge Function) if you created it
export async function adminDeleteUser(user_id: string) {
  const jwt = await getJwt();
  const { data, error } = await supabase.functions.invoke("admin-delete-user", {
    headers: authHeaders(jwt),
    body: { user_id },
  });
  if (error) return { error };
  return { error: null, data };
}

// ---------- Create user (auth + profile) via function ----------
export async function adminCreateUser(userData: {
  email: string;
  password: string;
  display_name?: string | null;
  phone?: string | null;
  role?: "user" | "admin";
}): Promise<{ error: { message: string } | null; user: any | null }> {
  const jwt = await getJwt();
  if (!jwt) return { error: { message: "Not signed in as admin" }, user: null };

  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    headers: authHeaders(jwt),
    body: {
      email: userData.email,
      password: userData.password,
      display_name: userData.display_name ?? null,
      phone: userData.phone ?? null,
      role: userData.role ?? "user",
    },
  });

  if (error) {
    console.log("adminCreateUser error:", error);
    return { error: { message: error.message ?? "Failed to create user" }, user: null };
  }

  const resp = data as any;
  if (resp?.error) {
    return { error: { message: String(resp.error) }, user: null };
  }
  return { error: null, user: resp?.user ?? null };
}

// ---------- Finance (budgets & goals) ----------
export async function adminListBudgets(params?: {
  user_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ rows: any[]; error?: any }> {
  const jwt = await getJwt();
  const { data, error } = await supabase.functions.invoke("admin-list-budgets", {
    headers: authHeaders(jwt),
    body: params ?? {},
  });
  if (error) {
    console.log("adminListBudgets error:", error);
    return { rows: [], error };
  }
  return { rows: (data as any)?.rows ?? [] };
}

export async function adminListGoals(params?: {
  user_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ rows: any[]; error?: any }> {
  const jwt = await getJwt();
  const { data, error } = await supabase.functions.invoke("admin-list-goals", {
    headers: authHeaders(jwt),
    body: params ?? {},
  });
  if (error) {
    console.log("adminListGoals error:", error);
    return { rows: [], error };
  }
  return { rows: (data as any)?.rows ?? [] };
}

export async function adminFinanceReport(params?: {
  from?: string;
  to?: string;
}): Promise<{
  budgetsByCategory: Record<string, number>;
  goalsProgress: { lt50: number; btw50_80: number; gte80: number; achieved: number };
}> {
  const jwt = await getJwt();
  const { data, error } = await supabase.functions.invoke("admin-finance-report", {
    headers: authHeaders(jwt),
    body: params ?? {},
  });

  if (error || !data) {
    console.log("adminFinanceReport error:", error);
    return {
      budgetsByCategory: {},
      goalsProgress: { lt50: 0, btw50_80: 0, gte80: 0, achieved: 0 },
    };
  }
  return data as any;
}
