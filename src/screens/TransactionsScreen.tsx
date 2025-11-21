import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from "react-native";
import { supabase } from "../supabaseClient";
import MpesaPdfImport from "../components/MpesaPdfImport";
import { checkBackendHealth } from "../utils/api";

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
  title: string | null;
};

export default function TransactionsScreen() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

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
      .select("id, ts, direction, amount, method, type, counterparty, reference, category, notes, title")
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
    checkBackendConnection();
  }, [loadTransactions]);

  const checkBackendConnection = async () => {
    const isOnline = await checkBackendHealth();
    setBackendOnline(isOnline);
  };

  const clearAllTransactions = async () => {
    try {
      setClearing(true);
      
      const { data: u, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        Alert.alert("Error", "Authentication failed");
        setClearing(false);
        return;
      }
      
      const userId = u?.user?.id;
      
      if (!userId) {
        Alert.alert("Error", "Not signed in");
        setClearing(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        Alert.alert("Error", "Failed to delete transactions");
        setClearing(false);
        return;
      }

      Alert.alert("Success", "All transactions cleared successfully");
      loadTransactions();
      setShowClearConfirm(false);
      
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setClearing(false);
    }
  };

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
      refreshControl={
        <RefreshControl 
          refreshing={loading} 
          onRefresh={() => {
            loadTransactions();
            checkBackendConnection();
          }} 
        />
      }
    >
      <Text style={styles.title}>Transactions</Text>

      {!backendOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Backend server offline - PDF import unavailable
          </Text>
          <TouchableOpacity onPress={checkBackendConnection}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {rows.length > 0 && (
        <View style={styles.clearSection}>
          <Text style={styles.clearWarning}>
            Clear existing transactions before re-importing to avoid duplicates
          </Text>
          <Text style={styles.clearSubtext}>
            Found {rows.length} transactions
          </Text>
          <TouchableOpacity 
            onPress={() => setShowClearConfirm(true)}
            disabled={clearing}
            style={[
              styles.clearButton,
              clearing && styles.disabledButton
            ]}
          >
            {clearing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.clearButtonText}>
                Clear All Transactions
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

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

      <View style={styles.actionsContainer}>
        <MpesaPdfImport onImported={loadTransactions} />
      </View>

      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            {rows.length} Transaction{rows.length !== 1 ? "s" : ""}
          </Text>
          {rows.length > 0 && (
            <TouchableOpacity onPress={loadTransactions}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          )}
        </View>

        {rows.length === 0 && !loading && (
          <View style={styles.emptyState}>
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
                  {t.counterparty || t.title || "(No description)"}
                </Text>
                <Text style={[styles.txAmount, { color: isCredit ? "#16a34a" : "#dc2626" }]}>
                  {isCredit ? "+" : "-"}KES {Number(t.amount ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.txMeta}>
                <Text style={styles.txMetaText}>
                  {date.toLocaleDateString()} • {date.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
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

      {showClearConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Clear All Transactions?</Text>
            <Text style={styles.modalText}>
              This will permanently delete all {rows.length} transactions. This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                onPress={() => setShowClearConfirm(false)}
                disabled={clearing}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={clearAllTransactions}
                disabled={clearing}
                style={[styles.modalButton, styles.confirmButton]}
              >
                {clearing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Clear All</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  offlineBanner: {
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  offlineText: {
    color: "#dc2626",
    fontSize: 14,
    flex: 1,
  },
  retryText: {
    color: "#dc2626",
    fontWeight: "600",
    marginLeft: 8,
  },
  clearSection: {
    backgroundColor: "#fffbeb",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fef3c7",
  },
  clearWarning: {
    color: "#92400e",
    fontSize: 14,
    marginBottom: 4,
    textAlign: "center",
    fontWeight: "600",
  },
  clearSubtext: {
    color: "#92400e",
    fontSize: 12,
    marginBottom: 12,
    textAlign: "center",
    opacity: 0.8,
  },
  clearButton: {
    backgroundColor: "#dc2626",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  disabledButton: {
    backgroundColor: "#94a3b8",
    opacity: 0.7,
  },
  clearButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
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
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#0f172a",
  },
  modalText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
  },
  confirmButton: {
    backgroundColor: "#dc2626",
  },
  cancelButtonText: {
    color: "#64748b",
    fontWeight: "600",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});