// src/components/DashboardBadges.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { supabase } from "../supabaseClient";
import { getMonthKey, monthRange } from "../utils/date";

export default function DashboardBadges() {
  const [net, setNet] = useState(0);
  const [dueToday, setDueToday] = useState(0);
  const [topBudgetLeft, setTopBudgetLeft] = useState<string>("—");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) return;

      const monthKey = getMonthKey();
      const { start, end } = monthRange(monthKey);

      // Net this month
      const { data: txs } = await supabase
        .from("transactions")
        .select("amount, direction")
        .eq("user_id", userId)
        .gte("ts", start)
        .lt("ts", end);

      let income = 0, expenses = 0;
      for (const t of txs ?? []) {
        const amt = Number(t.amount ?? 0);
        if (t.direction === "credit") income += amt; else expenses += amt;
      }
      setNet(income - expenses);

      // Due today (reminders)
      const now = new Date();
      const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
      const endDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)).toISOString();

      const { count: due } = await supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("done", false)
        .gte("due_at", startDay)
        .lt("due_at", endDay);

      setDueToday(due ?? 0);

      // Top budget left
      const { data: buds } = await supabase
        .from("budgets")
        .select("category, amount_monthly, budget_month")
        .eq("user_id", userId)
        .eq("budget_month", monthKey);

      const { data: catTxs } = await supabase
        .from("transactions")
        .select("amount, direction, category")
        .eq("user_id", userId)
        .gte("ts", start)
        .lt("ts", end);

      const spent: Record<string, number> = {};
      for (const t of catTxs ?? []) {
        if (t.direction === "debit") {
          const key = (t.category ?? "uncategorized").toLowerCase();
          spent[key] = (spent[key] ?? 0) + Number(t.amount ?? 0);
        }
      }

      let bestCat = "—";
      let maxLeft = -Infinity;
      for (const b of buds ?? []) {
        const key = (b.category ?? "uncategorized").toLowerCase();
        const left = Number(b.amount_monthly ?? 0) - Number(spent[key] ?? 0);
        if (left > maxLeft) {
          maxLeft = left;
          bestCat = `${b.category}: KES ${Math.max(0, left).toLocaleString()}`;
        }
      }
      setTopBudgetLeft(bestCat);
    })();
  }, []);

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <Text style={styles.label}>💡 Net this month</Text>
        <Text style={[styles.val, { color: net >= 0 ? "#16a34a" : "#dc2626" }]}>
          {net >= 0 ? "+" : "-"}KES {Math.abs(net).toLocaleString()}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>⏰ Due today</Text>
        <Text style={styles.val}>{dueToday}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>📊 Budget left</Text>
        <Text style={styles.small}>{topBudgetLeft}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: 12, elevation: 2 },
  label: { fontWeight: "700", color: "#334155", marginBottom: 6 },
  val: { fontSize: 18, fontWeight: "800" },
  small: { fontSize: 12, fontWeight: "700", color: "#0f172a" },
});
