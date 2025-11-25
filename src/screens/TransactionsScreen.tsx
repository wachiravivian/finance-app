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
import { checkBackendHealth, testBackendConnection, getBackendConfig } from "../utils/api";
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
  const [connectionTesting, setConnectionTesting] = useState(false);
  const { colors } = useTheme();

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;

      if (!userId) {
        console.log("❌ No user ID found - user not signed in");
        setRows([]);
        setLoading(false);
        return;
      }

      console.log("📊 Loading transactions for user:", userId);

      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, ts, direction, amount, method, type, counterparty, reference, category, notes, title"
        )
        .eq("user_id", userId)
        .order("ts", { ascending: false })
        .limit(200);

      if (error) {
        console.error("❌ Query error:", error);
        Alert.alert("Error", `Failed to load transactions: ${error.message}`);
        setRows([]);
      } else {
        console.log(`✅ Loaded ${data?.length || 0} transactions`);
        setRows((data as Tx[]) ?? []);
      }
    } catch (error: any) {
      console.error("💥 Unexpected error loading transactions:", error);
      Alert.alert("Error", "Unexpected error loading transactions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkBackendConnection = async () => {
    console.log('🔄 Checking backend connection...');
    
    const isOnline = await checkBackendHealth();
    console.log(`📡 Backend status: ${isOnline ? 'Online' : 'Offline'}`);
    
    // For debugging - log the actual URL being used
    const config = getBackendConfig();
    console.log('🔧 Backend configuration:', config);
    
    setBackendOnline(isOnline);
    
    if (!isOnline) {
      // Show more helpful error message - FIXED: use localPort instead of port
      Alert.alert(
        'Backend Offline', 
        `Cannot connect to server at ${config.baseUrl}\n\nPlease ensure:
• Backend is running on port ${config.localPort}
• Python server is started
• Firewall allows connections
• Correct IP address is set`,
        [{ text: 'OK' }]
      );
    }
  };

  const testConnection = async () => {
    setConnectionTesting(true);
    try {
      const result = await testBackendConnection();
      console.log('🧪 Connection test result:', result);
      
      Alert.alert(
        result.success ? 'Connection Successful' : 'Connection Failed',
        result.message,
        [{ text: 'OK' }]
      );
      
      setBackendOnline(result.success);
    } catch (error: any) {
      console.error('💥 Connection test error:', error);
      Alert.alert('Test Error', error.message);
    } finally {
      setConnectionTesting(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    checkBackendConnection();
  }, [loadTransactions]);

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

      console.log("🗑️ Clearing all transactions for user:", userId);

      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        console.error("❌ Delete error:", deleteError);
        Alert.alert("Error", "Failed to delete transactions");
        setClearing(false);
        return;
      }

      console.log("✅ Successfully cleared all transactions");
      Alert.alert("Success", "All transactions cleared successfully");
      loadTransactions();
      setShowClearConfirm(false);
    } catch (err: any) {
      console.error("💥 Clear transactions error:", err);
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

  const netBalance = summary.income - summary.expenses;

  // Use available colors from your theme
  const onlineColor = colors.income || '#22c55e';
  const offlineColor = colors.danger || '#ef4444';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              console.log("🔄 Manual refresh triggered");
              loadTransactions();
              checkBackendConnection();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
          
          {/* Connection Status */}
          <View style={styles.connectionSection}>
            <View style={[styles.connectionStatus, { 
              backgroundColor: backendOnline ? onlineColor + '20' : offlineColor + '20',
              borderColor: backendOnline ? onlineColor + '40' : offlineColor + '40'
            }]}>
              <View style={[styles.statusDot, { 
                backgroundColor: backendOnline ? onlineColor : offlineColor
              }]} />
              <Text style={[styles.statusText, { 
                color: backendOnline ? onlineColor : offlineColor
              }]}>
                Backend {backendOnline ? 'Online' : 'Offline'}
              </Text>
              <TouchableOpacity 
                onPress={testConnection}
                disabled={connectionTesting}
                style={[styles.testButton, { backgroundColor: colors.primary }]}
              >
                {connectionTesting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.testButtonText}>Test</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Clear Section */}
        {rows.length > 0 && (
          <View
            style={[
              styles.clearSection,
              {
                backgroundColor: colors.danger + '15',
                borderColor: colors.danger + '40',
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

        {/* Summary Cards */}
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
            <View
              style={[styles.summaryCard, { 
                backgroundColor: colors.cardBackground,
                borderColor: netBalance >= 0 ? colors.income + '40' : colors.expense + '40',
                borderWidth: 1,
              }]}
            >
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Net Balance
              </Text>
              <Text style={[styles.summaryAmount, { 
                color: netBalance >= 0 ? colors.income : colors.expense 
              }]}>
                {netBalance >= 0 ? '+' : '-'}KSH {Math.abs(netBalance).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* Import Actions */}
        <View style={styles.actionsContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Import Statements
          </Text>
          <MpesaPdfImport onImported={loadTransactions} />
        </View>

        {/* Transactions List */}
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={[styles.listHeaderText, { color: colors.text }]}>
              {rows.length} Transaction{rows.length !== 1 ? "s" : ""}
            </Text>
            {rows.length > 0 && (
              <TouchableOpacity 
                onPress={loadTransactions}
                disabled={loading}
                style={styles.refreshButton}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.refreshText, { color: colors.primary }]}>
                    Refresh
                  </Text>
                )}
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
                          backgroundColor: colors.primary + '20',
                          borderColor: colors.primary + '40',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          { color: colors.primary },
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
                    numberOfLines={1}
                  >
                    Ref: {t.reference}
                  </Text>
                )}
                {t.method && (
                  <Text
                    style={[styles.txMethod, { color: colors.textSecondary }]}
                  >
                    Via {t.method}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Loading State */}
        {loading && rows.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading transactions...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Clear Confirmation Modal */}
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
  container: { 
    flex: 1, 
    padding: 16 
  },
  headerSection: {
    marginBottom: 16,
  },
  title: { 
    fontSize: 32, 
    fontWeight: "800", 
    marginBottom: 12 
  },
  connectionSection: {
    marginBottom: 8,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  testButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  clearSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  clearSubtext: { 
    fontSize: 14, 
    textAlign: "center", 
    opacity: 0.8, 
    marginBottom: 12 
  },
  clearButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  disabledButton: { 
    opacity: 0.7 
  },
  clearButtonText: { 
    color: "#fff", 
    fontWeight: "600", 
    fontSize: 16 
  },
  summaryContainer: { 
    flexDirection: "row", 
    gap: 12, 
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  summaryCard: {
    flex: 1,
    minWidth: '30%',
    padding: 16,
    borderRadius: 12,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryLabel: { 
    fontSize: 12, 
    marginBottom: 4, 
    fontWeight: "600" 
  },
  summaryAmount: { 
    fontSize: 18, 
    fontWeight: "700" 
  },
  actionsContainer: { 
    marginBottom: 24 
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  listContainer: { 
    marginBottom: 20 
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  listHeaderText: { 
    fontSize: 18, 
    fontWeight: "700" 
  },
  refreshButton: {
    padding: 8,
  },
  refreshText: { 
    fontWeight: "600",
    fontSize: 14,
  },
  emptyState: { 
    alignItems: "center", 
    paddingVertical: 60 
  },
  emptyStateText: { 
    fontSize: 18, 
    fontWeight: "600", 
    marginBottom: 8 
  },
  emptyStateSubtext: { 
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  txCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
  txCounterparty: { 
    flex: 1, 
    fontSize: 16, 
    fontWeight: "600" 
  },
  txAmount: { 
    fontSize: 16, 
    fontWeight: "700" 
  },
  txMeta: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    marginBottom: 6 
  },
  txMetaText: { 
    fontSize: 13 
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryText: { 
    fontSize: 11, 
    fontWeight: "600", 
    textTransform: "uppercase" 
  },
  txReference: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 2,
  },
  txMethod: {
    fontSize: 12,
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: { 
    padding: 24, 
    borderRadius: 16, 
    width: "100%", 
    maxWidth: 400,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: "bold", 
    marginBottom: 12 
  },
  modalText: { 
    fontSize: 15, 
    marginBottom: 24, 
    lineHeight: 22 
  },
  modalButtons: { 
    flexDirection: "row", 
    gap: 12 
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  cancelButtonText: { 
    fontWeight: "600",
    fontSize: 16,
  },
  confirmButtonText: { 
    color: "#fff", 
    fontWeight: "600",
    fontSize: 16,
  },
});