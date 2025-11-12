import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Modal, TextInput, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius } from "../constants/styles";
import { adminListUsers, adminUserDetails, adminDisableUser, adminDeleteUser, adminUpdateUserRole } from "../lib/adminApi";

type UserRow = { id: string; email: string | null; phone: string | null; display_name: string | null; role: string; created_at: string };

export default function AdminUsersScreen() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  async function loadUsers() {
    setLoading(true);
    const res = await adminListUsers();
    setRows(res.rows || []);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // Refresh users when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadUsers();
    }, [])
  );

  async function openUser(u: UserRow) {
    const res = await adminUserDetails(u.id);
    setSelected(res);
  }

  async function handleDisable(userId: string) {
    Alert.alert("Disable User", "Are you sure you want to disable this user?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disable",
        style: "destructive",
        onPress: async () => {
          const { error } = await adminDisableUser(userId);
          if (!error) {
            await loadUsers();
            setSelected(null);
            Alert.alert("Success", "User has been disabled");
          } else {
            Alert.alert("Error", "Failed to disable user");
          }
        },
      },
    ]);
  }

  async function handleDelete(userId: string) {
    Alert.alert("Delete User", "Are you sure you want to permanently delete this user? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await adminDeleteUser(userId);
          if (!error) {
            await loadUsers();
            setSelected(null);
            Alert.alert("Success", "User has been deleted");
          } else {
            Alert.alert("Error", "Failed to delete user");
          }
        },
      },
    ]);
  }

  async function handleUpdateRole(userId: string, newRole: string) {
    const { error } = await adminUpdateUserRole(userId, newRole);
    if (!error) {
      await loadUsers();
      if (selected && selected.profile?.id === userId) {
        const res = await adminUserDetails(userId);
        setSelected(res);
      }
      Alert.alert("Success", "User role updated");
    } else {
      Alert.alert("Error", "Failed to update user role");
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: colors.muted }}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>

        {rows.length === 0 ? (
          <Text style={styles.muted}>No users found.</Text>
        ) : (
          rows.map((item) => (
            <TouchableOpacity key={item.id} style={styles.card} onPress={() => openUser(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.rowTitle}>{item.display_name || item.email || "Unknown"}</Text>
                <View style={[styles.roleBadge, item.role === "disabled" && styles.roleBadgeDisabled]}>
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
              </View>
              <Text style={styles.rowMeta}>Email: {item.email || "—"}</Text>
              <Text style={styles.rowMeta}>Phone: {item.phone || "—"}</Text>
              <Text style={styles.rowMeta}>Joined: {new Date(item.created_at).toLocaleDateString()}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* User Details Modal */}
      {selected && (
        <Modal visible={!!selected} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView>
                <Text style={styles.sheetTitle}>{selected.profile?.display_name || selected.profile?.id || "User Details"}</Text>
                <Text style={styles.muted}>Email: {selected.profile?.email || "—"}</Text>
                <Text style={styles.muted}>Phone: {selected.profile?.phone || "—"}</Text>
                <Text style={[styles.muted, { marginBottom: spacing.md }]}>Role: {selected.profile?.role}</Text>

                {/* Role Update */}
                <Text style={styles.section}>Change Role</Text>
                <View style={styles.roleButtons}>
                  <TouchableOpacity
                    style={[styles.roleBtn, selected.profile?.role === "user" && styles.roleBtnActive]}
                    onPress={() => handleUpdateRole(selected.profile.id, "user")}
                  >
                    <Text style={styles.roleBtnText}>User</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleBtn, selected.profile?.role === "admin" && styles.roleBtnActive]}
                    onPress={() => handleUpdateRole(selected.profile.id, "admin")}
                  >
                    <Text style={styles.roleBtnText}>Admin</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.section}>Recent Transactions</Text>
                {selected.transactions?.length > 0 ? (
                  selected.transactions.slice(0, 8).map((t: any) => (
                    <View key={t.id} style={styles.transactionRow}>
                      <Text style={styles.transactionText}>
                        {new Date(t.created_at).toLocaleDateString()} • {t.title}
                      </Text>
                      <Text style={[styles.transactionAmount, t.amount < 0 && styles.transactionAmountNegative]}>
                        {t.amount < 0 ? "-" : "+"}Ksh {Math.abs(t.amount).toLocaleString()}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>No transactions found</Text>
                )}

                {/* Action buttons */}
                <View style={styles.actionButtons}>
                  {selected.profile?.role !== "disabled" && (
                    <TouchableOpacity
                      style={[styles.btn, styles.btnWarning]}
                      onPress={() => handleDisable(selected.profile.id)}
                    >
                      <Text style={styles.btnTxt}>Disable</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.btn, styles.btnDanger]}
                    onPress={() => handleDelete(selected.profile.id)}
                  >
                    <Text style={styles.btnTxt}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() => setSelected(null)}
                  >
                    <Text style={styles.btnTxt}>Close</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  rowTitle: { fontWeight: "800", fontSize: 16, color: colors.text },
  rowMeta: { color: colors.muted, marginTop: 2, fontSize: 13 },
  section: { fontWeight: "800", color: colors.text, marginBottom: 8, marginTop: spacing.md },
  muted: { color: colors.muted, textAlign: "center", marginTop: spacing.md },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  sheetTitle: { fontWeight: "800", fontSize: 18, color: colors.text, marginBottom: 4 },

  btn: { paddingVertical: 12, borderRadius: radius.md, alignItems: "center", marginTop: spacing.sm },
  btnTxt: { color: "#fff", fontWeight: "800" },
  btnWarning: { backgroundColor: colors.warning },
  btnDanger: { backgroundColor: colors.danger },
  btnSecondary: { backgroundColor: colors.muted },

  roleBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeDisabled: {
    backgroundColor: colors.danger,
  },
  roleText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  roleButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },
  roleBtnActive: {
    backgroundColor: colors.primary,
  },
  roleBtnText: {
    color: colors.text,
    fontWeight: "700",
  },

  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  transactionText: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
  },
  transactionAmount: {
    color: colors.success,
    fontWeight: "700",
    fontSize: 13,
  },
  transactionAmountNegative: {
    color: colors.danger,
  },

  actionButtons: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});

