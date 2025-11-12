import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { supabase } from "../supabaseClient";
import { colors, spacing, radius } from "../constants/styles";

type BudgetRow = {
  id: string;
  user_id: string;
  category: string;
  amount_monthly: number;
  budget_month: string;
  created_at: string;
};

type SpendByCategory = Record<string, number>;

const currency = (n: number) => `KES ${Number(n).toLocaleString()}`;

function ProgressBar({ pct, tint }: { pct: number; tint?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${p}%`, backgroundColor: tint || colors.primary },
        ]}
      />
    </View>
  );
}

export default function BudgetsScreen() {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [spend, setSpend] = useState<SpendByCategory>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const monthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  /** Load budgets + spending for current month */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) throw new Error("Not logged in");

      // 1️⃣ Fetch budgets for current month
      const { data: b, error: e1 } = await supabase
        .from("budgets")
        .select("id, user_id, category, amount_monthly, budget_month, created_at")
        .eq("user_id", user.id)
        .eq("budget_month", monthKey)
        .order("created_at", { ascending: true });
      if (e1) throw e1;

      // 2️⃣ Spending per category (for this month)
      const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();

      const { data: tx, error: e2 } = await supabase
        .from("transactions")
        .select("category, amount, direction, ts")
        .eq("user_id", user.id)
        .gte("ts", start)
        .lt("ts", end);

      if (e2) throw e2;

      const s: SpendByCategory = {};
      (tx ?? []).forEach((t: any) => {
        const cat = (t.category ?? "Uncategorized").toLowerCase();
        const amt = Number(t.amount) || 0;
        if (t.direction === "debit") {
          s[cat] = (s[cat] || 0) + amt;
        }
      });

      setBudgets(b || []);
      setSpend(s);
    } catch (err: any) {
      console.log("budgets load error:", err?.message);
      Alert.alert("Error", err?.message ?? "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  /** Totals */
  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((sum, r) => sum + Number(r.amount_monthly || 0), 0);
    const spent = budgets.reduce((sum, r) => {
      const cat = r.category.toLowerCase();
      return sum + (spend[cat] || 0);
    }, 0);
    const remaining = totalBudget - spent;
    return { totalBudget, spent, remaining };
  }, [budgets, spend]);

  /** Add new budget */
  async function addBudget() {
    const cat = newCategory.trim();
    const amt = parseFloat(newAmount);
    if (!cat) return Alert.alert("Validation", "Category is required");
    if (!amt || amt <= 0) return Alert.alert("Validation", "Enter a valid amount");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return Alert.alert("Error", "You must be logged in.");

    try {
      const { error } = await supabase
        .from("budgets")
        .insert([
          {
            user_id: user.id,
            category: cat,
            amount_monthly: amt,
            budget_month: monthKey,
          },
        ]);

      if (error) throw error;
      setModalOpen(false);
      setNewCategory("");
      setNewAmount("");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add budget");
    }
  }

  const renderItem = ({ item }: { item: BudgetRow }) => {
    const key = item.category.toLowerCase();
    const used = spend[key] || 0;
    const limit = Number(item.amount_monthly) || 0;
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const tint = pct >= 90 ? "#F59E0B" : pct >= 75 ? "#3B82F6" : "#10B981";

    return (
      <View style={styles.budgetCard}>
        <View style={styles.rowSpace}>
          <Text style={styles.budgetTitle}>{item.category}</Text>
          <Text style={styles.budgetAmounts}>
            {currency(used)} <Text style={{ color: colors.muted }}>/ {currency(limit)}</Text>
          </Text>
        </View>
        <ProgressBar pct={isFinite(pct) ? pct : 0} tint={tint} />
        <View style={styles.percentRow}>
          <Text style={[styles.percentText, { color: tint }]}>{isFinite(pct) ? `${pct}%` : "0%"}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={styles.screenTitle}>Budget Management</Text>

      {/* Totals card */}
      <View style={styles.totalsCard}>
        <Text style={styles.totalsTitle}>Monthly Budget ({monthKey})</Text>
        <View style={styles.totalsRow}>
          <View style={styles.totalsCol}>
            <Text style={styles.totalsLabel}>Total Budget</Text>
            <Text style={styles.totalsValue}>{currency(totals.totalBudget)}</Text>
          </View>
          <View style={styles.totalsCol}>
            <Text style={styles.totalsLabel}>Spent</Text>
            <Text style={styles.totalsValue}>{currency(totals.spent)}</Text>
          </View>
          <View style={styles.totalsCol}>
            <Text style={[styles.totalsLabel]}>Remaining</Text>
            <Text style={[styles.totalsValue, { color: "#10B981" }]}>
              {currency(Math.max(0, totals.remaining))}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your Budget Categories</Text>

      {loading ? (
        <View style={{ padding: spacing.lg, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : budgets.length === 0 ? (
        <Text style={{ color: colors.muted, paddingHorizontal: spacing.md }}>
          No budgets yet. Tap “+” to add one.
        </Text>
      ) : (
        <FlatList
          data={budgets}
          keyExtractor={(x) => x.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 120 }}
        />
      )}

      {/* Floating + button */}
      <View style={styles.fabWrap}>
        <TouchableOpacity style={styles.fab} onPress={() => setModalOpen(true)}>
          <Text style={styles.fabPlus}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Add Budget Modal */}
      <Modal transparent visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.select({ ios: "padding", android: undefined })}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Budget</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Category</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Food"
                value={newCategory}
                onChangeText={setNewCategory}
              />

              <Text style={styles.label}>Limit (KES)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 4000"
                keyboardType="numeric"
                value={newAmount}
                onChangeText={setNewAmount}
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={addBudget}>
                <Text style={styles.primaryBtnText}>Save Budget</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  totalsCard: {
    backgroundColor: "#fff",
    marginHorizontal: spacing.md,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    marginBottom: spacing.md,
  },
  totalsTitle: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  totalsCol: { flex: 1 },
  totalsLabel: { color: colors.muted, fontSize: 14, marginBottom: 4 },
  totalsValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  budgetCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    marginBottom: spacing.md,
  },
  rowSpace: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  budgetAmounts: { fontWeight: "800", color: colors.text },
  progressTrack: {
    height: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressFill: { height: "100%", borderRadius: 999 },
  percentRow: { alignItems: "flex-end", marginTop: 6 },
  percentText: { fontWeight: "800" },
  fabWrap: { position: "absolute", right: spacing.lg, bottom: spacing.lg },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#4666AE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  fabPlus: { color: "#fff", fontSize: 34, lineHeight: 34, fontWeight: "800" },
  sheetWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: "85%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  closeX: { fontSize: 20, color: colors.text },
  label: { fontWeight: "700", color: colors.text, marginTop: spacing.lg, marginBottom: spacing.xs },
  input: {
    backgroundColor: "#fff",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    fontSize: 16,
    color: colors.text,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
