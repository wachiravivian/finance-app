import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { supabase } from "../supabaseClient";
import { getMonthKey, monthRange } from "../utils/date";

type TxRow = {
  amount: number;
  direction: "in" | "out";
  category: string | null;
  occurred_at: string;
};

type BudgetRow = {
  id: string;
  user_id: string;
  category: string;
  amount_monthly: number;
  budget_month: string;
};

// === Utility helpers ===
function titleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function currency(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export default function InsightsScreen() {
  const [loading, setLoading] = useState(false);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [spentByCat, setSpentByCat] = useState<Record<string, number>>({});
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) {
        setIncome(0);
        setExpenses(0);
        setBudgets([]);
        setSpentByCat({});
        return;
      }

      const monthKey = getMonthKey(); // "YYYY-MM"
      const { start, end } = monthRange(monthKey);

      // Load current month’s transactions
      const { data: txData, error: txErr } = await supabase
        .from("transactions")
        .select("amount, direction, category, occurred_at")
        .eq("user_id", userId)
        .gte("occurred_at", start)
        .lt("occurred_at", end);

      if (txErr) console.error("transactions load error:", txErr);

      const txs: TxRow[] = (txData ?? []).map((t: any) => ({
        amount: Number(t.amount ?? 0),
        direction: t.direction === "in" ? "in" : "out",
        category: t.category ?? "uncategorized",
        occurred_at: t.occurred_at,
      }));

      // Compute totals
      let inc = 0;
      let exp = 0;
      const catMap: Record<string, number> = {};
      for (const t of txs) {
        if (t.direction === "in") inc += t.amount;
        else exp += t.amount;
        const key = (t.category ?? "uncategorized").toLowerCase();
        if (t.direction === "out")
          catMap[key] = (catMap[key] ?? 0) + t.amount;
      }

      setIncome(inc);
      setExpenses(exp);
      setSpentByCat(catMap);

      // Load budgets for this month
      const { data: budData, error: budErr } = await supabase
        .from("budgets")
        .select("id, user_id, category, amount_monthly, budget_month")
        .eq("user_id", userId)
        .eq("budget_month", monthKey);

      if (!budErr && budData) setBudgets(budData as BudgetRow[]);

      // Generate personalized insights
      const recs = generateRecommendations({ income: inc, expenses: exp, catMap });
      setRecommendations(recs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const net = income - expenses;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>Your Financial Insights</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          {/* Summary */}
          <View style={styles.row}>
            <View style={styles.card}>
              <Text style={styles.label}>Income</Text>
              <Text style={[styles.val, { color: "#16a34a" }]}>{currency(income)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Expenses</Text>
              <Text style={[styles.val, { color: "#dc2626" }]}>{currency(expenses)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Net Savings</Text>
            <Text
              style={[
                styles.big,
                { color: net >= 0 ? "#16a34a" : "#dc2626" },
              ]}
            >
              {net >= 0 ? "+" : "-"}{currency(Math.abs(net))}
            </Text>
          </View>

          {/* Top Categories */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Top Spending Categories</Text>
            {Object.keys(spentByCat).length === 0 ? (
              <Text style={styles.muted}>No spending recorded yet.</Text>
            ) : (
              Object.entries(spentByCat)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, amt]) => (
                  <View key={cat} style={styles.budRow}>
                    <Text style={styles.budCat}>{titleCase(cat)}</Text>
                    <Text style={styles.budLine}>{currency(amt)}</Text>
                  </View>
                ))
            )}
          </View>

          {/* Budgets */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Budgets Overview</Text>
            {budgets.length === 0 ? (
              <Text style={styles.muted}>No budgets set for this month.</Text>
            ) : (
              budgets.map((b) => {
                const key = (b.category ?? "uncategorized").toLowerCase();
                const spent = Number(spentByCat[key] ?? 0);
                const left = Math.max(0, b.amount_monthly - spent);
                return (
                  <View key={b.id} style={styles.budRow}>
                    <Text style={styles.budCat}>{titleCase(b.category)}</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.budLine}>Budget: {currency(b.amount_monthly)}</Text>
                      <Text style={styles.budLine}>Spent: {currency(spent)}</Text>
                      <Text
                        style={[
                          styles.budLine,
                          { fontWeight: "700", color: left <= 0 ? "#dc2626" : "#16a34a" },
                        ]}
                      >
                        Left: {currency(left)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Personalized Recommendations */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>AI Recommendations</Text>
            {recommendations.length === 0 ? (
              <Text style={styles.muted}>Import more transactions to see insights.</Text>
            ) : (
              recommendations.map((r, i) => (
                <Text key={i} style={styles.recommendation}>
                  • {r}
                </Text>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// === Generate smart insights ===
function generateRecommendations({
  income,
  expenses,
  catMap,
}: {
  income: number;
  expenses: number;
  catMap: Record<string, number>;
}): string[] {
  const recs: string[] = [];
  const top = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (income <= 0 && expenses <= 0) return ["Import a statement to see insights."];

  if (income > 0 && expenses > income * 0.9)
    recs.push("You're spending almost all your income. Consider setting tighter category budgets.");

  if (income > 0 && expenses < income * 0.5)
    recs.push("Excellent savings rate! You’re spending less than half your income.");

  if (top.length) {
    const [cat, amt] = top[0];
    recs.push(`Your highest expense this month is on ${titleCase(cat)} (${currency(amt)}).`);
  }

  const food = catMap["food"] || catMap["groceries"];
  if (food && food > expenses * 0.3)
    recs.push("Food expenses exceed 30% of your total spending — review meal planning or shopping habits.");

  const fees = Object.entries(catMap).find(([k]) => k.includes("fee") || k.includes("charge"));
  if (fees) recs.push("You’ve paid noticeable fees or charges — consider reviewing payment methods.");

  if (recs.length === 0)
    recs.push("All good! Keep tracking to see personalized tips based on your spending trends.");

  return recs;
}

// === Styles ===
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a", marginBottom: 16 },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: { color: "#64748b", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  val: { fontSize: 18, fontWeight: "800" },
  big: { fontSize: 22, fontWeight: "800" },
  sectionTitle: { fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  muted: { color: "#64748b" },
  budRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#eef2f7",
  },
  budCat: { fontWeight: "700", color: "#0f172a" },
  budLine: { fontSize: 13, color: "#334155" },
  recommendation: { fontSize: 13, color: "#0f172a", marginBottom: 4 },
});
