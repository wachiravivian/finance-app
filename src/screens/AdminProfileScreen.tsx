// src/screens/AdminProfileScreen.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from "react-native";
import { colors, spacing, radius } from "../constants/styles";
import { supabase } from "../supabaseClient";
import { useAuth } from "../hooks/useAuth";
//import { ThemedScreen } from '../components/ThemedScreen';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';

export default function AdminProfileScreen() {
  const { profile, userId } = useAuth();

  // Local state is derived from profile (no extra fetch)
  const initial = useMemo(
    () => ({
      email: profile?.email ?? "",
      display_name: (profile as any)?.display_name ?? "",
      phone: (profile as any)?.phone ?? "",
      role: (profile as any)?.role ?? "user",
    }),
    [profile]
  );

  const [displayName, setDisplayName] = useState(initial.display_name);
  const [phone, setPhone] = useState(initial.phone);
  const [saving, setSaving] = useState(false);

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.muted }}>You’re not signed in.</Text>
      </View>
    );
  }

  // If profile hasn’t hydrated yet, give a tiny loader (it’s fast since useAuth already fetched it)
  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: colors.muted }}>Loading profile…</Text>
      </View>
    );
  }

  async function handleSave() {
    try {
      setSaving(true);
      // RLS: user can update their own row
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || null,
          phone: phone || null,
          // keep role unchanged here; you can add role editing if desired
        })
        .eq("id", userId);

      if (error) throw error;
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.lg }}>
      <Text style={styles.title}>Admin Profile</Text>
      <Text style={styles.subtitle}>Manage your admin account details</Text>

      <View style={styles.card}>
        <LabelValue label="Email" value={initial.email || "—"} />
        <LabelValue label="Role" value={initial.role || "—"} />

        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Vivian Wachuu"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="+254712345678"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.readonlyBox}>
        <Text style={styles.readonlyText}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  readonlyBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  readonlyText: {
    color: colors.text,
    fontSize: 16,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 16,
    color: colors.text,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
