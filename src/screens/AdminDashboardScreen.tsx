import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { colors, spacing, radius } from "../constants/styles";
import { adminTotals } from "../lib/adminApi";

export default function AdminDashboardScreen() {
  const [totals, setTotals] = useState<{ users: number; transactions: number; budgets: number; activeToday: number; weeklyActive: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const t = await adminTotals();
      setTotals(t);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: colors.muted }}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.lg }}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>Overview and Statistics</Text>

      {/* Totals row */}
      <View style={styles.statsRow}>
        <StatCard title="Users" value={totals?.users ?? 0} icon="👥" />
        <StatCard title="Transactions" value={totals?.transactions ?? 0} icon="💰" />
        <StatCard title="Budgets" value={totals?.budgets ?? 0} icon="📊" />
      </View>
      
      {/* Activity row */}
      <View style={styles.statsRow}>
        <StatCard title="Active Today" value={totals?.activeToday ?? 0} icon="⚡" />
        <StatCard title="Weekly Active" value={totals?.weeklyActive ?? 0} icon="📈" />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Quick Actions</Text>
        <Text style={styles.infoText}>• View and manage users in the "Users" screen</Text>
        <Text style={styles.infoText}>• View reports and analytics in the "Reports" screen</Text>
        <Text style={styles.infoText}>• Add new users in the "Add User" screen</Text>
      </View>
    </ScrollView>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon?: string }) {
  return (
    <View style={styles.statCard}>
      {icon && <Text style={styles.statIcon}>{icon}</Text>}
      <Text style={styles.statValue}>{Number(value).toLocaleString()}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background, 
    padding: spacing.md 
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  statsRow: { 
    flexDirection: "row", 
    gap: spacing.sm, 
    marginBottom: spacing.md 
  },
  statCard: { 
    flex: 1, 
    backgroundColor: "#fff", 
    borderRadius: radius.lg, 
    padding: spacing.md, 
    borderWidth: 1, 
    borderColor: "#EFEFEF",
    alignItems: "center",
  },
  statIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  statValue: { 
    color: colors.text, 
    fontWeight: "800", 
    fontSize: 22,
    marginBottom: spacing.xs,
  },
  statTitle: { 
    color: colors.muted, 
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
});
