// src/screens/TransactionsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { supabase } from "../supabaseClient";
import MpesaPdfImport from "../components/MpesaPdfImport";
import { checkBackendHealth } from "../utils/api";
import { useTheme } from "../hooks/useTheme";

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
  const { colors } = useTheme();

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
      .select(
        "id, ts, direction, amount, method, type, counterparty, reference, category, notes, title"
      )
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
      const { data: u } = await supabase.auth.getUser();
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
      if (t.direction === "credit") acc.income += t.amount;
      else acc.expenses += t.amount;
      return acc;
    },
    { income: 0, expenses: 0 }
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              loadTransactions();
              checkBackendConnection();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>

        {rows.length > 0 && (
          <View
            style={[
              styles.clearSection,
              {
                backgroundColor: colors.warningText + '15',
                borderColor: colors.warningText + '40',
              },
            ]}
          >
            <Text style={[styles.clearSubtext, { color: colors.textSecondary }]}>
              Found {rows.length} transactions
            </Text>
            <TouchableOpacity
              onPress={() => setShowClearConfirm(true)}
              disabled={clearing}
              style={[
                styles.clearButton,
                { backgroundColor: colors.danger },
                clearing && styles.disabledButton,
              ]}
            >
              {clearing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.clearButtonText}>Clear All Transactions</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {rows.length > 0 && (
          <View style={styles.summaryContainer}>
            <View
              style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}
            >
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Total Income
              </Text>
              <Text style={[styles.summaryAmount, { color: colors.income }]}>
                +KSH {summary.income.toLocaleString()}
              </Text>
            </View>
            <View
              style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}
            >
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Total Expenses
              </Text>
              <Text style={[styles.summaryAmount, { color: colors.expense }]}>
                -KSH {summary.expenses.toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actionsContainer}>
          <MpesaPdfImport onImported={loadTransactions} />
        </View>

        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={[styles.listHeaderText, { color: colors.text }]}>
              {rows.length} Transaction{rows.length !== 1 ? "s" : ""}
            </Text>
            {rows.length > 0 && (
              <TouchableOpacity onPress={loadTransactions}>
                <Text style={[styles.refreshText, { color: colors.primary }]}>
                  Refresh
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {rows.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.text }]}>
                No transactions yet
              </Text>
              <Text
                style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}
              >
                Import your M-PESA statement to get started
              </Text>
            </View>
          )}

          {rows.map((t) => {
            const date = new Date(t.ts);
            const isCredit = t.direction === "credit";
            return (
              <View
                key={t.id}
                style={[
                  styles.txCard,
                  {
                    backgroundColor: colors.cardBackground,
                    shadowColor: colors.text,
                  },
                ]}
              >
                <View style={styles.txHeader}>
                  <Text
                    style={[styles.txCounterparty, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {t.counterparty || t.title || "(No description)"}
                  </Text>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: isCredit ? colors.income : colors.expense },
                    ]}
                  >
                    {isCredit ? "+" : "-"}KSH{" "}
                    {Number(t.amount ?? 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.txMeta}>
                  <Text style={[styles.txMetaText, { color: colors.textSecondary }]}>
                    {date.toLocaleDateString()} •{" "}
                    {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  {t.category && (
                    <View
                      style={[
                        styles.categoryBadge,
                        {
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t.category}
                      </Text>
                    </View>
                  )}
                </View>
                {t.reference && (
                  <Text
                    style={[styles.txReference, { color: colors.textSecondary }]}
                  >
                    Ref: {t.reference}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={showClearConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Clear All Transactions?
            </Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              This will permanently delete all {rows.length} transactions. This
              action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowClearConfirm(false)}
                disabled={clearing}
                style={[styles.modalButton, { backgroundColor: colors.border }]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearAllTransactions}
                disabled={clearing}
                style={[styles.modalButton, { backgroundColor: colors.danger }]}
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
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 16 },
  clearSection: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  clearSubtext: { fontSize: 12, textAlign: "center", opacity: 0.8, marginBottom: 12 },
  clearButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  disabledButton: { opacity: 0.7 },
  clearButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  summaryContainer: { flexDirection: "row", gap: 12, marginBottom: 20 },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryLabel: { fontSize: 12, marginBottom: 4, fontWeight: "600" },
  summaryAmount: { fontSize: 20, fontWeight: "700" },
  actionsContainer: { flexDirection: "row", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  listContainer: { marginTop: 8 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listHeaderText: { fontSize: 16, fontWeight: "700" },
  refreshText: { fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyStateText: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  emptyStateSubtext: { fontSize: 14 },
  txCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  txHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  txCounterparty: { flex: 1, fontSize: 15, fontWeight: "600" },
  txAmount: { fontSize: 16, fontWeight: "700" },
  txMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  txMetaText: { fontSize: 13 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  categoryText: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  txReference: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: { 
    padding: 20, 
    borderRadius: 12, 
    width: "100%", 
    maxWidth: 400,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  modalText: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  cancelButtonText: { fontWeight: "600" },
  confirmButtonText: { color: "#fff", fontWeight: "600" },
});