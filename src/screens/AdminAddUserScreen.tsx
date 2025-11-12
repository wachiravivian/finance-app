import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { colors, spacing, radius } from "../constants/styles";
import { adminCreateUser } from "../lib/adminApi";
import { DrawerParamList } from "../navigation/AppNavigator";
import { supabase } from "../supabaseClient";

type Props = DrawerScreenProps<DrawerParamList, "AdminAddUser">;

function showNiceError(e: unknown) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const m = (e as any)?.message || (e as any)?.error || JSON.stringify(e);
    return String(m);
  }
  return String(e);
}

export default function AdminAddUserScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(false);

  async function handleCreateUser() {
    // quick auth check to avoid "Missing authorization header" from the function
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      Alert.alert("Not signed in", "Please sign in as an admin and try again.");
      return;
    }

    if (!email || !password) {
      Alert.alert("Validation Error", "Email and password are required");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Validation Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const result = await adminCreateUser({
        email,
        password,
        display_name: displayName || null,
        phone: phone || null,
        role,
      });

      if (result.error) {
        Alert.alert("Error", showNiceError(result.error));
        return;
      }

      Alert.alert("Success", "User created successfully", [
        {
          text: "OK",
          onPress: () => {
            setEmail("");
            setPassword("");
            setDisplayName("");
            setPhone("");
            setRole("user");
            navigation.navigate("AdminUsers");
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Error", showNiceError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <Text style={styles.title}>Add New User</Text>
      <Text style={styles.subtitle}>Create a new user account</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="user@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="Minimum 6 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          placeholder="John Doe"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="+254712345678"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Role</Text>
        <View style={styles.roleContainer}>
          <TouchableOpacity
            style={[styles.roleButton, role === "user" && styles.roleButtonActive]}
            onPress={() => setRole("user")}
          >
            <Text style={[styles.roleButtonText, role === "user" && styles.roleButtonTextActive]}>User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleButton, role === "admin" && styles.roleButtonActive]}
            onPress={() => setRole("admin")}
          >
            <Text style={[styles.roleButtonText, role === "admin" && styles.roleButtonTextActive]}>Admin</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleCreateUser}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Create User</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    fontSize: 24, fontWeight: "800", color: colors.text,
    marginTop: spacing.lg, marginHorizontal: spacing.md, marginBottom: spacing.xs,
  },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.lg, marginHorizontal: spacing.md },
  form: { padding: spacing.md },
  label: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: "#fff", borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: "#EFEFEF", fontSize: 16, color: colors.text,
  },
  roleContainer: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  roleButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: "#E5E7EB", alignItems: "center" },
  roleButtonActive: { backgroundColor: colors.primary },
  roleButtonText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  roleButtonTextActive: { color: "#fff" },
  submitButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.xl },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
