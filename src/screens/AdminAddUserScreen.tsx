// src/screens/AdminAddUserScreen.tsx
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { DrawerScreenProps } from "@react-navigation/drawer";
import { spacing, radius } from "../constants/styles";
import { adminCreateUser } from "../lib/adminApi";
import { DrawerParamList } from "../navigation/AppNavigator";
import { supabase } from "../supabaseClient";
import { useTheme } from "../hooks/useTheme";

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
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(false);

  async function handleCreateUser() {
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
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
    >
      <Text style={[styles.title, { color: colors.text }]}>Add New User</Text>
      <Text style={[styles.subtitle, { color: colors.subtitle }]}>Create a new user account</Text>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.text }]}>Email *</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            color: colors.text
          }]}
          placeholder="user@example.com"
          placeholderTextColor={colors.subtitle}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Text style={[styles.label, { color: colors.text }]}>Password *</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            color: colors.text
          }]}
          placeholder="Minimum 6 characters"
          placeholderTextColor={colors.subtitle}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: colors.text }]}>Display Name</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            color: colors.text
          }]}
          placeholder="John Doe"
          placeholderTextColor={colors.subtitle}
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={[styles.label, { color: colors.text }]}>Phone</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            color: colors.text
          }]}
          placeholder="+254712345678"
          placeholderTextColor={colors.subtitle}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={[styles.label, { color: colors.text }]}>Role</Text>
        <View style={styles.roleContainer}>
          {["user", "admin"].map((r) => (
            <TouchableOpacity
              key={r}
              style={[
                styles.roleButton,
                { backgroundColor: role === r ? colors.primary : colors.cardBackground },
              ]}
              onPress={() => setRole(r as "user" | "admin")}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  { color: role === r ? "#fff" : colors.text },
                ]}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            loading && styles.submitButtonDisabled,
          ]}
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
  container: { flex: 1 },
  title: {
    fontSize: 24, fontWeight: "800",
    marginTop: spacing.lg, marginHorizontal: spacing.md, marginBottom: spacing.xs,
  },
  subtitle: { fontSize: 14, marginBottom: spacing.lg, marginHorizontal: spacing.md },
  form: { padding: spacing.md },
  label: { fontSize: 14, fontWeight: "700", marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, fontSize: 16,
  },
  roleContainer: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  roleButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
  roleButtonText: { fontWeight: "700", fontSize: 14 },
  submitButton: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.xl },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});