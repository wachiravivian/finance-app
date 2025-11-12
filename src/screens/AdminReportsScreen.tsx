// src/screens/AdminReportsScreen.tsx
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing, radius } from "../constants/styles";
import { adminFinanceReport } from "../lib/adminApi";
import { generateAdminReportPDF } from "../utils/reports";

type GoalsProgress = { lt50: number; btw50_80: number; gte80: number; achieved: number };
type ReportPayload = { budgetsByCategory: Record<string, number>; goalsProgress: GoalsProgress };

export default function AdminReportsScreen() {
  const nav = useNavigation();
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={async () => {
            try {
              await generateAdminReportPDF();
            } catch (e) {
              console.log("Admin PDF error", e);
            }
          }}
          style={{ marginRight: 8 }}
        >
          <Text style={{ fontWeight: "800", color: "#111827" }}>Export PDF</Text>
        </TouchableOpacity>
      ),
    });
  }, [nav]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 13);

        const res = await adminFinanceReport({
          from: from.toISOString(),
          to: to.toISOString(),
        });

        setPayload(res);
      } catch (err) {
        console.error("adminFinanceReport error:", err);
        setPayload({
          budgetsByCategory: {},
          goalsProgress: { lt50: 0, btw50_80: 0, gte80: 0, achieved: 0 },
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categoryRows = useMemo(() => {
    const map = payload?.budgetsByCategory ?? {};
    return Object.entries(map).map(([category, total]) => ({ category, total }));
  }, [payload]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: colors.muted }}>Loading report…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Budgets by Category */}
      <View style={styles.card}>
        <Text style={styles.title}>Budgets by Category (KES)</Text>
      </View>

      <FlatList
        data={categoryRows}
        keyExtractor={(r) => r.category}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.category}</Text>
            <Text style={styles.rowAmount}>
              {Number(item.total).toLocaleString(undefined, {
                style: "currency",
                currency: "KES",
              })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: spacing.md }}>
            <Text style={{ color: colors.muted }}>No budget data.</Text>
          </View>
        }
      />

      {/* Goals Progress */}
      <View style={[styles.card, { marginTop: spacing.md }]}>
        <Text style={styles.title}>Goals Progress</Text>
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          <Chip label="< 50%" value={payload?.goalsProgress?.lt50 ?? 0} />
          <Chip label="50–80%" value={payload?.goalsProgress?.btw50_80 ?? 0} />
          <Chip label="≥ 80%" value={payload?.goalsProgress?.gte80 ?? 0} />
          <Chip label="Achieved" value={payload?.goalsProgress?.achieved ?? 0} />
        </View>
      </View>
    </View>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  row: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: spacing.md,
    marginHorizontal: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
  rowAmount: { fontWeight: "800", color: colors.text },
  chip: {
    backgroundColor: "#F3F4F6",
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chipLabel: { color: colors.text, fontWeight: "700" },
  chipValue: { color: colors.text, fontWeight: "800" },
});
