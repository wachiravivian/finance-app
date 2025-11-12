import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../supabaseClient";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}KSh ${Math.abs(n).toFixed(2)}`;
}

export async function generateUserReportPDF() {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not signed in");

  // Pull last 30 days transactions + budgets + goals quick stats
  const since = new Date(); since.setDate(since.getDate() - 30);
  const [{ data: tx }, { data: budgets }, { data: goals }, { data: fp }] = await Promise.all([
    supabase.from("transactions").select("*").eq("user_id", userId).gte("created_at", since.toISOString()).order("created_at", { ascending: false }),
    supabase.from("budgets").select("*").eq("user_id", userId),
    supabase.from("goals").select("*").eq("user_id", userId),
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle()
  ]);

  const totalIn = (tx ?? []).filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = (tx ?? []).filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  const html = `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; }
      h1 { margin: 0 0 4px 0; }
      h2 { margin: 24px 0 8px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; font-size: 12px; }
      .muted { color: #6b7280; }
      .badge { display:inline-block; padding:4px 8px; background:#111827; color:#fff; border-radius:999px; font-size:12px; }
    </style>
  </head>
  <body>
    <h1>MoneySmart — Personal Report</h1>
    <div class="muted">Last 30 days</div>

    <h2>Summary</h2>
    <div>Income: <strong>${money(totalIn)}</strong></div>
    <div>Expenses: <strong>${money(totalOut)}</strong></div>
    <div>Net: <strong>${money(totalIn + totalOut)}</strong></div>
    ${fp ? `<div style="margin-top:8px">Financial Health: <span class="badge">${String(fp.fh_label).toUpperCase()}</span> Score: ${(fp.fh_score*100).toFixed(0)}%</div>` : ""}

    <h2>Recent Transactions</h2>
    <table>
      <thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th></tr></thead>
      <tbody>
        ${(tx ?? []).slice(0, 40).map(t => `
          <tr>
            <td>${new Date(t.created_at).toLocaleString()}</td>
            <td>${t.title}</td>
            <td>${t.category}</td>
            <td>${money(t.amount)}</td>
          </tr>`).join("")}
      </tbody>
    </table>

    <h2>Budgets</h2>
    <table>
      <thead><tr><th>Category</th><th>Amount</th></tr></thead>
      <tbody>
        ${(budgets ?? []).map(b => `<tr><td>${b.category}</td><td>${money(Number(b.amount||0))}</td></tr>`).join("")}
      </tbody>
    </table>

    <h2>Goals</h2>
    <table>
      <thead><tr><th>Title</th><th>Target</th><th>Saved</th></tr></thead>
      <tbody>
        ${(goals ?? []).map(g => `<tr><td>${g.title}</td><td>${money(Number(g.target_amount||0))}</td><td>${money(Number(g.current_amount||0))}</td></tr>`).join("")}
      </tbody>
    </table>
  </body>
  </html>
  `;

  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "Share your report" });
  }
  return file.uri;
}

export async function generateAdminReportPDF() {
  // Lightweight admin snapshot (service role not used here; relies on your admin RLS bypass via policies/functions)
  const since = new Date(); since.setDate(since.getDate() - 30);

  // These require admin access; call from an admin session (your useAuth isAdmin check).
  const [{ data: userCounts }, { data: tx }] = await Promise.all([
    supabase.from("profiles").select("id"),
    supabase.from("transactions").select("*").gte("created_at", since.toISOString())
  ]);

  const totalUsers = (userCounts ?? []).length;
  const income = (tx ?? []).filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = (tx ?? []).filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  const html = `
    <html><body style="font-family:-apple-system,system-ui,sans-serif;padding:24px">
      <h1>MoneySmart — Admin Report</h1>
      <div class="muted">Last 30 days</div>
      <h2>Summary</h2>
      <div>Total users: <strong>${totalUsers}</strong></div>
      <div>Recorded Income: <strong>${money(income)}</strong></div>
      <div>Recorded Expenses: <strong>${money(expense)}</strong></div>
    </body></html>
  `;
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "Share admin report" });
  }
  return file.uri;
}
