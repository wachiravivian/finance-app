// src/screens/AdminUsersScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { DrawerParamList } from "../navigation/AppNavigator";
import { supabase } from "../supabaseClient";
import { spacing, radius } from "../constants/styles";
import { useTheme } from "../hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";

type Props = DrawerScreenProps<DrawerParamList, "AdminUsers">;

type User = {
  id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  role: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until?: string | null;
};

type EditUserData = {
  display_name: string;
  phone: string;
  role: string;
};

export default function AdminUsersScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditUserData>({
    display_name: "",
    phone: "",
    role: "user",
  });
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: edgeError } = await supabase.functions.invoke("admin-list-users", {
        body: { limit: 100 },
      });

      if (edgeError) throw new Error(edgeError.message);
      if (!data || !data.rows) throw new Error("No data returned");

      setUsers(data.rows);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      display_name: user.display_name || "",
      phone: user.phone || "",
      role: user.role || "user",
    });
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setSelectedUser(null);
    setSaving(false);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      const { error } = await supabase.functions.invoke("admin-update-user", {
        body: { user_id: selectedUser.id, updates: editForm },
      });
      if (error) throw error;
      showMessage("✅ User updated successfully");
      closeEditModal();
      loadUsers();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const disableUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-ban-user", { body: { user_id: userId } });
      if (error) throw error;
      showMessage("🟠 User disabled");
      loadUsers();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to disable user");
    }
  };

  const enableUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-unban-user", { body: { user_id: userId } });
      if (error) throw error;
      showMessage("🟢 User enabled");
      loadUsers();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to enable user");
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: userId } });
      if (error) throw error;
      showMessage("🗑️ User deleted");
      loadUsers();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to delete user");
    }
  };

  const isUserDisabled = (user: User) =>
    user.banned_until && new Date(user.banned_until) > new Date();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: spacing.md }}>Loading users...</Text>
      </View>
    );
  }

  if (error && users.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={{ color: colors.danger, marginTop: spacing.md }}>Error: {error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={loadUsers}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          User Management ({users.length})
        </Text>
        <TouchableOpacity onPress={loadUsers} disabled={loading}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {users.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={64} color={colors.subtitle} />
          <Text style={{ color: colors.text, marginTop: spacing.sm }}>No users found</Text>
        </View>
      ) : (
        users.map((user) => {
          const disabled = isUserDisabled(user);
          return (
            <View
              key={user.id}
              style={[
                styles.userCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <View style={styles.userHeader}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  {user.display_name || user.email}
                </Text>
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    disabled={saving}
                    onPress={() => openEditModal(user)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={saving}
                    onPress={() =>
                      disabled ? enableUser(user.id) : disableUser(user.id)
                    }
                    style={styles.actionButton}
                  >
                    <Ionicons
                      name={disabled ? "checkmark-circle-outline" : "close-circle-outline"}
                      size={18}
                      color={disabled ? "#28A745" : "#FFA500"}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={saving}
                    onPress={() => deleteUser(user.id)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={{ color: colors.subtitle }}>{user.email}</Text>
              <Text style={{ color: colors.subtitle }}>Role: {user.role}</Text>
              <Text style={{ color: colors.subtitle }}>Created: {formatDate(user.created_at)}</Text>
              <Text style={{ color: colors.subtitle }}>
                Last sign-in: {formatDate(user.last_sign_in_at)}
              </Text>
            </View>
          );
        })
      )}

      {/* Toast Feedback */}
      {actionMessage && (
        <View style={[styles.toast, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.toastText, { color: colors.text }]}>{actionMessage}</Text>
        </View>
      )}

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit User</Text>
            <Text style={{ color: colors.subtitle }}>{selectedUser?.email}</Text>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Display Name</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              value={editForm.display_name}
              onChangeText={(text) => setEditForm({ ...editForm, display_name: text })}
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Phone</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              value={editForm.phone}
              onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Role</Text>
            <View style={styles.roleButtons}>
              {["user", "admin"].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleButton,
                    {
                      backgroundColor: editForm.role === role ? colors.primary : "transparent",
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setEditForm({ ...editForm, role })}
                >
                  <Text
                    style={{
                      color: editForm.role === role ? "#fff" : colors.primary,
                      fontWeight: "600",
                    }}
                  >
                    {role.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closeEditModal} style={styles.cancelButton}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveUser}
                disabled={saving}
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff" }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg,
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "700" },
  retryButton: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  retryButtonText: { color: "#fff", fontWeight: "600" },
  userCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  userName: { fontSize: 16, fontWeight: "600" },
  actionsContainer: { flexDirection: "row", gap: spacing.xs },
  actionButton: { padding: spacing.xs },
  toast: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  toastText: { fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: spacing.sm },
  inputLabel: { marginTop: spacing.md, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  roleButtons: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  saveButton: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
