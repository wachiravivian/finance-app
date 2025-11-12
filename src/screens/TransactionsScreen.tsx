// src/screens/TransactionsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { supabase } from "../supabaseClient";
import MpesaPdfImport from "../components/MpesaPdfImport";
import PasteTextImport from "../components/PasteTextImport";
import DebugPdfText from "../components/DebugPdfText";

type Tx = {
  id: string;
  ts: string;
  direction: "debit" | "credit";
  amount: number;
  method: string | null;
  type: string | null;
  counterparty: string | null;
  reference: string | null;
  category: string | null;
  notes: string | null;
};

export default function TransactionsScreen() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPasteImport, setShowPasteImport] = useState(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("transactions")
      .select("id, ts, direction, amount, method, type, counterparty, reference, category, notes")
      .eq("user_id", userId)
      .order("ts", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Query error:", error);
      setRows([]);
    } else {
      setRows((data as Tx[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Calculate summary stats
  const summary = rows.reduce(
    (acc, t) => {
      if (t.direction === "credit") {
        acc.income += t.amount;
      } else {
        acc.expenses += t.amount;
      }
      return acc;
    },
    { income: 0, expenses: 0 }
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTransactions} />}
    >
      {/* Header */}
      <Text style={styles.title}>Transactions</Text>

      {/* Summary Cards */}
      {rows.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Income</Text>
            <Text style={[styles.summaryAmount, { color: "#16a34a" }]}>
              +KES {summary.income.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <Text style={[styles.summaryAmount, { color: "#dc2626" }]}>
              -KES {summary.expenses.toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      {/* Import Actions */}
      <View style={styles.actionsContainer}>
        <MpesaPdfImport onImported={loadTransactions} />
        
        <TouchableOpacity
          onPress={() => setShowPasteImport(!showPasteImport)}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {showPasteImport ? "Hide" : "Paste Text"} 📋
          </Text>
        </TouchableOpacity>
      </View>

      {/* Paste Text Importer */}
      {showPasteImport && (
        <View style={styles.pasteContainer}>
          <PasteTextImport onImported={() => {
            loadTransactions();
            setShowPasteImport(false);
          }} />
        </View>
      )}

      {/* Transaction List */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            {rows.length} Transaction{rows.length !== 1 ? "s" : ""}
          </Text>
          {rows.length > 0 && (
            <TouchableOpacity onPress={loadTransactions}>
              <Text style={styles.refreshText}>↻ Refresh</Text>
            </TouchableOpacity>
          )}
        </View>

        {rows.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📊</Text>
            <Text style={styles.emptyStateText}>No transactions yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Import your M-PESA statement to get started
            </Text>
          </View>
        )}

        {rows.map((t) => {
          const date = new Date(t.ts);
          const isCredit = t.direction === "credit";
          
          return (
            <View key={t.id} style={styles.txCard}>
              <View style={styles.txHeader}>
                <Text style={styles.txCounterparty} numberOfLines={1}>
                  {t.counterparty || "(No description)"}
                </Text>
                <Text style={[styles.txAmount, { color: isCredit ? "#16a34a" : "#dc2626" }]}>
                  {isCredit ? "+" : "-"}KES {Number(t.amount ?? 0).toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.txMeta}>
                <Text style={styles.txMetaText}>
                  {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {t.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{t.category}</Text>
                  </View>
                )}
              </View>
              
              {t.reference && (
                <Text style={styles.txReference}>Ref: {t.reference}</Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
    color: "#0f172a",
  },
  summaryContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
    fontWeight: "600",
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: "700",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 15,
  },
  pasteContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  listContainer: {
    marginTop: 8,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  refreshText: {
    color: "#0ea5e9",
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#64748b",
  },
  txCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  txHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 12,
  },
  txCounterparty: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  txAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  txMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  txMetaText: {
    fontSize: 13,
    color: "#64748b",
  },
  categoryBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  txReference: {
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});