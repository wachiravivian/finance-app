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
  disabled?: boolean;
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
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Load users using edge function
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Loading users via edge function...");

      const { data, error: edgeError } = await supabase.functions.invoke("admin-list-users", {
        body: { 
          page: 1,
          per_page: 100 
        }
      });

      if (edgeError) {
        console.error("Edge function error:", edgeError);
        throw new Error(edgeError.message || "Failed to load users");
      }
      
      if (!data || !data.rows) {
        throw new Error("No data returned from server");
      }

      console.log(`Loaded ${data.rows.length} users`);
      setUsers(data.rows);

    } catch (err: any) {
      console.error("Error loading users:", err);
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
      
      // Update profile directly in database (this should work with RLS)
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: editForm.display_name,
          phone: editForm.phone,
          role: editForm.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedUser.id);

      if (error) throw error;
      
      showMessage("User updated successfully");
      closeEditModal();
      loadUsers();
    } catch (err: any) {
      console.error("Update error:", err);
      Alert.alert("Error", err.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const disableUser = async (userId: string) => {
    try {
      setActionInProgress(userId);
      
      console.log("Disabling user:", userId);
      
      // Use edge function for auth operations
      const { data, error: authError } = await supabase.functions.invoke("admin-update-user-auth", {
        body: { 
          user_id: userId,
          action: "ban"
        }
      });

      if (authError) {
        console.error("Auth disable error:", authError);
        throw authError;
      }

      // Update profile locally
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          disabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) {
        console.error("Profile disable error:", profileError);
        // Don't throw, auth update was successful
      }

      showMessage("User disabled successfully");
      loadUsers();
      
    } catch (err: any) {
      console.error("Error disabling user:", err);
      Alert.alert("Error", err.message || "Failed to disable user");
    } finally {
      setActionInProgress(null);
    }
  };

  const enableUser = async (userId: string) => {
    try {
      setActionInProgress(userId);
      
      console.log("Enabling user:", userId);
      
      // Use edge function for auth operations
      const { data, error: authError } = await supabase.functions.invoke("admin-update-user-auth", {
        body: { 
          user_id: userId,
          action: "unban"
        }
      });

      if (authError) {
        console.error("Auth enable error:", authError);
        throw authError;
      }

      // Update profile locally
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          disabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) {
        console.error("Profile enable error:", profileError);
        // Don't throw, auth update was successful
      }

      showMessage("User enabled successfully");
      loadUsers();
      
    } catch (err: any) {
      console.error("Error enabling user:", err);
      Alert.alert("Error", err.message || "Failed to enable user");
    } finally {
      setActionInProgress(null);
    }
  };

  const deleteUser = async (userId: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this user? This action cannot be undone and will remove all their data.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete User", 
          style: "destructive",
          onPress: async () => {
            try {
              setActionInProgress(userId);
              
              console.log("Deleting user:", userId);
              
              // First, clean up user data from all tables (this should work with RLS)
              const tablesToClean = ['transactions', 'budgets', 'goals'];
              
              for (const table of tablesToClean) {
                const { error } = await supabase
                  .from(table)
                  .delete()
                  .eq('user_id', userId);
                
                if (error) {
                  console.error(`Error cleaning ${table}:`, error);
                }
              }
              
              // Delete profile
              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);
              
              if (profileError) {
                console.error("Profile delete error:", profileError);
              }
              
              // Use edge function for auth delete
              const { data, error: authError } = await supabase.functions.invoke("admin-update-user-auth", {
                body: { 
                  user_id: userId,
                  action: "delete"
                }
              });

              if (authError) {
                console.error("Auth delete error:", authError);
                throw authError;
              }
              
              showMessage("User deleted successfully");
              loadUsers();
              
            } catch (err: any) {
              console.error("Error deleting user:", err);
              Alert.alert("Error", err.message || "Failed to delete user");
            } finally {
              setActionInProgress(null);
            }
          }
        }
      ]
    );
  };

  const createUserProfile = async (userId: string, userEmail: string) => {
    try {
      setActionInProgress(userId);
      
      console.log("Creating profile for user:", userId);
      
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          display_name: userEmail?.split('@')[0] || 'User',
          role: 'user',
          disabled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error("Profile creation error:", error);
        throw error;
      }
      
      showMessage("User profile created successfully");
      loadUsers();
      
    } catch (err: any) {
      console.error("Error creating profile:", err);
      Alert.alert("Error", "Failed to create user profile: " + err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const isUserDisabled = (user: User) => {
    if (user.disabled) return true;
    
    if (user.banned_until) {
      try {
        const bannedUntil = new Date(user.banned_until);
        const now = new Date();
        return bannedUntil > now;
      } catch (error) {
        console.error("Error parsing banned_until date:", error);
        return false;
      }
    }
    
    return false;
  };

  const hasProfile = (user: User) => {
    return user.display_name !== null || user.role !== 'user';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return "Invalid date";
    }
  };

  const getStatusColor = (user: User) => {
    if (isUserDisabled(user)) {
      return colors.danger;
    }
    return colors.primary;
  };

  const getStatusText = (user: User) => {
    if (isUserDisabled(user)) {
      return "Disabled";
    }
    return "Active";
  };

  // ... (rest of the component remains the same as your working version)
  // Keep all the JSX and styles from your working version

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
        <Text style={{ color: colors.danger, marginTop: spacing.md, textAlign: 'center' }}>
          Error loading users: {error}
        </Text>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>
              User Management
            </Text>
            <Text style={[styles.subtitle, { color: colors.subtitle }]}>
              {users.length} user{users.length !== 1 ? 's' : ''} • {users.filter(u => !isUserDisabled(u)).length} active
            </Text>
          </View>
          <TouchableOpacity 
            onPress={loadUsers} 
            disabled={loading}
            style={[styles.refreshButton, { backgroundColor: colors.cardBackground }]}
          >
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.subtitle} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No users found</Text>
            <Text style={[styles.emptySubtext, { color: colors.subtitle }]}>
              There are no users in the system yet.
            </Text>
          </View>
        ) : (
          users.map((user) => {
            const disabled = isUserDisabled(user);
            const hasUserProfile = hasProfile(user);
            const isActionInProgress = actionInProgress === user.id;
            const statusColor = getStatusColor(user);
            const statusText = getStatusText(user);
            
            return (
              <View
                key={user.id}
                style={[
                  styles.userCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                    opacity: disabled ? 0.7 : 1,
                  },
                ]}
              >
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>
                      {user.display_name || user.email || 'Unknown User'}
                    </Text>
                    <Text style={[styles.userEmail, { color: colors.subtitle }]}>
                      {user.email}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {statusText}
                    </Text>
                  </View>
                </View>

                <View style={styles.userDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={14} color={colors.subtitle} />
                    <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Role:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {user.role || 'user'}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={14} color={colors.subtitle} />
                    <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Created:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {formatDate(user.created_at)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={14} color={colors.subtitle} />
                    <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Last Active:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {formatDate(user.last_sign_in_at)}
                    </Text>
                  </View>
                  
                  {user.phone && (
                    <View style={styles.detailRow}>
                      <Ionicons name="call-outline" size={14} color={colors.subtitle} />
                      <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Phone:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {user.phone}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Profile Warning */}
                {!hasUserProfile && (
                  <View style={[styles.warningBadge, { backgroundColor: '#FFA50020' }]}>
                    <Ionicons name="warning-outline" size={14} color="#FFA500" />
                    <Text style={[styles.warningText, { color: '#FFA500' }]}>
                      Basic Profile
                    </Text>
                    <TouchableOpacity 
                      onPress={() => createUserProfile(user.id, user.email || '')}
                      disabled={isActionInProgress}
                      style={[styles.fixButton, { backgroundColor: '#FFA500' }]}
                    >
                      <Text style={styles.fixButtonText}>Create</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    disabled={isActionInProgress}
                    onPress={() => openEditModal(user)}
                    style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
                  >
                    {isActionInProgress ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                        <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                          Edit
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={isActionInProgress}
                    onPress={() => disabled ? enableUser(user.id) : disableUser(user.id)}
                    style={[
                      styles.actionButton, 
                      { 
                        backgroundColor: disabled ? '#28A74515' : '#FFA50015',
                        opacity: isActionInProgress ? 0.6 : 1
                      }
                    ]}
                  >
                    {isActionInProgress ? (
                      <ActivityIndicator size="small" color={disabled ? '#28A745' : '#FFA500'} />
                    ) : (
                      <>
                        <Ionicons
                          name={disabled ? "checkmark-circle-outline" : "close-circle-outline"}
                          size={16}
                          color={disabled ? '#28A745' : '#FFA500'}
                        />
                        <Text style={[
                          styles.actionButtonText, 
                          { color: disabled ? '#28A745' : '#FFA500' }
                        ]}>
                          {disabled ? "Enable" : "Disable"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={isActionInProgress}
                    onPress={() => deleteUser(user.id)}
                    style={[styles.actionButton, { backgroundColor: colors.danger + '15' }]}
                  >
                    {isActionInProgress ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        <Text style={[styles.actionButtonText, { color: colors.danger }]}>
                          Delete
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Edit Modal */}
        <Modal visible={editModalVisible} animationType="slide" transparent>
          <View style={[styles.modalOverlay]}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit User</Text>
                <Text style={[styles.modalSubtitle, { color: colors.subtitle }]}>
                  {selectedUser?.email}
                </Text>
              </View>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Display Name</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                    value={editForm.display_name}
                    onChangeText={(text) => setEditForm({ ...editForm, display_name: text })}
                    placeholder="Enter display name"
                    placeholderTextColor={colors.subtitle}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Phone Number</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                    value={editForm.phone}
                    onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.subtitle}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
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
                            fontSize: 12,
                          }}
                        >
                          {role.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  onPress={closeEditModal} 
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveUser}
                  disabled={saving}
                  style={[styles.saveButton, { 
                    backgroundColor: colors.primary,
                    opacity: saving ? 0.6 : 1
                  }]}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "600" }}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

      {/* Toast Feedback */}
      {actionMessage && (
        <View style={[styles.toast, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          <Text style={[styles.toastText, { color: colors.text }]}>{actionMessage}</Text>
        </View>
      )}
    </View>
  );
}

// Keep all your existing styles from the working version
const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  center: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center",
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { 
    fontSize: 24, 
    fontWeight: "700",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  refreshButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  retryButtonText: { 
    color: "#fff", 
    fontWeight: "600",
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    padding: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  emptyText: { 
    fontSize: 18, 
    fontWeight: "600", 
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  userCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: { 
    fontSize: 16, 
    fontWeight: "600",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: spacing.sm,
    marginRight: spacing.md,
    width: 80,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  fixButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  fixButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toast: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    gap: spacing.sm,
  },
  toastText: { 
    fontWeight: "600",
    fontSize: 14,
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  modalHeader: {
    marginBottom: spacing.lg,
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: "700", 
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 14,
  },
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  inputLabel: { 
    fontWeight: "600",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
  },
  roleButtons: { 
    flexDirection: "row", 
    gap: spacing.md,
  },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: spacing.md,
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
    flex: 2,
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
  },
});